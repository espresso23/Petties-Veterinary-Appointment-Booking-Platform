"""Migrate to Single Agent architecture

Revision ID: 20250125_000001
Revises: 20250105_000001
Create Date: 2025-01-25

Migration from Multi-Agent to Single Agent:
1. Add top_p column to agents table
2. Add tool_type column to tools table (code_based, api_based)
3. Update DEFAULT_SETTINGS with OpenRouter and Cohere keys
4. Drop agent_type column (no longer needed)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250125_000001'
down_revision = '20250105_000001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add top_p column to agents table
    op.add_column('agents', sa.Column('top_p', sa.Float(), nullable=True, default=0.9))

    # Set default value for existing rows
    op.execute("UPDATE agents SET top_p = 0.9 WHERE top_p IS NULL")

    # 2. Create tool_type enum if not exists
    tool_type_enum = postgresql.ENUM('code_based', 'api_based', name='tooltype', create_type=False)
    tool_type_enum.create(op.get_bind(), checkfirst=True)

    # Add tool_type column to tools table
    op.add_column('tools', sa.Column('tool_type', sa.Enum('code_based', 'api_based', name='tooltype'), nullable=True, default='code_based'))

    # Set default value for existing rows
    op.execute("UPDATE tools SET tool_type = 'code_based' WHERE tool_type IS NULL")

    # 3. Add new settings for OpenRouter and Cohere
    op.execute("""
        INSERT INTO system_settings (key, value, category, is_sensitive, description, created_at, updated_at)
        VALUES
        ('OPENROUTER_API_KEY', '', 'llm', TRUE, 'OpenRouter Cloud API Key (https://openrouter.ai/keys)', NOW(), NOW()),
        ('OPENROUTER_DEFAULT_MODEL', 'google/gemini-2.0-flash-exp:free', 'llm', FALSE, 'Default LLM model (free tier: gemini-2.0-flash-exp:free)', NOW(), NOW()),
        ('OPENROUTER_FALLBACK_MODEL', 'meta-llama/llama-3.3-70b-instruct', 'llm', FALSE, 'Fallback model when primary fails', NOW(), NOW()),
        ('COHERE_API_KEY', '', 'rag', TRUE, 'Cohere API Key for multilingual embeddings (https://dashboard.cohere.com/api-keys)', NOW(), NOW()),
        ('COHERE_EMBEDDING_MODEL', 'embed-multilingual-v3.0', 'rag', FALSE, 'Cohere embedding model (multilingual for Vietnamese)', NOW(), NOW())
        ON CONFLICT (key) DO NOTHING
    """)

    # 4. Update model defaults from Ollama to OpenRouter
    op.execute("""
        UPDATE agents
        SET model = 'google/gemini-2.0-flash-exp:free'
        WHERE model IN ('kimi-k2', 'kimi-k2-thinking', 'llama3', 'mistral', 'gemma2:9b', 'qwen2.5:7b')
    """)

    # Note: We're NOT dropping agent_type column to maintain backward compatibility
    # It will be deprecated but still present


def downgrade() -> None:
    # 1. Drop top_p column
    op.drop_column('agents', 'top_p')

    # 2. Drop tool_type column and enum
    op.drop_column('tools', 'tool_type')
    # Note: Enum will be left in place to avoid issues with other migrations

    # 3. Remove OpenRouter and Cohere settings
    op.execute("""
        DELETE FROM system_settings
        WHERE key IN (
            'OPENROUTER_API_KEY',
            'OPENROUTER_DEFAULT_MODEL',
            'OPENROUTER_FALLBACK_MODEL',
            'COHERE_API_KEY',
            'COHERE_EMBEDDING_MODEL'
        )
    """)

    # 4. Revert model defaults back to Ollama
    op.execute("""
        UPDATE agents
        SET model = 'kimi-k2'
        WHERE model = 'google/gemini-2.0-flash-exp:free'
    """)
