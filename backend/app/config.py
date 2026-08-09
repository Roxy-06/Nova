from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SignalCraft Agent API"
    database_url: str = "sqlite:///./signalcraft.db"
    cors_origins: str = "http://localhost:3000"
    # Database URL: use Postgres in production (set DATABASE_URL). Defaults
    # to local SQLite for developer convenience.
    database_url: str = "sqlite:///./signalcraft.db"
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
    # Protective local rate limit for Gemini calls (per-model, per-minute).
    # Set conservatively to avoid exhausting free-tier quotas during scans.
    gemini_max_requests_per_minute: int = 20
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
    # When true, shorten the publish cooldown for evaluation purposes.
    # Set FAST_PUBLISH_FOR_EVAL=1 in backend/.env to enable quick publishing during tests.
    fast_publish_for_eval: bool = False
    # The live "SYSTEM LOGS" / decision feed in telemetry used to hard-cap at
    # the last 30 rows, which meant scanning visibly "stopped" once that many
    # accumulated. There is no count cap anymore -- instead, a decision
    # simply ages out of the telemetry response once it's older than this
    # many minutes. This only affects what /telemetry RETURNS for display;
    # the underlying TopicDecision row is never deleted, so permanent
    # dedup/source-seen checks are completely unaffected by this window.
    telemetry_window_minutes: float = 6.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    # Allow a convenient evaluation mode override that shortens the publish
    # cooldown window so posts appear faster during short evaluation runs.
    if settings.fast_publish_for_eval:
        settings.publish_min_minutes = 0.5
        settings.publish_max_minutes = 1.0
    return settings
