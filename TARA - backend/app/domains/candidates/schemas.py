from pydantic import BaseModel, EmailStr, Field


class CandidateCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    group_bu: str | None = Field(default=None, max_length=255)
    current_company: str | None = Field(default=None, max_length=255)


class CandidateUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    group_bu: str | None = Field(default=None, max_length=255)
    current_company: str | None = Field(default=None, max_length=255)
    hr_notes_general: str | None = Field(default=None, max_length=4000)
    hr_notes_status: str | None = Field(default=None, max_length=4000)
    hr_notes_pay: str | None = Field(default=None, max_length=4000)
    hr_notes_notes: str | None = Field(default=None, max_length=4000)


class CandidateResponse(BaseModel):
    id: int
    tenant_id: int
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
    group_bu: str | None = None
    current_company: str | None = None
    hr_notes_general: str | None = None
    hr_notes_status: str | None = None
    hr_notes_pay: str | None = None
    hr_notes_notes: str | None = None
    owner_user_id: int
    dedupe_fingerprint: str | None = None
    deleted_at: str | None = None


class CandidateListResponse(BaseModel):
    items: list[CandidateResponse]
    total: int


class DedupeCheckResponse(BaseModel):
    matches: list[CandidateResponse]
    total_matches: int
