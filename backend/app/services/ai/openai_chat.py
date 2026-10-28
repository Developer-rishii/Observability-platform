import logging
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class OpenAIChatError(Exception):
    """Base exception for OpenAI chat provider errors."""
    def __init__(self, message: str, code: str = "ai_chat_error", status_code: int = 503):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class OpenAIChatDisabledError(OpenAIChatError):
    def __init__(self, message: str = "AI chat is disabled or not configured"):
        super().__init__(message, code="ai_chat_disabled", status_code=503)


class OpenAIChatAuthError(OpenAIChatError):
    def __init__(self, message: str = "AI chat authentication failed"):
        super().__init__(message, code="ai_chat_auth_error", status_code=503)


class OpenAIChatRateLimitError(OpenAIChatError):
    def __init__(self, message: str = "AI chat rate limit exceeded. Please wait a moment."):
        super().__init__(message, code="ai_chat_rate_limited", status_code=429)


class OpenAIChatTimeoutError(OpenAIChatError):
    def __init__(self, message: str = "AI chat service timed out or temporarily unavailable"):
        super().__init__(message, code="ai_chat_unavailable", status_code=503)


class ChatProvider:
    """Wrapper around OpenAI chat completion SDK."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, base_url: Optional[str] = None):
        # 1. First check explicit argument
        # 2. Check /app/.env (or backend/.env) for GROQ_API_KEY or OPENAI_API_KEY
        # 3. Fall back to settings
        key = api_key
        detected_base_url = base_url
        detected_model = model

        if not key:
            try:
                import os
                from dotenv import dotenv_values
                env_path = "/app/.env" if os.path.exists("/app/.env") else ".env"
                env_vals = dotenv_values(env_path)
                groq_key = env_vals.get("GROQ_API_KEY")
                openai_key = env_vals.get("OPENAI_API_KEY")
                if groq_key and groq_key.strip():
                    key = groq_key.strip()
                    if not detected_base_url:
                        detected_base_url = "https://api.groq.com/openai/v1"
                    if not detected_model:
                        detected_model = "qwen/qwen3.8-27b"
                elif openai_key and openai_key.strip():
                    key = openai_key.strip()
            except Exception:
                pass

        if not key:
            groq_env = getattr(settings, "GROQ_API_KEY", "") or os.environ.get("GROQ_API_KEY", "")
            if groq_env:
                key = groq_env
                if not detected_base_url:
                    detected_base_url = "https://api.groq.com/openai/v1"
                if not detected_model:
                    detected_model = "qwen/qwen3.8-27b"

        self.api_key = key or getattr(settings, "OPENAI_API_KEY", "")
        if self.api_key.startswith("gsk_"):
            self.base_url = detected_base_url or "https://api.groq.com/openai/v1"
            self.model = detected_model or "qwen/qwen3.8-27b"
        else:
            self.base_url = detected_base_url or None
            self.model = detected_model or getattr(settings, "OPENAI_CHAT_MODEL", "gpt-4o-mini")

        self.timeout = getattr(settings, "OPENAI_TIMEOUT_SECONDS", 20)
        self.max_tokens = getattr(settings, "OPENAI_MAX_OUTPUT_TOKENS", 400)
        self._client = None

    def is_configured(self) -> bool:
        """Return True if an API key is configured."""
        key = (self.api_key or "").strip()
        return bool(key and key not in ("your_openai_api_key_here", "your_groq_api_key_here"))

    def _get_client(self):
        if self._client is not None:
            return self._client
        if not self.is_configured():
            raise OpenAIChatDisabledError("AI chat is not configured. API key is empty.")

        try:
            import httpx
            from openai import OpenAI
            http_client = httpx.Client(timeout=float(self.timeout))
            kwargs = {
                "api_key": self.api_key,
                "timeout": float(self.timeout),
                "http_client": http_client,
            }
            if self.base_url:
                kwargs["base_url"] = self.base_url
            self._client = OpenAI(**kwargs)
            return self._client
        except ImportError:
            logger.error("The 'openai' Python package is not installed.")
            raise OpenAIChatDisabledError("The openai package is not installed in the environment.")
        except Exception as exc:
            logger.error(f"Failed to initialize OpenAI client: {exc}")
            raise OpenAIChatError(f"OpenAI client initialization failed: {exc}")

    def generate(self, system_prompt: str, messages: List[Dict[str, str]]) -> str:
        """
        Generate a chat response using OpenAI Chat Completions.
        
        system_prompt: Strict, authoritative instructions for the model.
        messages: Conversation history [{role: 'user'|'assistant', content: str}].
        """
        client = self._get_client()

        payload_messages = [{"role": "system", "content": system_prompt}]
        for m in messages:
            role = m.get("role", "user")
            if role not in ("user", "assistant"):
                role = "user"
            content = str(m.get("content", ""))
            payload_messages.append({"role": role, "content": content})

        try:
            import openai
            response = client.chat.completions.create(
                model=self.model,
                messages=payload_messages,
                temperature=0.2,
                max_tokens=self.max_tokens,
            )
            choice = response.choices[0]
            answer = choice.message.content or ""
            return answer.strip()

        except Exception as e:
            err_name = type(e).__name__
            logger.error(f"OpenAI Chat API call failed ({err_name}): {e}", exc_info=False)

            # Map OpenAI SDK exceptions gracefully
            msg_str = str(e)
            if "insufficient_quota" in msg_str or "credit_balance_exhausted" in msg_str:
                raise OpenAIChatRateLimitError("OpenAI account credit balance is exhausted. Please check your OpenAI billing.")
            elif "AuthenticationError" in err_name:
                raise OpenAIChatAuthError("AI chat is not configured.")
            elif "RateLimitError" in err_name:
                raise OpenAIChatRateLimitError("Rate limit exceeded from provider. Please wait a moment.")
            elif "Timeout" in err_name or "APITimeoutError" in err_name or "APIConnectionError" in err_name:
                raise OpenAIChatTimeoutError("AI chat temporarily unavailable")
            else:
                raise OpenAIChatTimeoutError("AI chat temporarily unavailable")


# Global singleton instance for injection
_default_provider = ChatProvider()

def get_chat_provider() -> ChatProvider:
    return _default_provider
