"""Add vision_disease_classes table

Revision ID: 002_vision_disease_classes
Revises: 001_initial_ai_schema
Create Date: 2026-03-15 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "002_vision_disease_classes"
down_revision = "001_initial_ai_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vision_disease_classes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name_vi", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("species", sa.String(length=50), nullable=True, server_default="all"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column(
            "requires_retrain", sa.Boolean(), nullable=True, server_default="false"
        ),
        sa.Column("label_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column(
            "min_label_required", sa.Integer(), nullable=True, server_default="50"
        ),
        sa.Column("model_version", sa.String(length=50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(
        op.f("idx_vision_disease_code"), "vision_disease_classes", ["code"], unique=True
    )
    op.create_index(
        op.f("idx_vision_disease_active"),
        "vision_disease_classes",
        ["is_active"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("idx_vision_disease_active"), table_name="vision_disease_classes"
    )
    op.drop_index(op.f("idx_vision_disease_code"), table_name="vision_disease_classes")
    op.drop_table("vision_disease_classes")
