"""Add image_count to knowledge_documents

Revision ID: 003_kb_image_count
Revises: 002_vision_disease_classes
Create Date: 2026-03-18 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

revision = "003_kb_image_count"
down_revision = "002_vision_disease_classes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "knowledge_documents",
        sa.Column("image_count", sa.Integer(), nullable=True, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("knowledge_documents", "image_count")
