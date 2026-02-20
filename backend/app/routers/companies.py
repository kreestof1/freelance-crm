"""Router /companies."""
import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import Pagination, get_current_user
from app.models.user import User
from app.schemas.companies import CompanyCreate, CompanyList, CompanyOut, CompanyUpdate
from app.services.companies import (
    create_company,
    delete_company,
    get_company,
    list_companies,
    update_company,
)

router = APIRouter()
logger = structlog.get_logger(__name__)
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_or_404(db: DB, company_id: uuid.UUID):
    company = await get_company(db, company_id)
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Entreprise introuvable"})
    return company


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=CompanyList)
async def list_companies_endpoint(
    db: DB,
    current_user: CurrentUser,
    search: str | None = Query(default=None, max_length=200),
    tag: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> CompanyList:
    items, total = await list_companies(db, search=search, tag=tag, page=page, page_size=page_size)
    return CompanyList(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
async def create_company_endpoint(db: DB, current_user: CurrentUser, body: CompanyCreate) -> CompanyOut:
    company = await create_company(db, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(company)
    logger.info("company.created", company_id=str(company.id))
    out = CompanyOut.model_validate(company)
    out.contacts_count = 0
    return out


@router.get("/{company_id}", response_model=CompanyOut)
async def get_company_endpoint(db: DB, current_user: CurrentUser, company_id: uuid.UUID) -> CompanyOut:
    company = await _get_or_404(db, company_id)
    items, _ = await list_companies(db, page=1, page_size=1)  # get count via list
    # More efficient: count directly
    from sqlalchemy import func, select
    from app.models.contact import Contact
    cnt_row = await db.execute(
        select(func.count()).where(Contact.company_id == company_id, Contact.deleted_at.is_(None))
    )
    cnt = cnt_row.scalar_one()
    out = CompanyOut.model_validate(company)
    out.contacts_count = cnt
    return out


@router.put("/{company_id}", response_model=CompanyOut)
async def update_company_endpoint(db: DB, current_user: CurrentUser, company_id: uuid.UUID, body: CompanyUpdate) -> CompanyOut:
    company = await _get_or_404(db, company_id)
    company = await update_company(db, company, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(company)
    out = CompanyOut.model_validate(company)
    return out


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company_endpoint(db: DB, current_user: CurrentUser, company_id: uuid.UUID) -> None:
    company = await _get_or_404(db, company_id)
    await delete_company(db, company, actor_id=current_user.id)
    await db.commit()
