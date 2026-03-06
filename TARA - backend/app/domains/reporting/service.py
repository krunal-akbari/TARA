from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.candidates.models import Candidate
from app.domains.client_vendor_links.models import ClientVendorLink
from app.domains.clients.models import Client
from app.domains.jobs.models import Job
from app.domains.routing.models import JobRouteTransition
from app.domains.vendors.models import Vendor


def operational_report(db: Session, *, tenant_id: int) -> dict:
    jobs_total = int(
        db.scalar(select(func.count()).select_from(Job).where(Job.tenant_id == tenant_id, Job.deleted_at.is_(None))) or 0
    )
    clients_total = int(
        db.scalar(select(func.count()).select_from(Client).where(Client.tenant_id == tenant_id, Client.deleted_at.is_(None)))
        or 0
    )
    vendors_total = int(
        db.scalar(select(func.count()).select_from(Vendor).where(Vendor.tenant_id == tenant_id, Vendor.deleted_at.is_(None)))
        or 0
    )
    candidates_total = int(
        db.scalar(
            select(func.count()).select_from(Candidate).where(Candidate.tenant_id == tenant_id, Candidate.deleted_at.is_(None))
        )
        or 0
    )
    active_links_total = int(
        db.scalar(
            select(func.count())
            .select_from(ClientVendorLink)
            .where(
                ClientVendorLink.tenant_id == tenant_id,
                ClientVendorLink.deleted_at.is_(None),
                ClientVendorLink.status == "active",
            )
        )
        or 0
    )
    route_transitions_total = int(
        db.scalar(
            select(func.count()).select_from(JobRouteTransition).where(JobRouteTransition.tenant_id == tenant_id)
        )
        or 0
    )

    reason_rows = db.execute(
        select(JobRouteTransition.reason, func.count())
        .where(JobRouteTransition.tenant_id == tenant_id)
        .group_by(JobRouteTransition.reason)
    ).all()
    route_reason_breakdown = {reason: int(count) for reason, count in reason_rows}

    return {
        "jobs_total": jobs_total,
        "clients_total": clients_total,
        "vendors_total": vendors_total,
        "candidates_total": candidates_total,
        "active_links_total": active_links_total,
        "route_transitions_total": route_transitions_total,
        "route_reason_breakdown": route_reason_breakdown,
    }
