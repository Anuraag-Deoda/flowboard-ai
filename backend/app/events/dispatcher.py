"""Event dispatcher - routes events to handlers."""

import logging
from collections import defaultdict
from typing import Callable, List, Optional, Type

from .base import DomainEventBase

logger = logging.getLogger(__name__)


class EventHandler:
    """Base class for event handlers."""

    def handle(self, event: DomainEventBase) -> None:
        """Handle an event. Override in subclasses."""
        raise NotImplementedError


class EventDispatcher:
    """Dispatches domain events to registered handlers.

    Pattern:
        Service Method → emit(event) → Dispatcher → Handlers

    Handlers:
        - ActivityLogHandler: Creates human-readable activity logs
        - WebSocketHandler: Broadcasts real-time updates
        - AutomationHandler: Evaluates automation rules (Phase 8)
        - AIContextHandler: Updates AI context (Phase 6)
    """

    def __init__(self):
        self._handlers: dict[str, List[EventHandler]] = defaultdict(list)
        self._global_handlers: List[EventHandler] = []

    def register(
        self, event_type: str, handler: EventHandler
    ) -> None:
        """Register a handler for a specific event type.

        Args:
            event_type: The event type to handle (e.g., 'card.moved')
            handler: The handler instance
        """
        self._handlers[event_type].append(handler)
        logger.debug(f"Registered handler {handler.__class__.__name__} for {event_type}")

    def register_global(self, handler: EventHandler) -> None:
        """Register a handler that receives ALL events.

        Useful for:
            - Event persistence
            - Audit logging
            - Metrics collection
        """
        self._global_handlers.append(handler)
        logger.debug(f"Registered global handler {handler.__class__.__name__}")

    def emit(self, event: DomainEventBase) -> None:
        """Emit an event to all registered handlers.

        Events are processed synchronously in MVP.
        Future: Add async/queue support via Redis.

        Args:
            event: The domain event to dispatch
        """
        logger.info(f"Emitting event: {event.event_type} for {event.aggregate_type}:{event.aggregate_id}")

        # Global handlers first (persistence, audit)
        for handler in self._global_handlers:
            try:
                handler.handle(event)
            except Exception as e:
                logger.error(
                    f"Global handler {handler.__class__.__name__} failed: {e}",
                    exc_info=True
                )

        # Type-specific handlers
        for handler in self._handlers.get(event.event_type, []):
            try:
                handler.handle(event)
            except Exception as e:
                logger.error(
                    f"Handler {handler.__class__.__name__} failed for {event.event_type}: {e}",
                    exc_info=True
                )

    def emit_many(self, events: List[DomainEventBase]) -> None:
        """Emit multiple events in order."""
        for event in events:
            self.emit(event)


# Global dispatcher instance
event_dispatcher = EventDispatcher()


def setup_event_handlers(app):
    """Initialize event handlers with Flask app context.

    Call this during app initialization.
    """
    from .handlers import (
        EventPersistenceHandler,
        ActivityLogHandler,
        WebSocketHandler,
    )

    # Persistence handler - saves all events to domain_events table
    persistence_handler = EventPersistenceHandler(app)
    event_dispatcher.register_global(persistence_handler)

    # Activity log handler - creates human-readable logs
    activity_handler = ActivityLogHandler(app)
    event_dispatcher.register_global(activity_handler)

    # WebSocket handler - broadcasts real-time updates
    websocket_handler = WebSocketHandler(app)
    event_dispatcher.register_global(websocket_handler)

    logger.info("Event handlers initialized")
