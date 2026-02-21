"""0003_sprint2_pipeline_deals

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-21

Sprint 2 — Table pipeline_stages + indexes Deals.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

# Étapes par défaut
DEFAULT_STAGES = [
    ("Découverte",   1, 10,  False, False, "#90CAF9"),
    ("Qualification", 2, 25, False, False, "#81D4FA"),
    ("Proposition",  3, 50,  False, False, "#FFE082"),
    ("Négociation",  4, 75,  False, False, "#FFCC02"),
    ("Gagné",        5, 100, True,  True,  "#A5D6A7"),
    ("Perdu",        6, 0,   True,  False, "#EF9A9A"),
]


def upgrade() -> None:
    # ── Table pipeline_stages ──────────────────────────────────────────────────
    op.create_table(
        "pipeline_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("default_probability", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_closed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_won", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pipeline_stages_order", "pipeline_stages", ["order"])

    # ── Seed des étapes par défaut ─────────────────────────────────────────────
    stages_table = sa.table(
        "pipeline_stages",
        sa.column("id", postgresql.UUID()),
        sa.column("name", sa.String),
        sa.column("order", sa.Integer),
        sa.column("default_probability", sa.Integer),
        sa.column("is_closed", sa.Boolean),
        sa.column("is_won", sa.Boolean),
        sa.column("color", sa.String),
    )
    import uuid
    op.bulk_insert(
        stages_table,
        [
            {
                "id": str(uuid.uuid4()),
                "name": name,
                "order": order,
                "default_probability": prob,
                "is_closed": closed,
                "is_won": won,
                "color": color,
            }
            for name, order, prob, closed, won, color in DEFAULT_STAGES
        ],
    )

    # ── Colonne is_locked sur deals (si absente) ───────────────────────────────
    # La colonne est déjà dans le modèle Deal (sprint 0), vérification uniquement
    op.execute(
        "ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false"
    )

    # ── Indexes Deals ──────────────────────────────────────────────────────────
    op.execute("CREATE INDEX IF NOT EXISTS ix_deals_stage ON deals (stage)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_deals_expected_close ON deals (expected_close)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_deals_company_id ON deals (company_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_deals_created_at ON deals (created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_deals_tags_gin ON deals USING GIN (tags)")

    # ── Index AuditLog pour recherche par entité ───────────────────────────────
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_entity ON audit_logs (entity_type, entity_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_audit_logs_entity")
    op.execute("DROP INDEX IF EXISTS ix_deals_tags_gin")
    op.execute("DROP INDEX IF EXISTS ix_deals_created_at")
    op.execute("DROP INDEX IF EXISTS ix_deals_company_id")
    op.execute("DROP INDEX IF EXISTS ix_deals_expected_close")
    op.execute("DROP INDEX IF EXISTS ix_deals_stage")
    op.drop_index("ix_pipeline_stages_order", table_name="pipeline_stages")
    op.drop_table("pipeline_stages")
