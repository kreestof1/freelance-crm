"""Utilitaire AuditLog — écriture des entrées de journal."""
from __future__ import annotations

import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog

logger = structlog.get_logger(__name__)


def _to_json_safe(obj: Any) -> Any:
    """Convertit récursivement un objet en types JSON-sérialisables."""
    if isinstance(obj, dict):
        return {k: _to_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_json_safe(v) for v in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, date):
        return obj.isoformat()
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


async def write_audit(
    db: AsyncSession,
    *,
    entity_type: str,
    entity_id: uuid.UUID,
    action: str,
    actor_id: uuid.UUID | None = None,
    actor_email: str | None = None,
    diff: dict[str, Any] | None = None,
    note: str | None = None,
) -> AuditLog:
    """Écrit une entrée AuditLog dans la session courante."""
    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_id=actor_id,
        actor_email=actor_email,
        diff_json=_to_json_safe(diff) if diff is not None else None,
        note=note,
    )
    db.add(entry)
    logger.info(
        "audit",
        entity_type=entity_type,
        entity_id=str(entity_id),
        action=action,
        actor=actor_email,
    )
    return entry
