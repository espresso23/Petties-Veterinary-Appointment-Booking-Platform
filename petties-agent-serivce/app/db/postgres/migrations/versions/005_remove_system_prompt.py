"""
Remove system_prompt and prompt_versions from agents table

System prompt is now hardcoded in code, no longer stored in DB.
Version: 005
"""

from alembic import op
import sqlalchemy as sa


revision = "005_remove_system_prompt"
down_revision = "004_disease_mapping_catalog"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop prompt_versions table first (foreign key constraint)
    op.drop_table("prompt_versions")

    # Drop system_prompt column from agents table
    op.drop_column("agents", "system_prompt")


def downgrade() -> None:
    # Add back system_prompt column
    op.add_column("agents", sa.Column("system_prompt", sa.Text(), nullable=True))

    # Recreate prompt_versions table
    op.create_table(
        "prompt_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("agent_id", sa.Integer(), nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), default=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
