from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SignalCraft Agent API"
    database_url: str = "sqlite:///./signalcraft.db"
    cors_origins: str = "http://localhost:3000"
    # The agent scans continuously, back-to-back, forever. This is only a brief
    # courtesy pause between full passes over all sources (so we don't hammer
    # RSS/HN endpoints in a tight loop) — it is NOT a standby/idle period.
    cycle_cooldown_seconds: int = 10
    # Paste your key into backend/.env (GEMINI_API_KEY=...) -- nothing else
    # needs to change. gemini_model is a separate setting on purpose: Google
    # periodically retires model IDs (gemini-1.5-flash was retired, then
    # gemini-2.5-flash became closed to new accounts), so the next time that
    # happens this is a one-line .env edit instead of a code change. If
    # gemini-3.5-flash also isn't available on your account, check
    # https://ai.google.dev/gemini-api/docs/models for your account's
    # current model ID and paste it into .env.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    # Free-tier quotas are brutally small (as low as 5 requests/minute) and
    # apply per-model, so scoring (many candidates per cycle) uses a
    # separate, ideally higher-throughput/cheaper model from opinion-writing
    # (rare -- only accepted candidates -- but needs better quality).
    gemini_scoring_model: str = "gemini-3.5-flash"
    # Publish queue: after a post goes live, wait a randomized interval in
    # this range before releasing the next queued one. Scanning/scoring never
    # stops in the background regardless of this timer.
    publish_min_minutes: float = 10.0
    publish_max_minutes: float = 15.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()