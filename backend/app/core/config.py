from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "WriterLoop AI API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:3000"
    cors_allow_credentials: bool = False

    database_url: str = "postgresql+psycopg://localhost:5432/writerloop"
    redis_url: str = "redis://redis:6379/0"
    qdrant_url: str = "http://qdrant:6333"
    task_execution_mode: str = "background"  # inline | background | celery
    max_upload_bytes: int = 20 * 1024 * 1024
    runtime_env_file_path: str = ".env"
    setup_access_token: str = ""

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"


def get_cors_origins(settings: Settings) -> list[str]:
    raw = settings.cors_origins.strip()
    if not raw:
        return ["http://localhost:3000"]
    return [item.strip() for item in raw.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
