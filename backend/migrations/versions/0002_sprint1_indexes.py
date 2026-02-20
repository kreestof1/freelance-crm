"""0002_sprint1_indexes

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-20

Sprint 1 — Indexes supplémentaires pour les recherches Contacts / Entreprises / Leads.
"""
from __future__ import annotations

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Companies — index nom pour ILIKE rapide ─────────────────────────────────
    op.execute("CREATE INDEX IF NOT EXISTS ix_companies_name ON companies (lower(name))")
    op.execute("CREATE INDEX IF NOT EXISTS ix_companies_sector ON companies (lower(sector))")

    # ── Leads — indexes status + source + email ─────────────────────────────────
    op.execute("CREATE INDEX IF NOT EXISTS ix_leads_status ON leads (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_leads_source ON leads (source)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_leads_created_at ON leads (created_at DESC)")

    # ── Contacts — GIN sur tags (si absent) + index prénom/nom ─────────────────
    op.execute("CREATE INDEX IF NOT EXISTS ix_contacts_name ON contacts (lower(last_name), lower(first_name))")

    # ── Companies — GIN sur tags ────────────────────────────────────────────────
    op.execute("CREATE INDEX IF NOT EXISTS ix_companies_tags_gin ON companies USING GIN (tags)")

    # ── Leads — GIN sur tags ────────────────────────────────────────────────────
    op.execute("CREATE INDEX IF NOT EXISTS ix_leads_tags_gin ON leads USING GIN (tags)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_companies_name")
    op.execute("DROP INDEX IF EXISTS ix_companies_sector")
    op.execute("DROP INDEX IF EXISTS ix_leads_status")
    op.execute("DROP INDEX IF EXISTS ix_leads_source")
    op.execute("DROP INDEX IF EXISTS ix_leads_created_at")
    op.execute("DROP INDEX IF EXISTS ix_contacts_name")
    op.execute("DROP INDEX IF EXISTS ix_companies_tags_gin")
    op.execute("DROP INDEX IF EXISTS ix_leads_tags_gin")
