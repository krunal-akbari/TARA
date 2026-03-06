from fastapi import HTTPException, status


def require_roles(current_roles: list[str], allowed_roles: set[str]) -> None:
    if not allowed_roles.intersection(set(current_roles)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")


def can_manage_or_own(*, roles: list[str], owner_user_id: int | None, actor_user_id: int) -> bool:
    privileged = {"admin", "manager"}
    if privileged.intersection(set(roles)):
        return True
    return owner_user_id == actor_user_id
