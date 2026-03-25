"""
PETTIES AGENT SERVICE - PostgreSQL Checkpointer

Persistent checkpointer for LangGraph using PostgreSQL.
Replaces MemorySaver for production use.

Package: app.core.agents
Version: v1.0.0

Usage:
    from app.core.agents.postgres_checkpointer import PostgresCheckpointer

    checkpointer = PostgresCheckpointer()
    graph = workflow.compile(checkpointer=checkpointer)
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Protocol

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.metadata import Metadata
from langgraph.checkpoint.serde.base import SerializerProtocol

from sqlalchemy import Column, String, Text, JSON, DateTime, Integer, delete, select
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from loguru import logger


Base = declarative_base()


class Checkpoint(Base):
    """Checkpoint table for LangGraph state persistence."""

    __tablename__ = "langgraph_checkpoints"

    thread_id = Column(String(255), primary_key=True)
    checkpoint_id = Column(String(255), primary_key=True)
    parent_checkpoint_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
    channel_values = Column(JSON, nullable=True)
    channel_versions = Column(JSON, nullable=True)
    pending_writes = Column(JSON, nullable=True)
    metadata = Column(JSON, nullable=True)

    def to_checkpoint(self) -> Dict[str, Any]:
        """Convert to LangGraph checkpoint format."""
        return {
            "id": self.checkpoint_id,
            "parent_id": self.parent_checkpoint_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "channel_values": self.channel_values or {},
            "channel_versions": self.channel_versions or {},
            "pending_writes": self.pending_writes or [],
        }

    def to_tuple(self) -> Tuple[str, str, Optional[str], Dict[str, Any], float]:
        """Convert to checkpoint tuple for LangGraph."""
        return (
            self.thread_id,
            self.checkpoint_id,
            self.parent_checkpoint_id,
            self.to_checkpoint(),
            self.updated_at.timestamp() if self.updated_at else 0.0,
        )


class PostgresCheckpointer(BaseCheckpointSaver):
    """
    PostgreSQL-based checkpointer for LangGraph.

    Features:
    - Persistent state across restarts
    - Thread/conversation isolation
    - Configurable retention
    - Async support

    Usage:
        checkpointer = PostgresCheckpointer(session_maker=async_session_maker)
        graph = workflow.compile(checkpointer=checkpointer)
    """

    def __init__(
        self,
        session_factory=None,
        auto_create_tables: bool = True,
        retention_seconds: Optional[int] = 86400 * 7,  # 7 days default
    ):
        """
        Initialize PostgreSQL checkpointer.

        Args:
            session_factory: AsyncSession factory (async_sessionmaker)
            auto_create_tables: Auto-create tables if not exist
            retention_seconds: How long to keep checkpoints (None = keep forever)
        """
        self.session_factory = session_factory
        self.auto_create_tables = auto_create_tables
        self.retention_seconds = retention_seconds

    async def setup(self) -> None:
        """Initialize database tables if needed."""
        if not self.auto_create_tables:
            return

        if self.session_factory is None:
            logger.warning("No session factory provided, skipping table creation")
            return

        async with self.session_factory() as session:
            try:
                Base.metadata.create_all(session.get_bind())
                await session.commit()
                logger.info("LangGraph checkpoint tables created")
            except Exception as e:
                logger.warning(f"Table creation skipped: {e}")

    async def aget(self, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get checkpoint for thread."""
        if self.session_factory is None:
            return None

        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            return None

        async with self.session_factory() as session:
            try:
                result = await session.execute(
                    select(Checkpoint)
                    .where(Checkpoint.thread_id == thread_id)
                    .order_by(Checkpoint.updated_at.desc())
                    .limit(1)
                )
                checkpoint = result.scalar_one_or_none()

                if checkpoint:
                    return checkpoint.to_checkpoint()
                return None

            except Exception as e:
                logger.error(f"Error getting checkpoint: {e}")
                return None

    async def alist(
        self,
        config: Optional[Dict[str, Any]] = None,
        filter: Optional[Dict[str, Any]] = None,
        before: Optional[Dict[str, Any]] = None,
        limit: Optional[int] = None,
    ) -> List[Tuple[str, str, Optional[str], Dict[str, Any], float]]:
        """List checkpoints for thread."""
        if self.session_factory is None:
            return []

        thread_id = config.get("configurable", {}).get("thread_id") if config else None

        async with self.session_factory() as session:
            try:
                query = select(Checkpoint)

                if thread_id:
                    query = query.where(Checkpoint.thread_id == thread_id)

                query = query.order_by(Checkpoint.updated_at.desc())

                if limit:
                    query = query.limit(limit)

                result = await session.execute(query)
                checkpoints = result.scalars().all()

                return [cp.to_tuple() for cp in checkpoints]

            except Exception as e:
                logger.error(f"Error listing checkpoints: {e}")
                return []

    async def aput(
        self,
        config: Dict[str, Any],
        checkpoint: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Save checkpoint."""
        if self.session_factory is None:
            return checkpoint

        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            thread_id = str(uuid.uuid4())

        checkpoint_id = checkpoint.get("id", str(uuid.uuid4()))
        parent_id = checkpoint.get("parent_id")

        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            try:
                # Check if exists
                result = await session.execute(
                    select(Checkpoint).where(
                        Checkpoint.thread_id == thread_id,
                        Checkpoint.checkpoint_id == checkpoint_id,
                    )
                )
                existing = result.scalar_one_or_none()

                if existing:
                    # Update
                    existing.channel_values = checkpoint.get("channel_values")
                    existing.channel_versions = checkpoint.get("channel_versions")
                    existing.pending_writes = checkpoint.get("pending_writes")
                    existing.updated_at = now
                    if metadata:
                        existing.metadata = metadata
                else:
                    # Insert
                    new_checkpoint = Checkpoint(
                        thread_id=thread_id,
                        checkpoint_id=checkpoint_id,
                        parent_checkpoint_id=parent_id,
                        created_at=now,
                        updated_at=now,
                        channel_values=checkpoint.get("channel_values"),
                        channel_versions=checkpoint.get("channel_versions"),
                        pending_writes=checkpoint.get("pending_writes"),
                        metadata=metadata,
                    )
                    session.add(new_checkpoint)

                await session.commit()

                # Cleanup old checkpoints
                if self.retention_seconds:
                    await self._cleanup_old_checkpoints(session, thread_id)

                return checkpoint

            except Exception as e:
                logger.error(f"Error saving checkpoint: {e}")
                await session.rollback()
                return checkpoint

    async def adelete(self, config: Dict[str, Any]) -> None:
        """Delete checkpoint."""
        if self.session_factory is None:
            return

        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            return

        async with self.session_factory() as session:
            try:
                await session.execute(
                    delete(Checkpoint).where(Checkpoint.thread_id == thread_id)
                )
                await session.commit()

            except Exception as e:
                logger.error(f"Error deleting checkpoint: {e}")
                await session.rollback()

    async def _cleanup_old_checkpoints(
        self,
        session: AsyncSession,
        thread_id: str,
    ) -> None:
        """Remove old checkpoints based on retention policy."""
        if not self.retention_seconds:
            return

        cutoff = datetime.now(timezone.utc).timestamp() - self.retention_seconds

        try:
            await session.execute(
                delete(Checkpoint).where(
                    Checkpoint.thread_id == thread_id,
                    Checkpoint.updated_at
                    < datetime.fromtimestamp(cutoff, tz=timezone.utc),
                )
            )
            await session.commit()

        except Exception as e:
            logger.warning(f"Cleanup error: {e}")


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================


async def create_postgres_checkpointer(
    database_url: str,
    retention_days: int = 7,
) -> PostgresCheckpointer:
    """
    Create PostgresCheckpointer with connection pool.

    Args:
        database_url: PostgreSQL connection URL
        retention_days: How many days to keep checkpoints

    Returns:
        Configured PostgresCheckpointer
    """
    engine = create_async_engine(database_url, pool_size=5, max_overflow=10)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    checkpointer = PostgresCheckpointer(
        session_factory=session_factory,
        retention_seconds=retention_days * 86400,
    )

    await checkpointer.setup()

    return checkpointer
