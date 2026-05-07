"""Fix missing PostgreSQL enum `tooltype` for tools.tool_type.

Seed currently fails with:
  UndefinedObjectError: type "tooltype" does not exist
when inserting tools configuration.
"""

from alembic import op

revision = "015_fix_tooltype_enum"
down_revision = "014_fix_alembic_version_column_size"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'tooltype'
            ) THEN
                CREATE TYPE tooltype AS ENUM (
                    'CODE_BASED',
                    'EXTERNAL_API',
                    'MCP'
                );
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    # Keep downgrade no-op for safety (dropping enum can break existing schema/data).
    pass

