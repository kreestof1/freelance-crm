"""0004_sprint3_projects_documents_indexes

Revision ID: 0004
Revises: 0003
Create Date: 2026-02-22

Sprint 3 — Index de performance pour Projects, Milestones et Documents.
Les tables ont été créées en 0001 (schéma initial complet).
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Projects ──────────────────────────────────────────────────────────────
    op.execute("CREATE INDEX IF NOT EXISTS ix_projects_company_id ON projects (company_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_projects_deal_id ON projects (deal_id) WHERE deal_id IS NOT NULL")
    op.execute("CREATE INDEX IF NOT EXISTS ix_projects_created_at ON projects (created_at DESC)")
    # Index partiel sur les missions non supprimées
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_projects_active ON projects (status, created_at DESC) "
        "WHERE deleted_at IS NULL"
    )

    # ── Milestones ────────────────────────────────────────────────────────────
    # Index pour jalons à venir (dashboard missions)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_milestones_due_date ON milestones (due_date ASC NULLS LAST) "
        "WHERE status != 'Done'"
    )

    # ── Documents ─────────────────────────────────────────────────────────────
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_created_at ON documents (created_at DESC)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_documents_active ON documents (related_type, related_id, created_at DESC) "
        "WHERE deleted_at IS NULL"
    )

    # ── AuditLog Sprint 3 ─────────────────────────────────────────────────────
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_entity_sprint3 "
        "ON audit_logs (entity_type, entity_id, created_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_audit_logs_entity_sprint3")
    op.execute("DROP INDEX IF EXISTS ix_documents_active")
    op.execute("DROP INDEX IF EXISTS ix_documents_created_at")
    op.execute("DROP INDEX IF EXISTS ix_milestones_due_date")
    op.execute("DROP INDEX IF EXISTS ix_projects_active")
    op.execute("DROP INDEX IF EXISTS ix_projects_created_at")
    op.execute("DROP INDEX IF EXISTS ix_projects_deal_id")
    op.execute("DROP INDEX IF EXISTS ix_projects_company_id")
