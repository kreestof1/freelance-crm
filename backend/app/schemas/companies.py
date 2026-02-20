"""Schémas Pydantic — Entreprises."""
import uuid
from typing import Annotated

from pydantic import BaseModel, Field, HttpUrl, model_validator


class AddressSchema(BaseModel):
    street: str | None = None
    city: str | None = None
    zip_code: str | None = None
    country: str | None = Field(default=None, max_length=2)


class CompanyBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    vat_number: str | None = Field(default=None, max_length=50)
    siren: str | None = Field(default=None, max_length=20)
    sector: str | None = Field(default=None, max_length=100)
    size: str | None = Field(default=None, max_length=50)
    website: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=10000)
    tags: list[str] = Field(default_factory=list)
    addresses: list[AddressSchema] = Field(default_factory=list)


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    vat_number: str | None = Field(default=None, max_length=50)
    siren: str | None = Field(default=None, max_length=20)
    sector: str | None = Field(default=None, max_length=100)
    size: str | None = Field(default=None, max_length=50)
    website: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=10000)
    tags: list[str] | None = None
    addresses: list[AddressSchema] | None = None


class CompanyOut(CompanyBase):
    id: uuid.UUID
    contacts_count: int = 0

    model_config = {"from_attributes": True}


class CompanyList(BaseModel):
    items: list[CompanyOut]
    total: int
    page: int
    page_size: int
