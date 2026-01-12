"""Event handlers - process domain events."""

import logging
from flask import Flask

from .base import DomainEventBase
from .dispatcher import EventHandler

logger = logging.getLogger(__name__)


class EventPersistenceHandler(EventHandler):
    """Persists all events to the domain_events table.

    This is the source of truth for everything that happened.
    """

    def __init__(self, app: Flask):
        self.app = app

    def handle(self, event: DomainEventBase) -> None:
        """Persist event to database."""
        from ..extensions import db
        from ..models import DomainEvent

        with self.app.app_context():
            domain_event = DomainEvent(
                id=event.event_id,
                event_type=event.event_type,
                aggregate_type=event.aggregate_type,
                aggregate_id=event.aggregate_id,
                actor_id=event.actor_id,
                payload=event.payload,
                event_metadata=event.metadata,
                created_at=event.timestamp,
            )
            db.session.add(domain_event)
            db.session.commit()
            logger.debug(f"Persisted event {event.event_type}")


class ActivityLogHandler(EventHandler):
    """Creates human-readable activity logs from events.

    Transforms machine events into user-friendly descriptions.
    """

    def __init__(self, app: Flask):
        self.app = app

    # Mapping of event types to human-readable action templates
    ACTION_TEMPLATES = {
        "card.created": "created this card",
        "card.updated": "updated this card",
        "card.moved": "moved this card",
        "card.assigned": "assigned someone to this card",
        "card.unassigned": "unassigned someone from this card",
        "card.commented": "commented on this card",
        "card.blocked": "marked this card as blocked",
        "card.unblocked": "removed blocked status",
        "card.completed": "marked this card as done",
        "card.deleted": "deleted this card",
    }

    def handle(self, event: DomainEventBase) -> None:
        """Create activity log from event."""
        # Only create activity logs for card-related events
        if event.aggregate_type != "card":
            return

        action = self.ACTION_TEMPLATES.get(event.event_type)
        if not action:
            return

        from ..extensions import db
        from ..models import ActivityLog

        with self.app.app_context():
            activity_log = ActivityLog(
                card_id=event.aggregate_id,
                user_id=event.actor_id,
                action=action,
                details=event.payload,
            )
            db.session.add(activity_log)
            db.session.commit()
            logger.debug(f"Created activity log for {event.event_type}")


class WebSocketHandler(EventHandler):
    """Broadcasts events via WebSocket for real-time updates.

    Clients subscribe to specific boards/projects and receive
    updates when cards move, get assigned, etc.
    """

    def __init__(self, app: Flask):
        self.app = app

    def handle(self, event: DomainEventBase) -> None:
        """Broadcast event via WebSocket."""
        from ..extensions import socketio

        # Determine the room to broadcast to
        room = self._get_room(event)
        if not room:
            return

        # Emit to room
        socketio.emit(
            "domain_event",
            {
                "event_type": event.event_type,
                "aggregate_type": event.aggregate_type,
                "aggregate_id": str(event.aggregate_id),
                "payload": event.payload,
                "actor_id": str(event.actor_id) if event.actor_id else None,
                "timestamp": event.timestamp.isoformat(),
            },
            room=room,
        )
        logger.debug(f"Broadcast {event.event_type} to room {room}")

    def _get_room(self, event: DomainEventBase) -> str | None:
        """Determine WebSocket room from event.

        Room naming convention:
            - board:{board_id} - for card/column events
            - project:{project_id} - for sprint events
            - user:{user_id} - for personal notifications
        """
        # For card events, we need to look up the board
        if event.aggregate_type == "card":
            board_id = event.payload.get("board_id")
            if board_id:
                return f"board:{board_id}"
            # If board_id not in payload, we'd need to look it up
            # For MVP, require board_id in payload

        elif event.aggregate_type == "column":
            board_id = event.payload.get("board_id")
            if board_id:
                return f"board:{board_id}"

        elif event.aggregate_type == "sprint":
            project_id = event.payload.get("project_id")
            if project_id:
                return f"project:{project_id}"

        return None


class NotificationHandler(EventHandler):
    """Sends notifications based on events.

    Future implementation - Phase 8+
    """

    def __init__(self, app: Flask):
        self.app = app

    def handle(self, event: DomainEventBase) -> None:
        """Send notifications for relevant events."""
        # TODO: Implement notification logic
        # - card.assigned → notify assignee
        # - card.blocked → notify team lead
        # - column.wip_exceeded → notify board viewers
        pass


class AutomationHandler(EventHandler):
    """Evaluates automation rules against events.

    Future implementation - Phase 8
    """

    def __init__(self, app: Flask):
        self.app = app

    def handle(self, event: DomainEventBase) -> None:
        """Evaluate automation rules."""
        # TODO: Implement automation rule evaluation
        # - Load rules for the relevant project/board
        # - Check if event matches any rule triggers
        # - Execute rule actions
        pass
