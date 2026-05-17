from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class JobCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str = Field(default="", max_length=4000)
    status: str = "draft"
    priority: Literal["hot", "warm", "warn", "cold"] = "warm"
    intake_channel: str = "direct_client"
    group_bu: str | None = Field(default=None, max_length=255)
    origin_client_id: int | None = None
    origin_vendor_id: int | None = None


class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    status: str | None = None
    priority: Literal["hot", "warm", "warn", "cold"] | None = None
    intake_channel: str | None = None
    group_bu: str | None = Field(default=None, max_length=255)


class JobResponse(BaseModel):
    id: int
    tenant_id: int
    title: str
    description: str
    status: str
    priority: str
    intake_channel: str
    group_bu: str | None = None
    origin_client_id: int | None = None
    origin_vendor_id: int | None = None
    owner_user_id: int
    applications_count: int = 0
    deleted_at: str | None = None


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int


class JobApplicationCreate(BaseModel):
    candidate_id: int


class JobApplicationUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=64)


class JobApplicationResponse(BaseModel):
    id: int
    tenant_id: int
    job_id: int
    candidate_id: int
    candidate_name: str
    status: str
    applied_by_user_id: int
    created_at: datetime


class JobApplicationListResponse(BaseModel):
    items: list[JobApplicationResponse]
    total: int


class CandidateJobApplicationResponse(BaseModel):
    id: int
    tenant_id: int
    job_id: int
    job_title: str
    candidate_id: int
    status: str
    applied_by_user_id: int
    created_at: datetime


class CandidateJobApplicationListResponse(BaseModel):
    items: list[CandidateJobApplicationResponse]
    total: int
