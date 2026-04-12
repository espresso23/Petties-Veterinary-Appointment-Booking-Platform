"""Drop legacy disease mapping review queue and unused columns.

Version: 008
"""

from alembic import op
import sqlalchemy as sa


revision = "008_drop_disease_review"
down_revision = "007_add_web_search_setting"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(
        "ix_disease_mapping_review_items_source_type",
        table_name="disease_mapping_review_items",
    )
    op.drop_index(
        "ix_disease_mapping_review_items_normalized_label",
        table_name="disease_mapping_review_items",
    )
    op.drop_table("disease_mapping_review_items")

    op.drop_column("disease_catalog", "body_system")
    op.drop_column("disease_catalog", "protocol_key")
    op.drop_column("disease_aliases", "review_status")


def downgrade() -> None:
    op.add_column(
        "disease_catalog",
        sa.Column("body_system", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "disease_catalog",
        sa.Column("protocol_key", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "disease_aliases",
        sa.Column(
            "review_status",
            sa.String(length=50),
            nullable=False,
            server_default="approved",
        ),
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
