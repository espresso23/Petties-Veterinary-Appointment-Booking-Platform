"""Rename Product Agent to Research Agent

Revision ID: 20250107_000001
Revises: 20250106_000001
Create Date: 2025-01-07 00:00:01

Changes:
- Add 'research' to AgentType enum
- Update existing 'product' agent_type records to 'research'
- Update agent name from 'product_agent' to 'research_agent'
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250107_000001'
down_revision = '20250106_000001'  # Revises swagger fields migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Add 'research' value to AgentType enum (idempotent)
    op.execute("ALTER TYPE agenttype ADD VALUE IF NOT EXISTS 'research'")

    # Step 2: Check if 'product' value exists in enum before updating
    # This handles the case where initial migration might have been modified
    # or the database was set up differently
    op.execute("""
        DO $$
        BEGIN
            -- Only update if 'product' value exists in the enum
            IF EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'product'
                AND enumtypid = 'agenttype'::regtype
            ) THEN
                UPDATE agents
                SET agent_type = 'research'
                WHERE agent_type = 'product';
            END IF;
        END $$;
    """)

    # Step 3: Update agent name from 'product_agent' to 'research_agent' (idempotent)
    op.execute("""
        UPDATE agents
        SET name = 'research_agent'
        WHERE name = 'product_agent'
    """)


def downgrade() -> None:
    # Step 1: Revert agent name back to 'product_agent'
    op.execute("""
        UPDATE agents 
        SET name = 'product_agent' 
        WHERE name = 'research_agent'
    """)
    
    # Step 2: Revert agent_type back to 'product'
    op.execute("""
        UPDATE agents 
        SET agent_type = 'product' 
        WHERE agent_type = 'research'
    """)
    
    # Note: Cannot remove enum value 'research' in PostgreSQL easily
    # This would require recreating the enum type which is complex
    # So we leave 'research' in the enum for safety

