from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.router import api_router
from app.platform.db import SessionLocal, ensure_storage_dir, init_db
from app.platform.rate_limiter import limiter
from app.platform.settings import get_settings

settings = get_settings()
app = FastAPI(title=settings.app_name, debug=settings.debug)
if not isinstance(limiter, Limiter):
    limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


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
