from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.reporting.schemas import OperationalReportResponse
from app.domains.reporting.service import operational_report
from app.platform.db import get_db
from app.platform.dependencies import get_current_user

router = APIRouter(prefix="/reports", tags=["Reporting"])


@router.get("/operational", response_model=OperationalReportResponse)
def operational_report_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OperationalReportResponse:
    return OperationalReportResponse(**operational_report(db=db, tenant_id=current_user.tenant_id))
