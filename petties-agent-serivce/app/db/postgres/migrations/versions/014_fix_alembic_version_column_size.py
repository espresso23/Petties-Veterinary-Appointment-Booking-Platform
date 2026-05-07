"""Fix alembic_version.version_num size (prevent truncation).

Revision ID: 014_fix_alembic_version_column_size
Revises: 013_fix_system_settings_category_enum
Create Date: 2026-05-07 16:44:00.000000
"""

from alembic import op

revision = "014_fix_alembic_version_column_size"
down_revision = "013_fix_system_settings_category_enum"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Some environments created alembic_version.version_num too small (e.g. varchar(32)).
    # Long revision ids (like "013_fix_system_settings_category_enum") can be truncated,
    # making Alembic think migrations are missing.
    op.execute(
        "ALTER TABLE alembic_version ALTER COLUMN version_num TYPE varchar(64);"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE alembic_version ALTER COLUMN version_num TYPE varchar(32);"
    )

