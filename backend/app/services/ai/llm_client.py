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


_GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def call_llm(prompt: str) -> dict:
    """
    Send *prompt* to the configured Gemini model and return the parsed JSON dict.

    Strategy:
    - Attempt once; on failure wait 2 s and retry once.
    - Timeout per attempt = settings.LLM_TIMEOUT_SECONDS.
    - Raises LLMUnavailableError if both attempts fail.
    """
    url = (
        f"{_GEMINI_API_BASE}/{settings.GEMINI_MODEL}:generateContent"
        f"?key={settings.GEMINI_API_KEY}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1500,
        },
    }

    last_error: Exception | None = None
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
                raise LLMUnavailableError("Gemini returned an empty response")

            # Strip markdown code fences if present
            if text.startswith("```"):
                lines = text.splitlines()
                # Drop the first (```json) and last (```) lines
                text = "\n".join(lines[1:-1]).strip()

            return json.loads(text)

        except (requests.RequestException, json.JSONDecodeError, KeyError) as exc:
            last_error = exc
            logger.warning("LLM attempt %d failed: %s", attempt + 1, exc)
            if attempt == 0:
                time.sleep(2)

    raise LLMUnavailableError(
        f"LLM unavailable after 2 attempts. Last error: {last_error}"
    ) from last_error
