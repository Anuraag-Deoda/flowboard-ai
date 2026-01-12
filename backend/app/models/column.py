"""Column model."""

from sqlalchemy import Column as SAColumn, String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class Column(db.Model, UUIDMixin, TimestampMixin):
    """Column - status column within a board."""

    __tablename__ = "columns"

    board_id = SAColumn(
        UUID(as_uuid=True), ForeignKey("boards.id"), nullable=False, index=True
    )
    name = SAColumn(String(255), nullable=False)
    position = SAColumn(Integer, nullable=False, default=0)
    wip_limit = SAColumn(Integer)  # None means no limit
    color = SAColumn(String(50))

    # Relationships
    board = relationship("Board", back_populates="columns")
    cards = relationship(
        "Card", back_populates="column", cascade="all, delete-orphan",
        order_by="Card.position"
    )

    @property
    def card_count(self):
        """Get the number of cards in this column."""
        return len(self.cards)

    @property
    def is_over_wip_limit(self):
        """Check if column exceeds WIP limit."""
        if self.wip_limit is None:
            return False
        return self.card_count > self.wip_limit

    def to_dict(self, include_cards=False):
        """Serialize column to dictionary."""
        data = {
            "id": str(self.id),
            "board_id": str(self.board_id),
            "name": self.name,
            "position": self.position,
            "wip_limit": self.wip_limit,
            "color": self.color,
            "card_count": self.card_count,
            "is_over_wip_limit": self.is_over_wip_limit,
        }
        if include_cards:
            data["cards"] = [card.to_dict() for card in self.cards]
        return data

    def __repr__(self):
        return f"<Column {self.name}>"


# Default column templates
DEFAULT_COLUMNS = [
    {"name": "Backlog", "position": 0, "color": "#6B7280"},
    {"name": "To Do", "position": 1, "color": "#3B82F6"},
    {"name": "In Progress", "position": 2, "color": "#F59E0B", "wip_limit": 3},
    {"name": "Review", "position": 3, "color": "#8B5CF6", "wip_limit": 2},
    {"name": "Done", "position": 4, "color": "#10B981"},
]
