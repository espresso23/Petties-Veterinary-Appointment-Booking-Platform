"""Drop unused vision_disease_classes table

This table was created in migration 002 but never used in the application.
No SQLAlchemy model exists for it, and no code references it.

Version: 009
"""

from alembic import op

revision = "009_drop_vision_disease_classes"
down_revision = "008_drop_disease_review"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("idx_vision_disease_active", table_name="vision_disease_classes")
    op.drop_index("idx_vision_disease_code", table_name="vision_disease_classes")
    op.drop_table("vision_disease_classes")


def downgrade() -> None:
    op.create_table(
        "vision_disease_classes",
        op.Column("id", op.INTEGER(), autoincrement=True, nullable=False),
        op.Column("code", op.VARCHAR(length=50), nullable=False),
        op.Column("name_vi", op.VARCHAR(length=100), nullable=False),
        op.Column("description", op.TEXT(), nullable=True),
        op.Column(
            "species", op.VARCHAR(length=50), server_default="all", nullable=True
        ),
        op.Column("is_active", op.BOOLEAN(), server_default="true", nullable=True),
        op.Column(
            "requires_retrain", op.BOOLEAN(), server_default="false", nullable=True
        ),
        op.Column("label_count", op.INTEGER(), server_default="0", nullable=True),
        op.Column(
            "min_label_required", op.INTEGER(), server_default="50", nullable=True
        ),
        op.Column("model_version", op.VARCHAR(length=50), nullable=True),
        op.Column(
            "created_at",
            op.DateTime(timezone=True),
            server_default=op.func.now(),
            nullable=True,
        ),
        op.Column(
            "updated_at",
            op.DateTime(timezone=True),
            server_default=op.func.now(),
            nullable=True,
        ),
        op.PrimaryKeyConstraint("id", name="vision_disease_classes_pkey"),
        op.UniqueConstraint("code", name="vision_disease_classes_code_key"),
    )
    op.create_index(
        "idx_vision_disease_code", "vision_disease_classes", ["code"], unique=True
    )
    op.create_index(
        "idx_vision_disease_active",
        "vision_disease_classes",
        ["is_active"],
        unique=False,
    )
