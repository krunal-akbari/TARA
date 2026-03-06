from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "TARA ATS Backend"
    env: str = "local"
    debug: bool = True

    database_url: str = "sqlite:///./tara.db"

    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 60 * 24 * 7
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"

    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    storage_backend: str = "local"
    local_storage_path: str = "./storage"
    aws_region: str = "us-east-1"
    aws_s3_bucket: str = "tara-resumes"

    bootstrap_api_key: str = "change-me"
    public_onboarding_keys: str = ""
    public_onboarding_allowed_emails: str = ""
    auto_create_tables: bool = True


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
