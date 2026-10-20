"""
LLM client — wraps Google Gemini with a timeout and one retry.

Raises LLMUnavailableError on any failure; never silently swallows errors.
"""
import json
import time
import logging
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMUnavailableError(Exception):
    """Raised when the LLM cannot be reached or returns an unusable response."""
    def __init__(self, message: str, code: str = "llm_unavailable"):
        super().__init__(message)
        self.code = code


_GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def call_llm(prompt: str) -> dict:
    """
    Send *prompt* to the configured Gemini model and return the parsed JSON dict.

    Strategy:
    - Model name is read dynamically from settings.GEMINI_MODEL (default: gemini-3.5-flash).
      Note: Always re-check the official deprecations page (ai.google.dev/gemini-api/docs/deprecations)
      before changing this setting.
    - Validate API key is present before attempting call.
    - Attempt once; on failure wait 2 s and retry once.
    - Timeout per attempt = settings.LLM_TIMEOUT_SECONDS.
    - Logs one line with error type and model name on failure, never exposing key or full prompt.
    - Raises LLMUnavailableError if attempts fail.
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key or api_key.strip() in ("", "your_gemini_api_key_here", "fake-gemini-api-key-replace-in-env"):
        logger.warning("Gemini API key is not configured or placeholder. Model: %s", settings.GEMINI_MODEL)
        raise LLMUnavailableError("Gemini API key is missing or unconfigured.", code="llm_unavailable")

    # Build list of models to try in sequence: primary, then fallback if distinct
    primary_model = settings.GEMINI_MODEL
    fallback_model = getattr(settings, "GEMINI_FALLBACK_MODEL", "").strip()
    models_to_try = [primary_model]
    if fallback_model and fallback_model != primary_model:
        models_to_try.append(fallback_model)

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1500,
        },
    }

    last_error: Exception | None = None
    last_error_type = "unknown_error"
    last_model_attempted = primary_model

    for model_idx, model_name in enumerate(models_to_try):
        last_model_attempted = model_name
        url = f"{_GEMINI_API_BASE}/{model_name}:generateContent?key={api_key}"

        for attempt in range(2):
            try:
                resp = requests.post(
                    url,
                    json=payload,
                    timeout=settings.LLM_TIMEOUT_SECONDS,
                )
                resp.raise_for_status()
                data = resp.json()

                # Extract text from the first candidate
                text = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                ).strip()

                if not text:
                    raise LLMUnavailableError("Gemini returned an empty response", code="llm_unavailable")

                # Strip markdown code fences if present
                if text.startswith("```"):
                    lines = text.splitlines()
                    # Drop the first (```json) and last (```) lines
                    text = "\n".join(lines[1:-1]).strip()

                return json.loads(text)

            except requests.HTTPError as exc:
                last_error = exc
                status_code = exc.response.status_code if exc.response is not None else 0
                if status_code == 404:
                    last_error_type = "model_not_found_or_retired_404"
                elif status_code == 429:
                    last_error_type = "quota_or_rate_limit_429"
                else:
                    last_error_type = f"http_error_{status_code}"
                logger.warning(
                    "Gemini attempt %d failed: error_type=%s, model=%s",
                    attempt + 1,
                    last_error_type,
                    model_name,
                )

                # If non-retryable client error (e.g., 400 Bad Request, 401 Unauthorized, 403 Forbidden),
                # do not retry or fallback — raise immediately
                if status_code in (400, 401, 403):
                    raise LLMUnavailableError(
                        f"LLM client error: {last_error_type}",
                        code="llm_unavailable",
                    ) from exc

                # If quota exhausted (429) or model temporarily unavailable (503) and we have a fallback model,
                # immediately proceed to fallback without burning more attempts on the exhausted model
                if status_code in (429, 503) and model_idx < len(models_to_try) - 1:
                    logger.info(
                        "Switching to fallback model %s after error_type=%s on %s",
                        models_to_try[model_idx + 1],
                        last_error_type,
                        model_name,
                    )
                    break

                if attempt == 0:
                    time.sleep(2)

            except requests.Timeout as exc:
                last_error = exc
                last_error_type = "timeout"
                logger.warning(
                    "Gemini attempt %d failed: error_type=%s, model=%s",
                    attempt + 1,
                    last_error_type,
                    model_name,
                )
                if attempt == 0:
                    time.sleep(2)

            except (requests.RequestException, json.JSONDecodeError, KeyError) as exc:
                last_error = exc
                last_error_type = type(exc).__name__
                logger.warning(
                    "Gemini attempt %d failed: error_type=%s, model=%s",
                    attempt + 1,
                    last_error_type,
                    model_name,
                )
                if attempt == 0:
                    time.sleep(2)

    logger.error("LLM call failed completely: error_type=%s, model=%s", last_error_type, last_model_attempted)
    raise LLMUnavailableError(
        f"LLM unavailable: {last_error_type}",
        code="llm_unavailable",
    ) from last_error
