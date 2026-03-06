from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.audit.service import record_event
from app.domains.client_vendor_links.models import ClientVendorLink
from app.domains.clients.models import Client
from app.domains.jobs.models import Job
from app.domains.routing.models import JobRoute, JobRouteTransition
from app.domains.vendors.models import Vendor
from app.platform.time import utcnow


def _node_exists(db: Session, *, tenant_id: int, node_type: str, node_id: int) -> bool:
    if node_type == "client":
        return (
            db.scalar(
                select(Client.id).where(
                    Client.tenant_id == tenant_id,
                    Client.id == node_id,
                    Client.deleted_at.is_(None),
                )
            )
            is not None
        )
    if node_type == "vendor":
        return (
            db.scalar(
                select(Vendor.id).where(
                    Vendor.tenant_id == tenant_id,
                    Vendor.id == node_id,
                    Vendor.deleted_at.is_(None),
                )
            )
            is not None
        )
    return False


def _has_active_link(db: Session, *, tenant_id: int, client_id: int, vendor_id: int) -> bool:
    link = db.scalar(
        select(ClientVendorLink).where(
            ClientVendorLink.tenant_id == tenant_id,
            ClientVendorLink.client_id == client_id,
            ClientVendorLink.vendor_id == vendor_id,
            ClientVendorLink.deleted_at.is_(None),
            ClientVendorLink.status == "active",
        )
    )
    return link is not None


def create_route_transition(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    job_id: int,
    to_node_type: str,
    to_node_id: int,
    reason: str,
    notes: str | None,
    idempotency_key: str | None,
) -> JobRouteTransition:
    job = db.scalar(select(Job).where(Job.tenant_id == tenant_id, Job.id == job_id, Job.deleted_at.is_(None)))
    if not job:
        raise ValueError("Job not found")

    if to_node_type not in {"client", "vendor"}:
        raise ValueError("Invalid node type")
    if not _node_exists(db, tenant_id=tenant_id, node_type=to_node_type, node_id=to_node_id):
        raise ValueError("Target node not found")

    if idempotency_key:
        existing = db.scalar(
            select(JobRouteTransition).where(
                JobRouteTransition.tenant_id == tenant_id,
                JobRouteTransition.job_id == job_id,
                JobRouteTransition.idempotency_key == idempotency_key,
            )
        )
        if existing:
            return existing

    route = db.scalar(select(JobRoute).where(JobRoute.tenant_id == tenant_id, JobRoute.job_id == job_id))

    from_type = route.current_node_type if route else None
    from_id = route.current_node_id if route else None

    if from_type and from_type != to_node_type:
        client_id = from_id if from_type == "client" else to_node_id
        vendor_id = from_id if from_type == "vendor" else to_node_id
        if not client_id or not vendor_id:
            raise ValueError("Invalid route transition context")
        if not _has_active_link(db, tenant_id=tenant_id, client_id=client_id, vendor_id=vendor_id):
            raise ValueError("No active client-vendor link for this transition")

    seq_no = (route.last_transition_seq + 1) if route else 1
    transition = JobRouteTransition(
        tenant_id=tenant_id,
        job_id=job_id,
        sequence_no=seq_no,
        from_node_type=from_type,
        from_node_id=from_id,
        to_node_type=to_node_type,
        to_node_id=to_node_id,
        reason=reason,
        notes=notes,
        actor_user_id=actor_user_id,
        idempotency_key=idempotency_key,
        occurred_at=utcnow(),
    )
    db.add(transition)

    if route is None:
        route = JobRoute(
            tenant_id=tenant_id,
            job_id=job_id,
            current_node_type=to_node_type,
            current_node_id=to_node_id,
            status="active",
            last_transition_seq=seq_no,
        )
        db.add(route)
    else:
        route.current_node_type = to_node_type
        route.current_node_id = to_node_id
        route.last_transition_seq = seq_no

    db.flush()
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="job_route",
        entity_id=str(transition.id),
        event_type="transitioned",
        actor_user_id=actor_user_id,
        payload={
            "job_id": job_id,
            "sequence_no": seq_no,
            "from_node_type": from_type,
            "from_node_id": from_id,
            "to_node_type": to_node_type,
            "to_node_id": to_node_id,
            "reason": reason,
        },
    )
    db.commit()
    db.refresh(transition)
    return transition


def list_transitions(
    db: Session,
    *,
    tenant_id: int,
    job_id: int,
    page: int,
    page_size: int,
) -> tuple[list[JobRouteTransition], int]:
    stmt = select(JobRouteTransition).where(
        JobRouteTransition.tenant_id == tenant_id,
        JobRouteTransition.job_id == job_id,
    )
    count_stmt = select(func.count()).select_from(JobRouteTransition).where(
        JobRouteTransition.tenant_id == tenant_id,
        JobRouteTransition.job_id == job_id,
    )
    stmt = stmt.order_by(JobRouteTransition.sequence_no.asc()).offset((page - 1) * page_size).limit(page_size)
    items = list(db.scalars(stmt).all())
    total = int(db.scalar(count_stmt) or 0)
    return items, total


def get_current_route(db: Session, *, tenant_id: int, job_id: int) -> JobRoute | None:
    return db.scalar(select(JobRoute).where(JobRoute.tenant_id == tenant_id, JobRoute.job_id == job_id))
