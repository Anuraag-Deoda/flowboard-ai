"""Card model."""

from sqlalchemy import Column as SAColumn, String, Text, Integer, Date, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class Priority(enum.Enum):
    """Card priority levels."""

    P0 = "P0"  # Critical
    P1 = "P1"  # High
    P2 = "P2"  # Medium
    P3 = "P3"  # Low
    P4 = "P4"  # Minimal


class Card(db.Model, UUIDMixin, TimestampMixin):
    """Card - task/issue within a column."""

    __tablename__ = "cards"

    column_id = SAColumn(
        UUID(as_uuid=True), ForeignKey("columns.id"), nullable=False, index=True
    )
    title = SAColumn(String(500), nullable=False)
    description = SAColumn(Text)  # Markdown supported
    priority = SAColumn(Enum(Priority))
    story_points = SAColumn(Integer)
    time_estimate = SAColumn(Integer)  # in minutes
    due_date = SAColumn(Date)
    position = SAColumn(Integer, nullable=False, default=0)
    created_by = SAColumn(UUID(as_uuid=True), ForeignKey("users.id"))

    # Relationships
    column = relationship("Column", back_populates="cards")
    created_by_user = relationship("User", back_populates="created_cards")
    assignees = relationship(
        "CardAssignee", back_populates="card", cascade="all, delete-orphan"
    )
    labels = relationship(
        "CardLabel", back_populates="card", cascade="all, delete-orphan"
    )
    comments = relationship(
        "Comment", back_populates="card", cascade="all, delete-orphan",
        order_by="Comment.created_at"
    )
    activity_logs = relationship(
        "ActivityLog", back_populates="card", cascade="all, delete-orphan",
        order_by="ActivityLog.created_at.desc()"
    )
    sprint_associations = relationship(
        "CardSprint", back_populates="card", cascade="all, delete-orphan"
    )

    def to_dict(self, include_details=False):
        """Serialize card to dictionary."""
        data = {
            "id": str(self.id),
            "column_id": str(self.column_id),
            "title": self.title,
            "priority": self.priority.value if self.priority else None,
            "story_points": self.story_points,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "position": self.position,
            "assignees": [a.to_dict() for a in self.assignees],
            "labels": [l.to_dict() for l in self.labels],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

        if include_details:
            data.update({
                "description": self.description,
                "time_estimate": self.time_estimate,
                "created_by": str(self.created_by) if self.created_by else None,
                "created_by_user": self.created_by_user.to_dict() if self.created_by_user else None,
                "comments": [c.to_dict() for c in self.comments],
            })

        return data

    def __repr__(self):
        return f"<Card {self.title[:30]}>"


class CardAssignee(db.Model):
    """Card assignee association."""

    __tablename__ = "card_assignees"
    __table_args__ = (
        db.PrimaryKeyConstraint("card_id", "user_id"),
    )

    card_id = SAColumn(UUID(as_uuid=True), ForeignKey("cards.id"), nullable=False)
    user_id = SAColumn(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Relationships
    card = relationship("Card", back_populates="assignees")
    user = relationship("User")

    def to_dict(self):
        """Serialize assignee to dictionary."""
        return {
            "user_id": str(self.user_id),
            "user": self.user.to_dict() if self.user else None,
        }


class CardLabel(db.Model):
    """Card label association."""

    __tablename__ = "card_labels"
    __table_args__ = (
        db.PrimaryKeyConstraint("card_id", "label_id"),
    )

    card_id = SAColumn(UUID(as_uuid=True), ForeignKey("cards.id"), nullable=False)
    label_id = SAColumn(UUID(as_uuid=True), ForeignKey("labels.id"), nullable=False)

    # Relationships
    card = relationship("Card", back_populates="labels")
    label = relationship("Label")

    def to_dict(self):
        """Serialize card label to dictionary."""
        return {
            "label_id": str(self.label_id),
            "label": self.label.to_dict() if self.label else None,
        }
