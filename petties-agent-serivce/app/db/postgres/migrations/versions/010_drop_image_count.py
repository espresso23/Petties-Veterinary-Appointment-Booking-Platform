"""Drop image_count from knowledge_documents and remove image indexing

Image extraction from PDFs and hybrid query were never used in production.
The diagnosis flow only uses text-based RAG retrieval.

Version: 010
"""

from alembic import op
import sqlalchemy as sa

revision = "010_drop_image_count"
down_revision = "009_drop_vision_disease_classes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("knowledge_documents", "image_count")


def downgrade() -> None:
    op.add_column(
        "knowledge_documents",
        sa.Column("image_count", sa.Integer(), nullable=True, server_default="0"),
    )
