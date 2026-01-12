"""Comment model."""

from sqlalchemy import Column, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class Comment(db.Model, UUIDMixin, TimestampMixin):
    """Comment on a card."""

    __tablename__ = "comments"

    card_id = Column(
        UUID(as_uuid=True), ForeignKey("cards.id"), nullable=False, index=True
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    content = Column(Text, nullable=False)

    # Relationships
    card = relationship("Card", back_populates="comments")
    user = relationship("User", back_populates="comments")

    def to_dict(self):
        """Serialize comment to dictionary."""
        return {
            "id": str(self.id),
            "card_id": str(self.card_id),
            "user_id": str(self.user_id),
            "user": self.user.to_dict() if self.user else None,
            "content": self.content,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Comment {self.id}>"
