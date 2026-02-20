"""Router /leads — CRUD + conversion Lead → Contact + Deal."""
import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.leads import (
    LeadConvertRequest,
    LeadConvertResult,
    LeadCreate,
    LeadList,
    LeadOut,
    LeadPatch,
)
from app.services.leads import (
    convert_lead,
    create_lead,
    delete_lead,
    get_lead,
    list_leads,
    patch_lead,
)

router = APIRouter()
logger = structlog.get_logger(__name__)
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def _get_or_404(db: DB, lead_id: uuid.UUID):
    lead = await get_lead(db, lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Lead introuvable"})
    return lead


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=LeadList)
async def list_leads_endpoint(
    db: DB,
    current_user: CurrentUser,
    status_filter: str | None = Query(default=None, alias="status"),
    source: str | None = Query(default=None, max_length=50),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> LeadList:
    items, total = await list_leads(db, status=status_filter, source=source, page=page, page_size=page_size)
    return LeadList(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
async def create_lead_endpoint(db: DB, current_user: CurrentUser, body: LeadCreate) -> LeadOut:
    lead = await create_lead(db, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(lead)
    logger.info("lead.created", lead_id=str(lead.id))
    return LeadOut.model_validate(lead)


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead_endpoint(db: DB, current_user: CurrentUser, lead_id: uuid.UUID) -> LeadOut:
    lead = await _get_or_404(db, lead_id)
    return LeadOut.model_validate(lead)


@router.patch("/{lead_id}", response_model=LeadOut)
async def patch_lead_endpoint(db: DB, current_user: CurrentUser, lead_id: uuid.UUID, body: LeadPatch) -> LeadOut:
    lead = await _get_or_404(db, lead_id)
    lead = await patch_lead(db, lead, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(lead)
    return LeadOut.model_validate(lead)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead_endpoint(db: DB, current_user: CurrentUser, lead_id: uuid.UUID) -> None:
    lead = await _get_or_404(db, lead_id)
    await delete_lead(db, lead, actor_id=current_user.id)
    await db.commit()


# ── Conversion ────────────────────────────────────────────────────────────────

@router.post("/{lead_id}/convert", response_model=LeadConvertResult, status_code=status.HTTP_201_CREATED)
async def convert_lead_endpoint(db: DB, current_user: CurrentUser, lead_id: uuid.UUID, body: LeadConvertRequest) -> LeadConvertResult:
    lead = await _get_or_404(db, lead_id)
    if lead.status == "Converti":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ALREADY_CONVERTED", "message": "Ce lead est déjà converti"},
        )
    result = await convert_lead(db, lead, body, actor_id=current_user.id)
    await db.commit()
    logger.info("lead.converted", lead_id=str(lead_id), contact_id=str(result.contact_id), deal_id=str(result.deal_id))
    return result
