"""Initial AI schema

Revision ID: 001_initial_ai_schema
Revises: 
Create Date: 2025-12-29 23:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial_ai_schema'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Agents table
    op.create_table(
        'agents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('temperature', sa.Float(), nullable=True, server_default='0.7'),
        sa.Column('max_tokens', sa.Integer(), nullable=True, server_default='2000'),
        sa.Column('top_p', sa.Float(), nullable=True, server_default='0.9'),
        sa.Column('model', sa.String(length=100), nullable=True, server_default='google/gemini-2.0-flash-exp:free'),
        sa.Column('system_prompt', sa.Text(), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('idx_agents_name'), 'agents', ['name'], unique=True)

    # 2. Tools table
    op.create_table(
        'tools',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('tool_type', sa.String(length=20), nullable=True, server_default='code_based'),
        sa.Column('input_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('output_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('assigned_agents', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('idx_tools_name'), 'tools', ['name'], unique=True)

    # 3. Prompt Versions table
    op.create_table(
        'prompt_versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('agent_id', sa.Integer(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('prompt_text', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 4. Chat Sessions table
    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('agent_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.String(length=100), nullable=True),
        sa.Column('session_id', sa.String(length=100), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id')
    )
    op.create_index(op.f('idx_chat_sessions_user_id'), 'chat_sessions', ['user_id'], unique=False)
    op.create_index(op.f('idx_chat_sessions_session_id'), 'chat_sessions', ['session_id'], unique=True)

    # 5. Chat Messages table
    op.create_table(
        'chat_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('message_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 6. Knowledge Documents table
    op.create_table(
        'knowledge_documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_type', sa.String(length=10), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('processed', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('vector_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('uploaded_by', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # 7. System Settings table
    # Handle Enum Category
    setting_category = sa.Enum('LLM', 'RAG', 'EMBEDDINGS', 'VECTOR_DB', 'GENERAL', name='settingcategory')
    op.create_table(
        'system_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=20), nullable=True, server_default='general'),
        sa.Column('is_sensitive', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('idx_system_settings_key'), 'system_settings', ['key'], unique=True)

def downgrade() -> None:
    op.drop_table('system_settings')
    op.drop_table('knowledge_documents')
    op.drop_table('chat_messages')
    op.drop_table('chat_sessions')
    op.drop_table('prompt_versions')
    op.drop_table('tools')
    op.drop_table('agents')
    # Drop Enum
    op.execute('DROP TYPE settingcategory')
