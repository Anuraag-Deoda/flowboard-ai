"""Domain event model - machine-readable facts for automation and AI."""

from sqlalchemy import Column, String, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class DomainEvent(db.Model, UUIDMixin, TimestampMixin):
    """Domain event - immutable record of something that happened.

    This is the foundation for:
    - Automation rules (subscribe to events)
    - AI context assembly (reconstruct history)
    - Real-time updates (broadcast events)
    - Audit trails (immutable log)
    - Activity logs (derived from events)
    """

    __tablename__ = "domain_events"
    __table_args__ = (
        Index("idx_events_aggregate", "aggregate_type", "aggregate_id"),
        Index("idx_events_type", "event_type"),
        Index("idx_events_created", "created_at"),
    )

    event_type = Column(String(100), nullable=False)  # e.g., 'card.moved'
    aggregate_type = Column(String(50), nullable=False)  # e.g., 'card'
    aggregate_id = Column(UUID(as_uuid=True), nullable=False)  # e.g., card.id
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    payload = Column(JSONB, nullable=False)  # Event-specific data
    event_metadata = Column(JSONB)  # request_id, ip, user_agent, etc.

    # Relationships
    actor = relationship("User")

    def to_dict(self):
        """Serialize domain event to dictionary."""
        return {
            "id": str(self.id),
            "event_type": self.event_type,
            "aggregate_type": self.aggregate_type,
            "aggregate_id": str(self.aggregate_id),
            "actor_id": str(self.actor_id) if self.actor_id else None,
            "payload": self.payload,
            "event_metadata": self.event_metadata,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<DomainEvent {self.event_type} {self.aggregate_id}>"


# Event type constants
class EventTypes:
    """Domain event type constants."""

    # Card events
    CARD_CREATED = "card.created"
    CARD_UPDATED = "card.updated"
    CARD_MOVED = "card.moved"
    CARD_ASSIGNED = "card.assigned"
    CARD_UNASSIGNED = "card.unassigned"
    CARD_COMMENTED = "card.commented"
    CARD_BLOCKED = "card.blocked"
    CARD_UNBLOCKED = "card.unblocked"
    CARD_COMPLETED = "card.completed"
    CARD_DELETED = "card.deleted"

    # Column events
    COLUMN_CREATED = "column.created"
    COLUMN_UPDATED = "column.updated"
    COLUMN_DELETED = "column.deleted"
    COLUMN_WIP_EXCEEDED = "column.wip_exceeded"
    COLUMN_WIP_RESOLVED = "column.wip_resolved"

    # Sprint events
    SPRINT_CREATED = "sprint.created"
    SPRINT_STARTED = "sprint.started"
    SPRINT_COMPLETED = "sprint.completed"
    SPRINT_EXTENDED = "sprint.extended"

    # Daily log events
    DAILY_LOG_SUBMITTED = "daily_log.submitted"
    DAILY_LOG_UPDATED = "daily_log.updated"

    # Import events
    IMPORT_STARTED = "import.started"
    IMPORT_COMPLETED = "import.completed"
    IMPORT_FAILED = "import.failed"

    # Board events
    BOARD_CREATED = "board.created"
    BOARD_UPDATED = "board.updated"
    BOARD_DELETED = "board.deleted"

    # Project events
    PROJECT_CREATED = "project.created"
    PROJECT_UPDATED = "project.updated"
    PROJECT_DELETED = "project.deleted"
