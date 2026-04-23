"""Add status column to knowledge_documents.

Revision ID: 010_add_document_status
Revises: 009_restore_disease_review_queue
Create Date: 2026-04-23 11:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "012_add_document_status"
down_revision = "011_restore_disease_review_queue"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add status column with default 'pending'
    op.add_column(
        "knowledge_documents",
        sa.Column(
            "status", sa.String(length=50), nullable=False, server_default="pending"
        ),
    )
    # Update existing processed documents to 'completed'
    op.execute("UPDATE knowledge_documents SET status = 'completed' WHERE processed = true")


def downgrade() -> None:
    op.drop_column("knowledge_documents", "status")
