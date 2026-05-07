"""Fix system_settings.category to use settingcategory enum.

Revision ID: 013_fix_system_settings_category_enum
Revises: 012_add_document_status
Create Date: 2026-05-07 16:30:00.000000
"""

from alembic import op

revision = "013_fix_system_settings_category_enum"
down_revision = "012_add_document_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Ensure enum type exists (and has WEB_SEARCH).
    # asyncpg không cho phép DO $$ block với multiple statements trong 1 op.execute
    # nên dùng CREATE TYPE IF NOT EXISTS (PostgreSQL 9.1+)
    # Tuy nhiên CREATE TYPE không có IF NOT EXISTS → dùng DO $$ nhưng tách riêng
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'settingcategory'
            ) THEN
                CREATE TYPE settingcategory AS ENUM (
                    'LLM', 'RAG', 'EMBEDDINGS', 'VECTOR_DB', 'GENERAL', 'WEB_SEARCH'
                );
            END IF;
        END $$;
        """
    )

    # 2) Normalize existing string categories to enum labels.
    op.execute(
        """
        UPDATE system_settings
        SET category = CASE
            WHEN category IS NULL OR btrim(category) = '' THEN 'GENERAL'
            WHEN lower(category) IN ('general', 'gen') THEN 'GENERAL'
            WHEN lower(category) IN ('llm') THEN 'LLM'
            WHEN lower(category) IN ('rag') THEN 'RAG'
            WHEN lower(category) IN ('embeddings', 'embedding') THEN 'EMBEDDINGS'
            WHEN lower(category) IN ('vector_db', 'vector', 'vectordb') THEN 'VECTOR_DB'
            WHEN lower(category) IN ('web_search', 'websearch') THEN 'WEB_SEARCH'
            ELSE upper(category)
        END
        """
    )

    # 3) Alter column type to enum — mỗi ALTER TABLE là 1 op.execute riêng biệt
    #    asyncpg không cho phép multiple statements trong 1 prepared statement
    op.execute(
        "ALTER TABLE system_settings ALTER COLUMN category DROP DEFAULT"
    )

    op.execute(
        """
        ALTER TABLE system_settings
        ALTER COLUMN category TYPE settingcategory
        USING category::settingcategory
        """
    )

    op.execute(
        "ALTER TABLE system_settings ALTER COLUMN category SET DEFAULT 'GENERAL'"
    )


def downgrade() -> None:
    # Tách riêng từng statement — cùng lý do asyncpg
    op.execute(
        "ALTER TABLE system_settings ALTER COLUMN category DROP DEFAULT"
    )

    op.execute(
        """
        ALTER TABLE system_settings
        ALTER COLUMN category TYPE varchar(20)
        USING category::text
        """
    )

    op.execute(
        "ALTER TABLE system_settings ALTER COLUMN category SET DEFAULT 'general'"
    )