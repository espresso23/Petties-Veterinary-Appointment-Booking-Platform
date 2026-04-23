"""Add disease mapping catalog, aliases, and review queue

Revision ID: 004_disease_mapping_catalog
Revises: 003_kb_image_count
Create Date: 2026-03-18 18:30:00.000000

"""

from __future__ import annotations

import unicodedata

from alembic import op
import sqlalchemy as sa

revision = "004_disease_mapping_catalog"
down_revision = "003_kb_image_count"
branch_labels = None
depends_on = None


def _normalize_text(value: str) -> str:
    text = (value or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in text)
    return " ".join(text.split())


def upgrade() -> None:
    op.create_table(
        "disease_catalog",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("canonical_code", sa.String(length=100), nullable=False),
        sa.Column("display_name_vi", sa.String(length=255), nullable=False),
        sa.Column(
            "species", sa.String(length=50), nullable=False, server_default="all"
        ),
        sa.Column("body_system", sa.String(length=100), nullable=True),
        sa.Column("protocol_key", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("canonical_code"),
    )
    op.create_index(
        "ix_disease_catalog_canonical_code",
        "disease_catalog",
        ["canonical_code"],
        unique=True,
    )

    op.create_table(
        "disease_aliases",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("canonical_code", sa.String(length=100), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("alias_text", sa.String(length=255), nullable=False),
        sa.Column("normalized_alias", sa.String(length=255), nullable=False),
        sa.Column(
            "species", sa.String(length=50), nullable=False, server_default="all"
        ),
        sa.Column(
            "review_status",
            sa.String(length=50),
            nullable=False,
            server_default="approved",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["canonical_code"],
            ["disease_catalog.canonical_code"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_type",
            "normalized_alias",
            "species",
            name="uq_disease_alias_source_normalized_species",
        ),
    )
    op.create_index(
        "ix_disease_aliases_canonical_code",
        "disease_aliases",
        ["canonical_code"],
        unique=False,
    )
    op.create_index(
        "ix_disease_aliases_source_type",
        "disease_aliases",
        ["source_type"],
        unique=False,
    )
    op.create_index(
        "ix_disease_aliases_normalized_alias",
        "disease_aliases",
        ["normalized_alias"],
        unique=False,
    )

    op.create_table(
        "disease_mapping_review_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("raw_label", sa.String(length=255), nullable=False),
        sa.Column("normalized_label", sa.String(length=255), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column(
            "species", sa.String(length=50), nullable=False, server_default="all"
        ),
        sa.Column(
            "status", sa.String(length=50), nullable=False, server_default="pending"
        ),
        sa.Column("hit_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sample_payload", sa.JSON(), nullable=True),
        sa.Column(
            "first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_type",
            "normalized_label",
            "species",
            name="uq_disease_mapping_review_source_normalized_species",
        ),
    )
    op.create_index(
        "ix_disease_mapping_review_items_normalized_label",
        "disease_mapping_review_items",
        ["normalized_label"],
        unique=False,
    )
    op.create_index(
        "ix_disease_mapping_review_items_source_type",
        "disease_mapping_review_items",
        ["source_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_disease_mapping_review_items_source_type",
        table_name="disease_mapping_review_items",
    )
    op.drop_index(
        "ix_disease_mapping_review_items_normalized_label",
        table_name="disease_mapping_review_items",
    )
    op.drop_table("disease_mapping_review_items")

    op.drop_index("ix_disease_aliases_normalized_alias", table_name="disease_aliases")
    op.drop_index("ix_disease_aliases_source_type", table_name="disease_aliases")
    op.drop_index("ix_disease_aliases_canonical_code", table_name="disease_aliases")
    op.drop_table("disease_aliases")

    op.drop_index("ix_disease_catalog_canonical_code", table_name="disease_catalog")
    op.drop_table("disease_catalog")
