from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SignalCraft Agent API"
    database_url: str = "sqlite:///./signalcraft.db"
    cors_origins: str = "http://localhost:3000"
    posting_interval_hours: int = 6
    max_posts_per_run: int = 1

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
