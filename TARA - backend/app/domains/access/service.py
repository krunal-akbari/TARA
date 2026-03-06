from fastapi import HTTPException, status


def require_roles(current_roles: list[str], allowed_roles: set[str]) -> None:
    normalized_current = {str(role).strip().lower() for role in current_roles if role}
    normalized_allowed = {str(role).strip().lower() for role in allowed_roles if role}
    if not normalized_allowed.intersection(normalized_current):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")


def can_manage_or_own(*, roles: list[str], owner_user_id: int | None, actor_user_id: int) -> bool:
    privileged = {"admin", "manager"}
    normalized_roles = {str(role).strip().lower() for role in roles if role}
    if privileged.intersection(normalized_roles):
        return True
    return owner_user_id == actor_user_id
