"""Subtask model - checklist items within a card."""

from sqlalchemy import Column, String, Boolean, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class Subtask(db.Model, UUIDMixin, TimestampMixin):
    """Subtask - checklist item within a card."""

    __tablename__ = "subtasks"

    card_id = Column(
        UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String(500), nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    position = Column(Integer, nullable=False, default=0)

    # Relationships
    card = relationship("Card", back_populates="subtasks")

    def to_dict(self):
        """Serialize subtask to dictionary."""
        return {
            "id": str(self.id),
            "card_id": str(self.card_id),
            "title": self.title,
            "is_completed": self.is_completed,
            "position": self.position,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<Subtask {self.title[:30]}>"
