from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "TARA ATS Backend"
    env: str = "local"
    debug: bool = True

    database_url: str = "sqlite:///./tara.db"

    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 60 * 24 * 7
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"

    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    storage_backend: str = "local"
    local_storage_path: str = "./storage"
    max_resume_upload_bytes: int = 10 * 1024 * 1024
    resume_parser_backend: str = "native"
    resume_parser_allow_fallback: bool = True
    mineru_api_base_url: str = "http://mineru-api:8000"
    mineru_api_timeout_seconds: int = 120
    mineru_api_extract_path: str = "auto"
    mineru_api_candidate_paths: str = "/process-image,/parse,/extract,/api/v1/parse,/api/v1/extract,/convert,/api/v1/convert"
    mineru_api_file_field: str = "file"
    mineru_pdf_max_pages: int = 3
    mineru_pdf_render_scale: float = 2.0
    cors_origins: str = "http://localhost:3000"
    aws_region: str = "us-east-1"
    aws_s3_bucket: str = "tara-resumes"

    bootstrap_api_key: str
    public_onboarding_keys: str = ""
    public_onboarding_allowed_emails: str = ""
    auto_create_tables: bool = True


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
