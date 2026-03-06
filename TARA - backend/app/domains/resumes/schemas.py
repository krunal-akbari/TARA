from datetime import datetime

from pydantic import BaseModel


class ResumeResponse(BaseModel):
    id: int
    tenant_id: int
    candidate_id: int
    storage_key: str
    file_name: str
    content_type: str
    size_bytes: int
    parse_status: str
    uploaded_by: int
    created_at: datetime


class ResumeListResponse(BaseModel):
    items: list[ResumeResponse]
    total: int


class ResumeExtractResponse(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    current_company: str | None = None


class ResumeTextPreviewResponse(BaseModel):
    text: str
