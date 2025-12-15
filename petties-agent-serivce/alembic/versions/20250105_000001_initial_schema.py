"""Initial database schema for Petties Agent Service

Revision ID: 20250105_000001
Revises:
Create Date: 2025-01-05 00:00:01

Creates:
- agents table
- tools table (base schema)
- prompt_versions table
- chat_sessions table
- chat_messages table
- knowledge_documents table
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '20250105_000001'
down_revision = None
branch_labels = None
depends_on = None


def table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def index_exists(index_name: str, table_name: str) -> bool:
    """Check if an index exists on a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    indexes = inspector.get_indexes(table_name)
    return any(idx['name'] == index_name for idx in indexes)


def upgrade() -> None:
    # Create AgentType enum using raw SQL with IF NOT EXISTS
    # This is more reliable than checkfirst=True which can fail with some drivers
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE agenttype AS ENUM ('main', 'booking', 'medical', 'product');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # Create ToolTypeEnum enum using raw SQL with IF NOT EXISTS
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE tooltypeenum AS ENUM ('code_based', 'api_based');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # ===== AGENTS TABLE =====
    if not table_exists('agents'):
        op.create_table(
            'agents',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(100), nullable=False),
            sa.Column('agent_type', sa.Enum('main', 'booking', 'medical', 'product', name='agenttype', create_type=False), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('temperature', sa.Float(), server_default='0.5', nullable=True),
            sa.Column('max_tokens', sa.Integer(), server_default='2000', nullable=True),
            sa.Column('model', sa.String(100), server_default='gpt-4-turbo', nullable=True),
            sa.Column('system_prompt', sa.Text(), nullable=True),
            sa.Column('enabled', sa.Boolean(), server_default='true', nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_agents_id', 'agents', ['id'])
        op.create_index('ix_agents_name', 'agents', ['name'], unique=True)

    # ===== TOOLS TABLE (Base Schema) =====
    if not table_exists('tools'):
        op.create_table(
            'tools',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(100), nullable=False),
            sa.Column('tool_type', sa.Enum('code_based', 'api_based', name='tooltypeenum', create_type=False), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('input_schema', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('output_schema', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('endpoint', sa.String(500), nullable=True),
            sa.Column('method', sa.String(10), nullable=True),
            sa.Column('headers', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('enabled', sa.Boolean(), server_default='true', nullable=True),
            sa.Column('assigned_agents', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_tools_id', 'tools', ['id'])
        op.create_index('ix_tools_name', 'tools', ['name'], unique=True)

    # ===== PROMPT VERSIONS TABLE =====
    if not table_exists('prompt_versions'):
        op.create_table(
            'prompt_versions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('agent_id', sa.Integer(), nullable=False),
            sa.Column('version', sa.Integer(), nullable=False),
            sa.Column('prompt_text', sa.Text(), nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default='false', nullable=True),
            sa.Column('created_by', sa.String(100), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_prompt_versions_id', 'prompt_versions', ['id'])

    # ===== CHAT SESSIONS TABLE =====
    if not table_exists('chat_sessions'):
        op.create_table(
            'chat_sessions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('agent_id', sa.Integer(), nullable=True),
            sa.Column('user_id', sa.String(100), nullable=True),
            sa.Column('session_id', sa.String(100), nullable=False),
            sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['agent_id'], ['agents.id']),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_chat_sessions_id', 'chat_sessions', ['id'])
        op.create_index('ix_chat_sessions_session_id', 'chat_sessions', ['session_id'], unique=True)
        op.create_index('ix_chat_sessions_user_id', 'chat_sessions', ['user_id'])

    # ===== CHAT MESSAGES TABLE =====
    if not table_exists('chat_messages'):
        op.create_table(
            'chat_messages',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('session_id', sa.Integer(), nullable=False),
            sa.Column('role', sa.String(20), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id']),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_chat_messages_id', 'chat_messages', ['id'])

    # ===== KNOWLEDGE DOCUMENTS TABLE =====
    if not table_exists('knowledge_documents'):
        op.create_table(
            'knowledge_documents',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('filename', sa.String(255), nullable=False),
            sa.Column('file_path', sa.String(500), nullable=False),
            sa.Column('file_type', sa.String(10), nullable=True),
            sa.Column('file_size', sa.Integer(), nullable=True),
            sa.Column('processed', sa.Boolean(), server_default='false', nullable=True),
            sa.Column('vector_count', sa.Integer(), server_default='0', nullable=True),
            sa.Column('uploaded_by', sa.String(100), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_knowledge_documents_id', 'knowledge_documents', ['id'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index('ix_knowledge_documents_id', 'knowledge_documents')
    op.drop_table('knowledge_documents')

    op.drop_index('ix_chat_messages_id', 'chat_messages')
    op.drop_table('chat_messages')

    op.drop_index('ix_chat_sessions_user_id', 'chat_sessions')
    op.drop_index('ix_chat_sessions_session_id', 'chat_sessions')
    op.drop_index('ix_chat_sessions_id', 'chat_sessions')
    op.drop_table('chat_sessions')

    op.drop_index('ix_prompt_versions_id', 'prompt_versions')
    op.drop_table('prompt_versions')

    op.drop_index('ix_tools_name', 'tools')
    op.drop_index('ix_tools_id', 'tools')
    op.drop_table('tools')

    op.drop_index('ix_agents_name', 'agents')
    op.drop_index('ix_agents_id', 'agents')
    op.drop_table('agents')

    # Drop enums
    tool_type_enum = postgresql.ENUM(
        'code_based',
        'api_based',
        name='tooltypeenum'
    )
    tool_type_enum.drop(op.get_bind())

    agent_type_enum = postgresql.ENUM(
        'main',
        'booking',
        'medical',
        'product',
        name='agenttype'
    )
    agent_type_enum.drop(op.get_bind())
