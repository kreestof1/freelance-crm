"""Schémas Pydantic Auth."""
from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    # Utilise str (pas EmailStr) pour accepter les domaines locaux (.local, .test…)
    email: str = Field(max_length=320)
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # secondes


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str

    model_config = {"from_attributes": True}

    @field_validator("id", mode="before")
    @classmethod
    def coerce_uuid(cls, v: object) -> str:
        return str(v)
