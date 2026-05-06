from fastapi import APIRouter

from app.domains.audit.api import router as audit_router
from app.domains.auth.api import router as auth_router
from app.domains.candidates.api import router as candidates_router
from app.domains.client_vendor_links.api import router as links_router
from app.domains.clients.api import router as clients_router
from app.domains.jobs.api import router as jobs_router
from app.domains.reporting.api import router as reporting_router
from app.domains.resumes.api import extract_router as resume_extract_router
from app.domains.resumes.api import router as resumes_router
from app.domains.routing.api import router as routing_router
from app.domains.super_admin.api import router as super_admin_router
from app.domains.tenancy.api import public_router as tenancy_public_router
from app.domains.tenancy.api import router as tenancy_router
from app.domains.tenancy.api import tenant_settings_router
from app.domains.users.api import router as users_router
from app.domains.vendors.api import router as vendors_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(super_admin_router)
api_router.include_router(auth_router)
api_router.include_router(tenancy_router)
api_router.include_router(tenancy_public_router)
api_router.include_router(tenant_settings_router)
api_router.include_router(users_router)
api_router.include_router(clients_router)
api_router.include_router(vendors_router)
api_router.include_router(links_router)
api_router.include_router(jobs_router)
api_router.include_router(routing_router)
api_router.include_router(candidates_router)
api_router.include_router(resumes_router)
api_router.include_router(resume_extract_router)
api_router.include_router(audit_router)
api_router.include_router(reporting_router)
