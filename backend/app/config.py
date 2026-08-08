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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()