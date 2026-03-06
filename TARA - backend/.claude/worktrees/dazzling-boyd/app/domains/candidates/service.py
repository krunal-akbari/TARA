import re

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.domains.access.service import can_manage_or_own
from app.domains.audit.service import record_event
from app.domains.candidates.models import Candidate
from app.platform.time import utcnow


def normalize_email(email: str | None) -> str | None:
    return email.strip().lower() if email else None


def normalize_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    return digits or None


def build_fingerprint(*, email: str | None, phone: str | None) -> str | None:
    email_part = normalize_email(email)
    phone_part = normalize_phone(phone)
    if not email_part and not phone_part:
        return None
    return f"{email_part or ''}|{phone_part or ''}"


def create_candidate(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    first_name: str,
    last_name: str,
    email: str | None,
    phone: str | None,
    current_company: str | None,
) -> Candidate:
    candidate = Candidate(
        tenant_id=tenant_id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        normalized_email=normalize_email(email),
        normalized_phone=normalize_phone(phone),
        dedupe_fingerprint=build_fingerprint(email=email, phone=phone),
        current_company=current_company,
        owner_user_id=actor_user_id,
    )
    db.add(candidate)
    db.flush()
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="candidate",
        entity_id=candidate.id,
        event_type="created",
        actor_user_id=actor_user_id,
        payload={"email": candidate.email, "phone": candidate.phone},
    )
    db.commit()
    db.refresh(candidate)
    return candidate


def list_candidates(db: Session, *, tenant_id: int, include_deleted: bool, page: int, page_size: int) -> tuple[list[Candidate], int]:
    stmt = select(Candidate).where(Candidate.tenant_id == tenant_id)
    count_stmt = select(func.count()).select_from(Candidate).where(Candidate.tenant_id == tenant_id)
    if not include_deleted:
        stmt = stmt.where(Candidate.deleted_at.is_(None))
        count_stmt = count_stmt.where(Candidate.deleted_at.is_(None))
    stmt = stmt.order_by(Candidate.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list(db.scalars(stmt).all())
    total = int(db.scalar(count_stmt) or 0)
    return items, total


def get_candidate(db: Session, *, tenant_id: int, candidate_id: int, include_deleted: bool = False) -> Candidate | None:
    stmt = select(Candidate).where(Candidate.tenant_id == tenant_id, Candidate.id == candidate_id)
    if not include_deleted:
        stmt = stmt.where(Candidate.deleted_at.is_(None))
    return db.scalar(stmt)


def update_candidate(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    roles: list[str],
    candidate: Candidate,
    first_name: str | None,
    last_name: str | None,
    email: str | None,
    phone: str | None,
    current_company: str | None,
) -> Candidate:
    if not can_manage_or_own(roles=roles, owner_user_id=candidate.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to update candidate")

    if first_name is not None:
        candidate.first_name = first_name
    if last_name is not None:
        candidate.last_name = last_name
    if email is not None:
        candidate.email = email
    if phone is not None:
        candidate.phone = phone
    if current_company is not None:
        candidate.current_company = current_company

    candidate.normalized_email = normalize_email(candidate.email)
    candidate.normalized_phone = normalize_phone(candidate.phone)
    candidate.dedupe_fingerprint = build_fingerprint(email=candidate.email, phone=candidate.phone)

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="candidate",
        entity_id=candidate.id,
        event_type="updated",
        actor_user_id=actor_user_id,
        payload={"email": candidate.email, "phone": candidate.phone},
    )
    db.commit()
    db.refresh(candidate)
    return candidate


def soft_delete_candidate(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    roles: list[str],
    candidate: Candidate,
) -> None:
    if not can_manage_or_own(roles=roles, owner_user_id=candidate.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to delete candidate")
    candidate.deleted_at = utcnow()
    candidate.deleted_by = actor_user_id
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="candidate",
        entity_id=candidate.id,
        event_type="deleted",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()


def restore_candidate(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    roles: list[str],
    candidate: Candidate,
) -> Candidate:
    if not can_manage_or_own(roles=roles, owner_user_id=candidate.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to restore candidate")
    candidate.deleted_at = None
    candidate.deleted_by = None
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="candidate",
        entity_id=candidate.id,
        event_type="restored",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()
    db.refresh(candidate)
    return candidate


def dedupe_matches(
    db: Session,
    *,
    tenant_id: int,
    email: str | None,
    phone: str | None,
    exclude_candidate_id: int | None = None,
) -> list[Candidate]:
    normalized_email = normalize_email(email)
    normalized_phone = normalize_phone(phone)

    filters = []
    if normalized_email:
        filters.append(Candidate.normalized_email == normalized_email)
    if normalized_phone:
        filters.append(Candidate.normalized_phone == normalized_phone)

    if not filters:
        return []

    stmt = select(Candidate).where(
        Candidate.tenant_id == tenant_id,
        Candidate.deleted_at.is_(None),
        or_(*filters),
    )
    if exclude_candidate_id:
        stmt = stmt.where(Candidate.id != exclude_candidate_id)

    if normalized_email and normalized_phone:
        stmt = stmt.order_by(
            and_(
                Candidate.normalized_email == normalized_email,
                Candidate.normalized_phone == normalized_phone,
            ).desc(),
            Candidate.created_at.desc(),
        )
    else:
        stmt = stmt.order_by(Candidate.created_at.desc())

    return list(db.scalars(stmt).all())
