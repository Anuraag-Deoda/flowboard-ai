"""Activity log model - human-readable history for UI."""

from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class ActivityLog(db.Model, UUIDMixin, TimestampMixin):
    """Activity log - human-readable history derived from domain events."""

    __tablename__ = "activity_logs"

    card_id = Column(
        UUID(as_uuid=True), ForeignKey("cards.id"), nullable=True, index=True
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    action = Column(String(100), nullable=False)  # Human-readable action
    details = Column(JSONB)  # Additional context

    # Relationships
    card = relationship("Card", back_populates="activity_logs")
    user = relationship("User", back_populates="activity_logs")

    def to_dict(self):
        """Serialize activity log to dictionary."""
        return {
            "id": str(self.id),
            "card_id": str(self.card_id) if self.card_id else None,
            "user_id": str(self.user_id),
            "user": self.user.to_dict() if self.user else None,
            "action": self.action,
            "details": self.details,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<ActivityLog {self.action}>"


# Activity log action templates
ACTIVITY_ACTIONS = {
    "card.created": "created this card",
    "card.updated": "updated this card",
    "card.moved": "moved this card to {column_name}",
    "card.assigned": "assigned {assignee_name} to this card",
    "card.unassigned": "unassigned {assignee_name} from this card",
    "card.commented": "commented on this card",
    "card.blocked": "marked this card as blocked",
    "card.unblocked": "removed blocked status from this card",
    "card.completed": "marked this card as done",
}
