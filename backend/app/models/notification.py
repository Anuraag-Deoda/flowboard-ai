"""Notification model."""

from enum import Enum
from sqlalchemy import Column, String, Boolean, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class NotificationType(str, Enum):
    """Types of notifications."""
    CARD_ASSIGNED = "card_assigned"
    CARD_MENTIONED = "card_mentioned"
    CARD_COMMENTED = "card_commented"
    CARD_DUE_SOON = "card_due_soon"
    CARD_OVERDUE = "card_overdue"
    CARD_MOVED = "card_moved"
    SPRINT_STARTED = "sprint_started"
    SPRINT_COMPLETED = "sprint_completed"
    SPRINT_ENDING_SOON = "sprint_ending_soon"
    ADDED_TO_PROJECT = "added_to_project"
    ADDED_TO_ORGANIZATION = "added_to_organization"
    CARD_BLOCKED = "card_blocked"
    SUBTASK_COMPLETED = "subtask_completed"


class Notification(db.Model, UUIDMixin, TimestampMixin):
    """Notification model for user alerts."""

    __tablename__ = "notifications"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    type = Column(SQLEnum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text)
    is_read = Column(Boolean, default=False, nullable=False)

    # Optional references to related entities
    card_id = Column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    sprint_id = Column(UUID(as_uuid=True), ForeignKey("sprints.id", ondelete="CASCADE"), nullable=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)

    # Who triggered the notification (optional)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Link for navigation
    action_url = Column(String(500))

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="notifications")
    actor = relationship("User", foreign_keys=[actor_id])
    card = relationship("Card", backref="notifications")
    project = relationship("Project", backref="notifications")
    sprint = relationship("Sprint", backref="notifications")
    organization = relationship("Organization", backref="notifications")

    def to_dict(self):
        """Serialize notification to dictionary."""
        return {
            "id": str(self.id),
            "type": self.type.value,
            "title": self.title,
            "message": self.message,
            "is_read": self.is_read,
            "card_id": str(self.card_id) if self.card_id else None,
            "project_id": str(self.project_id) if self.project_id else None,
            "sprint_id": str(self.sprint_id) if self.sprint_id else None,
            "organization_id": str(self.organization_id) if self.organization_id else None,
            "actor_id": str(self.actor_id) if self.actor_id else None,
            "actor": self.actor.to_dict() if self.actor else None,
            "action_url": self.action_url,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Notification {self.type.value} for {self.user_id}>"
