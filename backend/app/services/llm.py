from datetime import datetime, timedelta, timezone
import logging
import re

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Per-model rate-limit backoff tracking. Free-tier Gemini quotas are severe
# (as low as 5 requests/minute) and Google's 429 response tells you exactly
# how long to wait ("Please retry in 51.97s") -- we honor that instead of
# hammering the API every single cycle while quota is exhausted, which just
# wastes the cooldown window and guarantees another 429.
_backoff_until: dict[str, datetime] = {}

_RETRY_SECONDS_RE = re.compile(r"retry in ([\d.]+)s", re.IGNORECASE)


class GeminiUnavailable(Exception):
    """Raised when Gemini can't be called right now (no key, in backoff, or
    the call itself failed). Callers should fall back to a non-LLM path."""


def _seconds_until_backoff_clears(model: str) -> float:
    until = _backoff_until.get(model)
    if until is None:
        return 0.0
    remaining = (until - datetime.now(timezone.utc)).total_seconds()
    return max(0.0, remaining)


async def call_gemini(model: str, prompt: str, response_schema: dict | None = None) -> str:
    """Make one Gemini generateContent call and return the raw text of the
    response. Raises GeminiUnavailable if it can't/shouldn't be called right
    now -- callers are expected to catch this and fall back."""
    settings = get_settings()
    api_key = settings.gemini_api_key
    if not api_key:
        raise GeminiUnavailable("GEMINI_API_KEY is not set in backend/.env")

    remaining = _seconds_until_backoff_clears(model)
    if remaining > 0:
        raise GeminiUnavailable(f"{model} is in rate-limit backoff for another {remaining:.0f}s")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
    generation_config: dict = {}
    if response_schema is not None:
        generation_config = {"responseMimeType": "application/json", "responseSchema": response_schema}

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        **({"generationConfig": generation_config} if generation_config else {}),
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            res_json = res.json()
            return res_json["candidates"][0]["content"]["parts"][0]["text"]
    except httpx.HTTPStatusError as e:
        body = e.response.text[:800] if e.response is not None else "<no response body>"
        if e.response is not None and e.response.status_code == 429:
            match = _RETRY_SECONDS_RE.search(body)
            retry_seconds = float(match.group(1)) if match else 60.0
            _backoff_until[model] = datetime.now(timezone.utc) + timedelta(seconds=retry_seconds)
            logger.warning(
                f"Gemini rate-limited on {model}, backing off for {retry_seconds:.0f}s. Body: {body}"
            )
        else:
            logger.error(f"Gemini call failed ({model}): {e}. Response body: {body}")
        raise GeminiUnavailable(str(e)) from e
    except Exception as e:
        logger.error(f"Gemini call failed ({model}): {e}")
        raise GeminiUnavailable(str(e)) from e