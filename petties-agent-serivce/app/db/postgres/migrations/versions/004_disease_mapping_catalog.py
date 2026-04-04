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
        sa.Column("species", sa.String(length=50), nullable=False, server_default="all"),
        sa.Column("body_system", sa.String(length=100), nullable=True),
        sa.Column("protocol_key", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
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
        sa.Column("species", sa.String(length=50), nullable=False, server_default="all"),
        sa.Column("review_status", sa.String(length=50), nullable=False, server_default="approved"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
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
    op.create_index("ix_disease_aliases_canonical_code", "disease_aliases", ["canonical_code"], unique=False)
    op.create_index("ix_disease_aliases_source_type", "disease_aliases", ["source_type"], unique=False)
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
        sa.Column("species", sa.String(length=50), nullable=False, server_default="all"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("hit_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sample_payload", sa.JSON(), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
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

    disease_catalog = sa.table(
        "disease_catalog",
        sa.column("canonical_code", sa.String()),
        sa.column("display_name_vi", sa.String()),
        sa.column("species", sa.String()),
        sa.column("body_system", sa.String()),
        sa.column("protocol_key", sa.String()),
        sa.column("is_active", sa.Boolean()),
        sa.column("notes", sa.Text()),
    )
    op.bulk_insert(
        disease_catalog,
        [
            {
                "canonical_code": "ocular_infection",
                "display_name_vi": "Viêm kết mạc hoặc nhiễm trùng mắt",
                "species": "all",
                "body_system": "eye",
                "protocol_key": "ocular_infection",
                "is_active": True,
                "notes": "Nhóm bệnh mắt bề mặt cần phân biệt với nguy cơ loét giác mạc.",
            },
            {
                "canonical_code": "otitis_or_ear_parasites",
                "display_name_vi": "Viêm tai ngoài hoặc bệnh tai ký sinh trùng",
                "species": "all",
                "body_system": "ear",
                "protocol_key": "otitis_or_ear_parasites",
                "is_active": True,
                "notes": "Nhóm bệnh tai cần soi tai và đánh giá màng nhĩ trước khi nhỏ thuốc.",
            },
            {
                "canonical_code": "dermatosis_or_ectoparasites",
                "display_name_vi": "Viêm da hoặc bệnh da ký sinh trùng",
                "species": "all",
                "body_system": "skin",
                "protocol_key": "dermatosis_or_ectoparasites",
                "is_active": True,
                "notes": "Nhóm bệnh da cần cạo da hoặc soi da để phân biệt ký sinh trùng.",
            },
            {
                "canonical_code": "bacterial_dermatosis",
                "display_name_vi": "Viêm da do vi khuẩn",
                "species": "all",
                "body_system": "skin",
                "protocol_key": "bacterial_dermatosis",
                "is_active": True,
                "notes": "Nhóm viêm da nghi nhiễm khuẩn cần cytology trước khi ưu tiên kháng sinh toàn thân.",
            },
        ],
    )

    disease_aliases = sa.table(
        "disease_aliases",
        sa.column("canonical_code", sa.String()),
        sa.column("source_type", sa.String()),
        sa.column("alias_text", sa.String()),
        sa.column("normalized_alias", sa.String()),
        sa.column("species", sa.String()),
        sa.column("review_status", sa.String()),
        sa.column("is_active", sa.Boolean()),
    )
    alias_rows = []
    for source_type, alias_text, canonical_code, species in [
        ("emr", "viem da do vi khuan", "bacterial_dermatosis", "all"),
        ("vision", "bacterial dermatitis", "bacterial_dermatosis", "all"),
        ("kb", "viem da vi khuan", "bacterial_dermatosis", "all"),
        ("kb", "viêm da do vi khuẩn", "bacterial_dermatosis", "all"),
        ("emr", "viem ket mac", "ocular_infection", "all"),
        ("emr", "nhiem trung mat", "ocular_infection", "all"),
        ("vision", "conjunctivitis", "ocular_infection", "all"),
        ("vision", "eye infection", "ocular_infection", "all"),
        ("kb", "viem ket mac hoac nhiem trung mat", "ocular_infection", "all"),
        ("kb", "viêm kết mạc hoặc nhiễm trùng mắt", "ocular_infection", "all"),
        ("kb", "benh mat", "ocular_infection", "all"),
        ("emr", "viem tai ngoai", "otitis_or_ear_parasites", "all"),
        ("emr", "ghe tai", "otitis_or_ear_parasites", "all"),
        ("vision", "otitis externa", "otitis_or_ear_parasites", "all"),
        ("vision", "ear mites", "otitis_or_ear_parasites", "all"),
        ("kb", "viem tai ngoai hoac benh tai ky sinh trung", "otitis_or_ear_parasites", "all"),
        ("kb", "viêm tai ngoài hoặc bệnh tai ký sinh trùng", "otitis_or_ear_parasites", "all"),
        ("emr", "viem da", "dermatosis_or_ectoparasites", "all"),
        ("emr", "ghe", "dermatosis_or_ectoparasites", "all"),
        ("emr", "demodex", "dermatosis_or_ectoparasites", "all"),
        ("emr", "sarcoptes", "dermatosis_or_ectoparasites", "all"),
        ("vision", "dermatitis", "dermatosis_or_ectoparasites", "all"),
        ("vision", "demodicosis", "dermatosis_or_ectoparasites", "all"),
        ("vision", "sarcoptic mange", "dermatosis_or_ectoparasites", "all"),
        ("kb", "viem da hoac benh da ky sinh trung", "dermatosis_or_ectoparasites", "all"),
        ("kb", "viêm da hoặc bệnh da ký sinh trùng", "dermatosis_or_ectoparasites", "all"),
        ("kb", "benh da", "dermatosis_or_ectoparasites", "all"),
    ]:
        alias_rows.append(
            {
                "canonical_code": canonical_code,
                "source_type": source_type,
                "alias_text": alias_text,
                "normalized_alias": _normalize_text(alias_text),
                "species": species,
                "review_status": "approved",
                "is_active": True,
            }
        )
    op.bulk_insert(disease_aliases, alias_rows)


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
