"""Router /documents — upload fichier, lien externe, URL signée, soft-delete."""
from __future__ import annotations

import mimetypes
import os
import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
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
    file: UploadFile | None = File(default=None),
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


@router.get("/{document_id}/content")
async def download_document_content(
    db: DB, current_user: CurrentUser, document_id: uuid.UUID
) -> StreamingResponse:
    """Télécharge le contenu binaire d'un document (mode dev local uniquement)."""
    from app.utils.storage import LOCAL_UPLOADS_DIR

    doc = await get_document(db, document_id)
    if not doc or not doc.file_uri:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Document introuvable"},
        )
    if not doc.file_uri.startswith("local://"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "USE_SAS_URL", "message": "Utilisez l'URL signée pour les blobs Azure"},
        )
    blob_name = doc.file_uri.removeprefix("local://")
    path = os.path.join(LOCAL_UPLOADS_DIR, blob_name)
    if not os.path.isfile(path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "FILE_NOT_FOUND", "message": "Fichier introuvable sur le serveur"},
        )
    mime = doc.mime_type or mimetypes.guess_type(doc.filename)[0] or "application/octet-stream"

    def _iter():
        with open(path, "rb") as fh:
            yield from iter(lambda: fh.read(65536), b"")

    return StreamingResponse(
        _iter(),
        media_type=mime,
        headers={"Content-Disposition": f'inline; filename="{doc.filename}"'},
    )


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
