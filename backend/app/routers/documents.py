"""Router /documents — upload fichier, lien externe, URL signée, soft-delete."""
from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.documents import DocumentCreate, DocumentList, DocumentOut
from app.services.documents import (
    create_document_from_link,
    create_document_from_upload,
    delete_document,
    get_document,
    get_document_with_url,
    list_all_documents,
    list_documents_for_entity,
)

router = APIRouter()
logger = structlog.get_logger(__name__)
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    db: DB,
    current_user: CurrentUser,
    # Champs de formulaire (multipart ou JSON selon la présence du fichier)
    doc_type: str = Form(default="Autre", alias="type"),
    related_type: str | None = Form(default=None),
    related_id: uuid.UUID | None = Form(default=None),
    external_url: str | None = Form(default=None),
    file: UploadFile | None = None,
) -> DocumentOut:
    """
    Upload un fichier (multipart/form-data) **ou** enregistrer un lien externe.

    - Avec `file` : le contenu est uploadé dans Azure Blob Storage (ou `local://` en dev).
    - Sans `file` : `external_url` est obligatoire (lien Google Drive / OneDrive).
    """
    filename = file.filename or "document" if file else "lien-externe"
    data = DocumentCreate(
        type=doc_type,  # type: ignore[arg-type]
        filename=filename,
        external_url=external_url,
        related_type=related_type,  # type: ignore[arg-type]
        related_id=related_id,
    )

    if file:
        content = await file.read()
        doc = await create_document_from_upload(db, data, content, actor_id=current_user.id)
    else:
        doc = await create_document_from_link(db, data, actor_id=current_user.id)

    await db.commit()
    await db.refresh(doc)
    logger.info("document.created", document_id=str(doc.id), filename=doc.filename)
    return DocumentOut.model_validate(doc)


@router.get("", response_model=DocumentList)
async def list_documents_endpoint(
    db: DB,
    current_user: CurrentUser,
    related_type: str | None = Query(default=None, max_length=30),
    related_id: uuid.UUID | None = Query(default=None),
    doc_type: str | None = Query(default=None, alias="type"),
) -> DocumentList:
    """Liste les documents.

    - Avec `related_type` + `related_id` : filtre par entité.
    - Sans filtres : liste globale (100 derniers documents).
    """
    if related_type and related_id:
        items = await list_documents_for_entity(db, related_type, related_id)
    else:
        items = await list_all_documents(db, doc_type=doc_type, related_type=related_type)
    return DocumentList(items=items, total=len(items))


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document_endpoint(
    db: DB, current_user: CurrentUser, document_id: uuid.UUID
) -> DocumentOut:
    """Métadonnées + URL signée (1h) valide pour téléchargement."""
    return await get_document_with_url(db, document_id)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_document_endpoint(
    db: DB, current_user: CurrentUser, document_id: uuid.UUID
) -> None:
    doc = await get_document(db, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Document introuvable"},
        )
    await delete_document(db, doc, actor_id=current_user.id)
    await db.commit()
    logger.info("document.deleted", document_id=str(document_id))
