"""
Remove assigned_agents from tools table

Single-agent architecture no longer stores tool-to-agent assignments.
Version: 006
"""

from alembic import op
import sqlalchemy as sa


revision = "006_remove_tool_assignments"
down_revision = "005_remove_system_prompt"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("tools", "assigned_agents")


def downgrade() -> None:
    op.add_column(
        "tools",
        sa.Column("assigned_agents", sa.JSON(), nullable=True),
    )
