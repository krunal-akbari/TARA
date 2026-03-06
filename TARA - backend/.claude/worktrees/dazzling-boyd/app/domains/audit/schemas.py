from pydantic import BaseModel


class ActivityEventResponse(BaseModel):
    id: int
    tenant_id: int
    entity_type: str
    entity_id: int
    event_type: str
    actor_user_id: int
    payload_json: dict


class ActivityEventListResponse(BaseModel):
    items: list[ActivityEventResponse]
    total: int
