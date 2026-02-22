"""Tâche RGPD — anonymisation des leads/contacts inactifs.

Usage :
    python -m app.tasks.gdpr_cleanup

Anonymise les contacts dont le lead d'origine est au statut "Nouveau"
et n'a pas été mis à jour depuis > 36 mois.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.models.contact import Contact
from app.models.lead import Lead
from app.services.contacts import anonymize_contact

logger = logging.getLogger(__name__)


async def run_gdpr_cleanup(engine: AsyncEngine | None = None) -> int:
    """
    Anonymise les contacts liés à des leads 'Nouveau' inactifs depuis > 36 mois.
    Retourne le nombre de contacts anonymisés.
    """
    settings = get_settings()
    if engine is None:
        engine = create_async_engine(settings.database_url)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)  # type: ignore[call-overload]

    cutoff = datetime.now(timezone.utc) - timedelta(days=36 * 30)  # ~36 mois
    anonymized = 0

    async with async_session() as db:
        # Trouver les leads inactifs
        stale_leads = await db.execute(
            select(Lead).where(
                Lead.deleted_at.is_(None),
                Lead.status == "Nouveau",
                Lead.updated_at <= cutoff,
            )
        )
        leads = stale_leads.scalars().all()
        logger.info("gdpr_cleanup.stale_leads", extra={"count": len(leads)})

        for lead in leads:
            # Trouver les contacts associés (s'il y en a)
            if not lead.contact_id:
                continue
            contact = await db.get(Contact, lead.contact_id)
            if contact and contact.deleted_at is None and contact.anonymized_at is None:
                await anonymize_contact(db, contact, actor_id=None)
                anonymized += 1

        await db.commit()

    logger.info("gdpr_cleanup.done", extra={"anonymized": anonymized})
    return anonymized


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    count = asyncio.run(run_gdpr_cleanup())
    print(f"RGPD cleanup : {count} contact(s) anonymisé(s).")
