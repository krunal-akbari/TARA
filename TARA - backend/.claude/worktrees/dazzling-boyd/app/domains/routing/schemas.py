from datetime import datetime

from pydantic import BaseModel, Field


class RouteTransitionCreate(BaseModel):
    to_node_type: str = Field(pattern="^(client|vendor)$")
    to_node_id: int
    reason: str = "manual_override"
    notes: str | None = Field(default=None, max_length=1000)


class RouteTransitionResponse(BaseModel):
    id: int
    tenant_id: int
    job_id: int
    sequence_no: int
    from_node_type: str | None = None
    from_node_id: int | None = None
    to_node_type: str
    to_node_id: int
    reason: str
    notes: str | None = None
    actor_user_id: int
    occurred_at: datetime


class RouteTransitionListResponse(BaseModel):
    items: list[RouteTransitionResponse]
    total: int


class CurrentRouteResponse(BaseModel):
    job_id: int
    current_node_type: str
    current_node_id: int
    status: str
    last_transition_seq: int
    updated_at: datetime
