"""Base event class."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
from uuid import UUID, uuid4


@dataclass
class DomainEventBase:
    """Base class for domain events.

    All domain events should inherit from this class.
    Events are immutable records of something that happened.
    """

    event_type: str
    aggregate_type: str
    aggregate_id: UUID
    payload: dict = field(default_factory=dict)
    actor_id: Optional[UUID] = None
    metadata: dict = field(default_factory=dict)
    event_id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert event to dictionary for persistence."""
        return {
            "id": self.event_id,
            "event_type": self.event_type,
            "aggregate_type": self.aggregate_type,
            "aggregate_id": self.aggregate_id,
            "actor_id": self.actor_id,
            "payload": self.payload,
            "metadata": self.metadata,
            "created_at": self.timestamp,
        }


# Convenience factory functions for common events
def card_created(card_id: UUID, actor_id: UUID, payload: dict, **metadata) -> DomainEventBase:
    """Create a card.created event."""
    return DomainEventBase(
        event_type="card.created",
        aggregate_type="card",
        aggregate_id=card_id,
        actor_id=actor_id,
        payload=payload,
        metadata=metadata,
    )


def card_moved(
    card_id: UUID,
    actor_id: UUID,
    from_column_id: UUID,
    to_column_id: UUID,
    from_position: int,
    to_position: int,
    **metadata
) -> DomainEventBase:
    """Create a card.moved event."""
    return DomainEventBase(
        event_type="card.moved",
        aggregate_type="card",
        aggregate_id=card_id,
        actor_id=actor_id,
        payload={
            "from_column_id": str(from_column_id),
            "to_column_id": str(to_column_id),
            "from_position": from_position,
            "to_position": to_position,
        },
        metadata=metadata,
    )


def card_assigned(
    card_id: UUID, actor_id: UUID, assignee_id: UUID, **metadata
) -> DomainEventBase:
    """Create a card.assigned event."""
    return DomainEventBase(
        event_type="card.assigned",
        aggregate_type="card",
        aggregate_id=card_id,
        actor_id=actor_id,
        payload={"assignee_id": str(assignee_id)},
        metadata=metadata,
    )


def card_unassigned(
    card_id: UUID, actor_id: UUID, assignee_id: UUID, **metadata
) -> DomainEventBase:
    """Create a card.unassigned event."""
    return DomainEventBase(
        event_type="card.unassigned",
        aggregate_type="card",
        aggregate_id=card_id,
        actor_id=actor_id,
        payload={"assignee_id": str(assignee_id)},
        metadata=metadata,
    )


def column_wip_exceeded(
    column_id: UUID, card_count: int, wip_limit: int, **metadata
) -> DomainEventBase:
    """Create a column.wip_exceeded event."""
    return DomainEventBase(
        event_type="column.wip_exceeded",
        aggregate_type="column",
        aggregate_id=column_id,
        payload={"card_count": card_count, "wip_limit": wip_limit},
        metadata=metadata,
    )


def daily_log_submitted(
    daily_log_id: UUID, user_id: UUID, payload: dict, **metadata
) -> DomainEventBase:
    """Create a daily_log.submitted event."""
    return DomainEventBase(
        event_type="daily_log.submitted",
        aggregate_type="daily_log",
        aggregate_id=daily_log_id,
        actor_id=user_id,
        payload=payload,
        metadata=metadata,
    )


def sprint_started(
    sprint_id: UUID, actor_id: UUID, payload: dict, **metadata
) -> DomainEventBase:
    """Create a sprint.started event."""
    return DomainEventBase(
        event_type="sprint.started",
        aggregate_type="sprint",
        aggregate_id=sprint_id,
        actor_id=actor_id,
        payload=payload,
        metadata=metadata,
    )


def sprint_completed(
    sprint_id: UUID, actor_id: UUID, payload: dict, **metadata
) -> DomainEventBase:
    """Create a sprint.completed event."""
    return DomainEventBase(
        event_type="sprint.completed",
        aggregate_type="sprint",
        aggregate_id=sprint_id,
        actor_id=actor_id,
        payload=payload,
        metadata=metadata,
    )
