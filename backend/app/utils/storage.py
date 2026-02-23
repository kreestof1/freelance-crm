"""Utilitaires Azure Blob Storage — upload, SAS tokens."""
from __future__ import annotations

import mimetypes
import uuid
from datetime import datetime, timedelta, timezone

import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)

CONTAINER_MAP: dict[str, str] = {
    "Proposition": "documents-proposals",
    "Contrat": "documents-contracts",
    "Brief": "documents-other",
    "Autre": "documents-other",
}


def _get_container(doc_type: str) -> str:
    return CONTAINER_MAP.get(doc_type, "documents-other")


def build_blob_name(entity_type: str, entity_id: uuid.UUID, filename: str) -> str:
    """Construit le nom du blob : {entity_type}/{entity_id}/{uuid}_{filename}."""
    safe_filename = "".join(c if c.isalnum() or c in "._-" else "_" for c in filename)
    return f"{entity_type}/{entity_id}/{uuid.uuid4()}_{safe_filename}"


LOCAL_UPLOADS_DIR = "/app/local_uploads"


def resolve_download_url(file_uri: str, doc_type: str = "Autre") -> str | None:
    """Retourne l'URL de téléchargement (sync).

    - En dev (local://) : chemin vers le fichier statique servi par FastAPI.
    - En prod (chemin blob Azure) : utiliser generate_sas_url() (async) à la place.
    """
    if file_uri.startswith("local://"):
        path = file_uri.removeprefix("local://")
        return f"/api/v1/local-uploads/{path}"
    # En prod le blob_name seul n'est pas navigable sans SAS ; retourne None.
    return None


async def upload_blob(
    content: bytes,
    blob_name: str,
    doc_type: str = "Autre",
) -> str:
    """Upload un blob et retourne son URI (path, sans SAS)."""
    settings = get_settings()
    if not settings.azure_storage_url:
        import os
        dest = os.path.join(LOCAL_UPLOADS_DIR, blob_name)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as fh:
            fh.write(content)
        logger.info("storage.local_save", path=dest)
        return f"local://{blob_name}"

    try:
        from azure.identity.aio import DefaultAzureCredential
        from azure.storage.blob.aio import BlobServiceClient

        container = _get_container(doc_type)
        credential = DefaultAzureCredential()
        async with BlobServiceClient(
            account_url=settings.azure_storage_url, credential=credential
        ) as client:
            blob_client = client.get_blob_client(container=container, blob=blob_name)
            content_type = mimetypes.guess_type(blob_name)[0] or "application/octet-stream"
            await blob_client.upload_blob(content, overwrite=True, content_type=content_type)
        logger.info("storage.upload_ok", blob=blob_name, container=container)
        return blob_name
    except Exception as exc:
        logger.error("storage.upload_failed", blob=blob_name, error=str(exc))
        raise


async def generate_sas_url(blob_name: str, doc_type: str = "Autre", expire_hours: int = 1, document_id: str | None = None) -> str:
    """Génère une URL SAS valide {expire_hours}h pour un blob."""
    settings = get_settings()
    if not settings.azure_storage_url:
        # En dev : URL statique servie par FastAPI (via le proxy Vite), sans auth required
        path = blob_name.removeprefix("local://")
        return f"/api/v1/local-uploads/{path}"

    try:
        from azure.identity.aio import DefaultAzureCredential
        from azure.storage.blob import BlobSasPermissions, generate_blob_sas
        from azure.storage.blob.aio import BlobServiceClient

        container = _get_container(doc_type)
        credential = DefaultAzureCredential()
        async with BlobServiceClient(
            account_url=settings.azure_storage_url, credential=credential
        ) as client:
            user_delegation_key = await client.get_user_delegation_key(
                key_start_time=datetime.now(timezone.utc),
                key_expiry_time=datetime.now(timezone.utc) + timedelta(hours=expire_hours + 1),
            )
        sas = generate_blob_sas(
            account_name=settings.azure_storage_account_name,
            container_name=container,
            blob_name=blob_name,
            user_delegation_key=user_delegation_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(hours=expire_hours),
        )
        return f"{settings.azure_storage_url}/{container}/{blob_name}?{sas}"
    except Exception as exc:
        logger.error("storage.sas_failed", blob=blob_name, error=str(exc))
        raise
