from pydantic import BaseModel, EmailStr, Field


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    role: str = Field(min_length=1, max_length=64)


class UserItemResponse(BaseModel):
    id: int
    tenant_id: int
    email: str
    is_active: bool
    first_name: str | None = None
    last_name: str | None = None
    roles: list[str]


class UserListResponse(BaseModel):
    items: list[UserItemResponse]
    total: int
