from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.platform.db import SessionLocal, ensure_storage_dir, init_db
from app.platform.settings import get_settings

settings = get_settings()
app = FastAPI(title=settings.app_name, debug=settings.debug)


@app.on_event("startup")
def on_startup() -> None:
    ensure_storage_dir()
    if settings.auto_create_tables:
        init_db()

    from app.domains.super_admin.service import seed_initial_super_admin

    db = SessionLocal()
    try:
        seed_initial_super_admin(db)
    finally:
        db.close()


@app.get("/health/live")
def live() -> dict:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> dict:
    return {"status": "ready"}


app.include_router(api_router)

_frontend_dir = Path(__file__).resolve().parent / "frontend"
if _frontend_dir.is_dir():
    app.mount("/admin", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
