import os
from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.platform.settings import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(settings.database_url, future=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_storage_dir() -> None:
    os.makedirs(settings.local_storage_path, exist_ok=True)


def init_db() -> None:
    # Import models before create_all so metadata is fully populated.
    from app.platform import models_registry  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_jobs_priority_column()
    _ensure_jobs_group_bu_column()
    _ensure_candidate_hr_notes_columns()
    _ensure_candidate_group_bu_column()
    _ensure_tenant_resume_upload_limit_column()


def _ensure_jobs_priority_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("jobs"):
        return

    job_columns = {column["name"] for column in inspector.get_columns("jobs")}
    if "priority" in job_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE jobs ADD COLUMN priority VARCHAR(16) NOT NULL DEFAULT 'warm'"))


def _ensure_jobs_group_bu_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("jobs"):
        return

    job_columns = {column["name"] for column in inspector.get_columns("jobs")}
    if "group_bu" in job_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE jobs ADD COLUMN group_bu VARCHAR(255)"))


def _ensure_candidate_hr_notes_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("candidates"):
        return

    candidate_columns = {column["name"] for column in inspector.get_columns("candidates")}
    required = (
        "hr_notes_general",
        "hr_notes_status",
        "hr_notes_pay",
        "hr_notes_notes",
    )

    with engine.begin() as connection:
        for column_name in required:
            if column_name not in candidate_columns:
                connection.execute(text(f"ALTER TABLE candidates ADD COLUMN {column_name} TEXT"))

        refreshed = inspect(engine)
        refreshed_columns = {column["name"] for column in refreshed.get_columns("candidates")}
        if "hr_notes" in refreshed_columns and "hr_notes_general" in refreshed_columns:
            connection.execute(
                text(
                    """
                    UPDATE candidates
                    SET hr_notes_general = hr_notes
                    WHERE (hr_notes_general IS NULL OR TRIM(hr_notes_general) = '')
                      AND hr_notes IS NOT NULL
                      AND TRIM(hr_notes) <> ''
                    """
                )
            )


def _ensure_candidate_group_bu_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("candidates"):
        return

    candidate_columns = {column["name"] for column in inspector.get_columns("candidates")}
    if "group_bu" in candidate_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE candidates ADD COLUMN group_bu VARCHAR(255)"))


def _ensure_tenant_resume_upload_limit_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("tenants"):
        return

    tenant_columns = {column["name"] for column in inspector.get_columns("tenants")}
    if "resume_upload_max_bytes" in tenant_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE tenants ADD COLUMN resume_upload_max_bytes INTEGER"))
