"""Router /contacts — CRUD + fusion + import CSV."""
import json
import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.contacts import (
    ContactCreate,
    ContactList,
    ContactMergeRequest,
    ContactOut,
    ContactUpdate,
    CsvColumnMapping,
    CsvImportResult,
)
from app.services.contacts import (
    create_contact,
    delete_contact,
    get_contact,
    list_contacts,
    merge_contacts,
    update_contact,
)
from app.services.csv_import import detect_mapping, import_contacts_csv

router = APIRouter()
logger = structlog.get_logger(__name__)
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
MAX_CSV_SIZE = 5 * 1024 * 1024  # 5 Mo


async def _get_or_404(db: DB, contact_id: uuid.UUID):
    contact = await get_contact(db, contact_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Contact introuvable"})
    return contact


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=ContactList)
async def list_contacts_endpoint(
    db: DB,
    current_user: CurrentUser,
    search: str | None = Query(default=None, max_length=200),
    tag: str | None = Query(default=None, max_length=100),
    company_id: uuid.UUID | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> ContactList:
    items, total = await list_contacts(db, search=search, tag=tag, company_id=company_id, page=page, page_size=page_size)
    return ContactList(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
async def create_contact_endpoint(db: DB, current_user: CurrentUser, body: ContactCreate) -> ContactOut:
    contact = await create_contact(db, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(contact)
    logger.info("contact.created", contact_id=str(contact.id))
    return ContactOut.model_validate(contact)


@router.get("/{contact_id}", response_model=ContactOut)
async def get_contact_endpoint(db: DB, current_user: CurrentUser, contact_id: uuid.UUID) -> ContactOut:
    contact = await _get_or_404(db, contact_id)
    return ContactOut.model_validate(contact)


@router.put("/{contact_id}", response_model=ContactOut)
async def update_contact_endpoint(db: DB, current_user: CurrentUser, contact_id: uuid.UUID, body: ContactUpdate) -> ContactOut:
    contact = await _get_or_404(db, contact_id)
    contact = await update_contact(db, contact, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(contact)
    return ContactOut.model_validate(contact)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact_endpoint(db: DB, current_user: CurrentUser, contact_id: uuid.UUID) -> None:
    contact = await _get_or_404(db, contact_id)
    await delete_contact(db, contact, actor_id=current_user.id)
    await db.commit()


# ── Fusion ────────────────────────────────────────────────────────────────────

@router.post("/merge", response_model=ContactOut)
async def merge_contacts_endpoint(db: DB, current_user: CurrentUser, body: ContactMergeRequest) -> ContactOut:
    if body.source_id == body.target_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"code": "SAME_CONTACT", "message": "source_id et target_id doivent être différents"})

    source = await get_contact(db, body.source_id)
    target = await get_contact(db, body.target_id)
    if not source:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": f"Contact source {body.source_id} introuvable"})
    if not target:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": f"Contact cible {body.target_id} introuvable"})

    merged = await merge_contacts(db, source=source, target=target, actor_id=current_user.id)
    await db.commit()
    await db.refresh(merged)
    logger.info("contact.merged", source=str(body.source_id), target=str(body.target_id))
    return ContactOut.model_validate(merged)


# ── Import CSV ────────────────────────────────────────────────────────────────

@router.post("/import/detect", response_model=CsvColumnMapping)
async def detect_csv_mapping(
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> CsvColumnMapping:
    """Étape 1 : analyse les en-têtes CSV et retourne le mapping détecté + 3 lignes d'aperçu."""
    raw = await file.read()
    if len(raw) > MAX_CSV_SIZE:
        raise HTTPException(status_code=413, detail={"code": "FILE_TOO_LARGE", "message": "CSV > 5 Mo"})
    _, mapping, sample_rows = detect_mapping(raw)
    return CsvColumnMapping(detected_mapping=mapping, sample_rows=sample_rows)


@router.post("/import", response_model=CsvImportResult)
async def import_csv_endpoint(
    db: DB,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    column_mapping: str = Form(...),  # JSON encodé
    all_or_nothing: bool = Form(default=False),
) -> CsvImportResult:
    """Étape 2 : importe les contacts avec le mapping confirmé."""
    raw = await file.read()
    if len(raw) > MAX_CSV_SIZE:
        raise HTTPException(status_code=413, detail={"code": "FILE_TOO_LARGE", "message": "CSV > 5 Mo"})
    try:
        mapping: dict[str, str] = json.loads(column_mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail={"code": "INVALID_MAPPING", "message": "column_mapping doit être du JSON valide"})

    result = await import_contacts_csv(db, raw, mapping, actor_id=current_user.id, all_or_nothing=all_or_nothing)
    await db.commit()
    logger.info("contact.csv_import", success=result.success, errors=len(result.errors))
    return result
