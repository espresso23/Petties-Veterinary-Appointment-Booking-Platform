"""Add Swagger/OpenAPI fields to Tool table for TL-03

Revision ID: 20250106_000001
Revises:
Create Date: 2025-01-06 00:00:01

Changes:
- Add ToolSource enum (fastmcp_code, swagger_imported, manual_api)
- Add source column to tools table
- Add Swagger-specific columns:
  - swagger_url
  - operation_id
  - path
  - original_name
  - request_body_schema
  - response_schema
  - path_parameters
  - query_parameters
- Change enabled default to False
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250106_000001'
down_revision = '20250105_000001'  # Revises initial schema
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ToolSource enum type
    tool_source_enum = postgresql.ENUM(
        'fastmcp_code',
        'swagger_imported',
        'manual_api',
        name='toolsource'
    )
    tool_source_enum.create(op.get_bind())

    # Add source column với default = 'fastmcp_code'
    op.add_column(
        'tools',
        sa.Column(
            'source',
            sa.Enum('fastmcp_code', 'swagger_imported', 'manual_api', name='toolsource'),
            nullable=False,
            server_default='fastmcp_code'
        )
    )

    # Add Swagger/OpenAPI specific columns
    op.add_column(
        'tools',
        sa.Column('swagger_url', sa.String(500), nullable=True)
    )

    op.add_column(
        'tools',
        sa.Column('operation_id', sa.String(200), nullable=True)
    )

    op.add_column(
        'tools',
        sa.Column('path', sa.String(500), nullable=True)
    )

    op.add_column(
        'tools',
        sa.Column('original_name', sa.String(200), nullable=True)
    )

    op.add_column(
        'tools',
        sa.Column('request_body_schema', postgresql.JSON(astext_type=sa.Text()), nullable=True)
    )

    op.add_column(
        'tools',
        sa.Column('response_schema', postgresql.JSON(astext_type=sa.Text()), nullable=True)
    )

    op.add_column(
        'tools',
        sa.Column('path_parameters', postgresql.JSON(astext_type=sa.Text()), nullable=True)
    )

    op.add_column(
        'tools',
        sa.Column('query_parameters', postgresql.JSON(astext_type=sa.Text()), nullable=True)
    )

    # Update enabled column default to False
    # (existing tools will remain as is, only new tools default to False)
    op.alter_column(
        'tools',
        'enabled',
        server_default=sa.text('false')
    )


def downgrade() -> None:
    # Remove Swagger columns
    op.drop_column('tools', 'query_parameters')
    op.drop_column('tools', 'path_parameters')
    op.drop_column('tools', 'response_schema')
    op.drop_column('tools', 'request_body_schema')
    op.drop_column('tools', 'original_name')
    op.drop_column('tools', 'path')
    op.drop_column('tools', 'operation_id')
    op.drop_column('tools', 'swagger_url')

    # Remove source column
    op.drop_column('tools', 'source')

    # Drop ToolSource enum
    tool_source_enum = postgresql.ENUM(
        'fastmcp_code',
        'swagger_imported',
        'manual_api',
        name='toolsource'
    )
    tool_source_enum.drop(op.get_bind())

    # Revert enabled default to True
    op.alter_column(
        'tools',
        'enabled',
        server_default=sa.text('true')
    )
