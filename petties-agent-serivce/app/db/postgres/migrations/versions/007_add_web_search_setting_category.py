"""Add WEB_SEARCH to settingcategory enum.

Version: 007
"""

from alembic import op


revision = "007_add_web_search_setting"
down_revision = "006_remove_tool_assignments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_type
                WHERE typname = 'settingcategory'
            ) AND NOT EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'settingcategory'
                  AND e.enumlabel = 'WEB_SEARCH'
            ) THEN
                ALTER TYPE settingcategory ADD VALUE 'WEB_SEARCH';
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    # PostgreSQL does not support removing enum values safely.
    pass
