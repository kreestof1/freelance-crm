"""0005 — Sprint 4 : indexes activités + GIN full-text search.

Revision ID: 0005
Revises: 0004
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Activities ────────────────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_activities_related ON activities (related_type, related_id) "
        "WHERE related_id IS NOT NULL"
    )
    op.execute(
        'CREATE INDEX IF NOT EXISTS ix_activities_when ON activities ("when")'
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_activities_reminder ON activities (reminder_at) "
        "WHERE reminder_sent = false AND reminder_at IS NOT NULL"
    )
    op.execute(
        'CREATE INDEX IF NOT EXISTS ix_activities_active ON activities ("when") '
        "WHERE deleted_at IS NULL"
    )

    # ── Full-text search — index GIN sur colonnes clés ─────────────────────────
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_contacts_fts ON contacts
        USING GIN (
            to_tsvector('french',
                coalesce(first_name,'') || ' ' ||
                coalesce(last_name,'') || ' ' ||
                coalesce(email,'') || ' ' ||
                coalesce(notes,'')
            )
        )
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_companies_fts ON companies
        USING GIN (
            to_tsvector('french',
                coalesce(name,'') || ' ' ||
                coalesce(sector,'') || ' ' ||
                coalesce(notes,'')
            )
        )
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_leads_fts ON leads
        USING GIN (
            to_tsvector('french',
                coalesce(name,'') || ' ' ||
                coalesce(email,'') || ' ' ||
                coalesce(interest,'') || ' ' ||
                coalesce(notes,'')
            )
        )
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_deals_fts ON deals
        USING GIN (
            to_tsvector('french',
                coalesce(title,'') || ' ' ||
                coalesce(notes,'')
            )
        )
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_projects_fts ON projects
        USING GIN (
            to_tsvector('french',
                coalesce(title,'') || ' ' ||
                coalesce(notes,'')
            )
        )
        WHERE deleted_at IS NULL
        """
    )



def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_projects_fts")
    op.execute("DROP INDEX IF EXISTS ix_deals_fts")
    op.execute("DROP INDEX IF EXISTS ix_leads_fts")
    op.execute("DROP INDEX IF EXISTS ix_companies_fts")
    op.execute("DROP INDEX IF EXISTS ix_contacts_fts")
    op.execute("DROP INDEX IF EXISTS ix_activities_active")
    op.execute("DROP INDEX IF EXISTS ix_activities_reminder")
    op.execute("DROP INDEX IF EXISTS ix_activities_when")
    op.execute("DROP INDEX IF EXISTS ix_activities_related")
