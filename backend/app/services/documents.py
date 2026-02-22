"""Service Documents — upload, métadonnées, URL signée."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.schemas.documents import DocumentCreate, DocumentOut
from app.utils.audit import write_audit
from app.utils.storage import build_blob_name, generate_sas_url, upload_blob


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def get_document(db: AsyncSession, document_id: uuid.UUID) -> Document | None:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def list_documents_for_entity(
    db: AsyncSession,
    related_type: str,
    related_id: uuid.UUID,
) -> list[DocumentOut]:
    rows = await db.execute(
        select(Document).where(
            Document.related_type == related_type,
            Document.related_id == related_id,
            Document.deleted_at.is_(None),
        ).order_by(Document.created_at.desc())
    )
    return [DocumentOut.model_validate(d) for d in rows.scalars()]


async def list_all_documents(
    db: AsyncSession,
    *,
    doc_type: str | None = None,
    related_type: str | None = None,
    limit: int = 100,
) -> list[DocumentOut]:
    """Liste globale des documents (page Documents du CRM)."""
    from sqlalchemy import and_
    conditions = [Document.deleted_at.is_(None)]
    if doc_type:
        conditions.append(Document.type == doc_type)
    if related_type:
        conditions.append(Document.related_type == related_type)
    rows = await db.execute(
        select(Document)
        .where(and_(*conditions))
        .order_by(Document.created_at.desc())
        .limit(limit)
    )
    return [DocumentOut.model_validate(d) for d in rows.scalars()]


async def create_document_from_upload(
    db: AsyncSession,
    data: DocumentCreate,
    content: bytes,
    actor_id: uuid.UUID | None = None,
) -> Document:
    """Upload un fichier et crée le Document."""
    blob_name = build_blob_name(
        entity_type=data.related_type or "other",
        entity_id=data.related_id or uuid.uuid4(),
        filename=data.filename,
    )
    import mimetypes
    mime = mimetypes.guess_type(data.filename)[0]

    file_uri = await upload_blob(content, blob_name, doc_type=data.type)

    doc = Document(
        type=data.type,
        filename=data.filename,
        file_uri=file_uri,
        external_url=None,
        mime_type=mime,
        size_bytes=len(content),
        related_type=data.related_type,
        related_id=data.related_id,
    )
    db.add(doc)
    await db.flush()
    await write_audit(db, entity_type="document", entity_id=doc.id, action="create", actor_id=actor_id)
    return doc


async def create_document_from_link(
    db: AsyncSession,
    data: DocumentCreate,
    actor_id: uuid.UUID | None = None,
) -> Document:
    """Enregistre un lien externe (Google Drive, OneDrive…)."""
    if not data.external_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "MISSING_URL", "message": "external_url est requis sans fichier"},
        )
    doc = Document(
        type=data.type,
        filename=data.filename,
        file_uri=None,
        external_url=data.external_url,
        mime_type=None,
        size_bytes=None,
        related_type=data.related_type,
        related_id=data.related_id,
    )
    db.add(doc)
    await db.flush()
    await write_audit(db, entity_type="document", entity_id=doc.id, action="create", actor_id=actor_id)
    return doc


async def get_document_with_url(db: AsyncSession, document_id: uuid.UUID) -> DocumentOut:
    """Retourne les métadonnées + une URL signée (1h) si le fichier est en blob."""
    doc = await get_document(db, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Document introuvable"},
        )
    out = DocumentOut.model_validate(doc)
    if doc.file_uri:
        try:
            out.signed_url = await generate_sas_url(doc.file_uri, doc_type=doc.type)
        except Exception:
            # En dev local (pas de storage Azure), retourne l'URI brut
            out.signed_url = doc.file_uri
    elif doc.external_url:
        out.signed_url = doc.external_url
    return out


async def delete_document(
    db: AsyncSession, doc: Document, actor_id: uuid.UUID | None = None
) -> None:
    from datetime import datetime, timezone
    doc.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    await write_audit(db, entity_type="document", entity_id=doc.id, action="delete", actor_id=actor_id)
