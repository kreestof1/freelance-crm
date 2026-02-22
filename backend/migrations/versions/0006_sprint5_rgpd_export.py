"""0006 — Sprint 5 : RGPD — champs anonymisation sur contacts.

Revision ID: 0006
Revises: 0005
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Contacts : colonnes RGPD anonymisation ─────────────────────────────────
    op.add_column(
        "contacts",
        sa.Column("anonymized_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "contacts",
        sa.Column("anonymized_stats", JSONB, nullable=True),
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_contacts_anonymized_at "
        "ON contacts (anonymized_at) WHERE anonymized_at IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_contacts_anonymized_at")
    op.drop_column("contacts", "anonymized_stats")
    op.drop_column("contacts", "anonymized_at")
