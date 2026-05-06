# TARA ATS Backend

Multi-tenant ATS backend supporting:
- many-to-many client-vendor mapping
- repeatable job routing loops with immutable transition history
- candidate dedupe and resume uploads
- audit timeline and operational reporting

## Stack
- FastAPI
- SQLAlchemy + Alembic
- PostgreSQL (recommended), SQLite for local quick start
- Redis + Celery

## Quick Start
1. Copy `.env.example` to `.env`.
2. Install dependencies:
   ```bash
   python -m pip install .[dev]
   ```
   For legacy `.doc` resume parsing outside Docker, install `antiword` on the backend host.
3. Run API:
   ```bash
   uvicorn app.main:app --reload
   ```
4. Configure onboarding keys in `.env` for restricted public onboarding:
   ```env
   PUBLIC_ONBOARDING_KEYS=public-key-1,public-key-2
   PUBLIC_ONBOARDING_ALLOWED_EMAILS=public-admin@example.com,admin@example.com
   ```
5. Onboard first tenant/admin:
   Public route:
   ```bash
   curl -X POST http://localhost:8000/api/v1/public/onboarding \
     -H "Content-Type: application/json" \
     -H "X-Onboarding-Key: public-key-1" \
     -d '{"tenant_name":"demo","admin_email":"public-admin@example.com","admin_password":"Password123!"}'
   ```
   Admin bootstrap route:
   ```bash
   curl -X POST http://localhost:8000/api/v1/admin/tenants/bootstrap \
     -H "Content-Type: application/json" \
     -H "X-Bootstrap-Key: change-me" \
     -d '{"tenant_name":"demo","admin_email":"admin@example.com","admin_password":"Password123!"}'
   ```

## API Docs
- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

## Postman
- Collection: `postman/TARA-ATS-Backend.postman_collection.json`
- Environment: `postman/TARA-ATS-Local.postman_environment.json`
- Setup and run guide: `docs/POSTMAN_GUIDE.md`

## Detailed Documentation
- Module and architecture overview: `docs/MODULES.md`
- API index: `docs/API_REFERENCE.md`
- Module and endpoint split docs: `docs/api/README.md`

## Docker
```bash
docker compose up --build
```

## Tests
```bash
pytest
```

## Module Layout
- `app/domains/*`: domain modules (`models`, `schemas`, `service`, `api`)
- `app/platform/*`: config, db, security, shared dependencies
- `app/tasks/*`: celery tasks
