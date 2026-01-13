"""Card link model - relationships between cards."""

from sqlalchemy import Column as SAColumn, String, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class LinkType(enum.Enum):
    """Types of card relationships."""

    BLOCKS = "blocks"           # This card blocks another
    BLOCKED_BY = "blocked_by"   # This card is blocked by another
    RELATES_TO = "relates_to"   # Related cards
    DUPLICATES = "duplicates"   # This card duplicates another
    DUPLICATED_BY = "duplicated_by"  # This card is duplicated by another


# Inverse relationship mapping
INVERSE_LINK_TYPES = {
    LinkType.BLOCKS: LinkType.BLOCKED_BY,
    LinkType.BLOCKED_BY: LinkType.BLOCKS,
    LinkType.RELATES_TO: LinkType.RELATES_TO,
    LinkType.DUPLICATES: LinkType.DUPLICATED_BY,
    LinkType.DUPLICATED_BY: LinkType.DUPLICATES,
}


class CardLink(db.Model, UUIDMixin, TimestampMixin):
    """Card link - relationship between two cards."""

    __tablename__ = "card_links"

    source_card_id = SAColumn(
        UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    target_card_id = SAColumn(
        UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    link_type = SAColumn(Enum(LinkType), nullable=False)
    created_by = SAColumn(UUID(as_uuid=True), ForeignKey("users.id"))

    # Relationships
    source_card = relationship(
        "Card", foreign_keys=[source_card_id], backref="outgoing_links"
    )
    target_card = relationship(
        "Card", foreign_keys=[target_card_id], backref="incoming_links"
    )
    created_by_user = relationship("User")

    def to_dict(self):
        """Serialize card link to dictionary."""
        return {
            "id": str(self.id),
            "source_card_id": str(self.source_card_id),
            "target_card_id": str(self.target_card_id),
            "link_type": self.link_type.value,
            "source_card": {
                "id": str(self.source_card.id),
                "title": self.source_card.title,
            } if self.source_card else None,
            "target_card": {
                "id": str(self.target_card.id),
                "title": self.target_card.title,
            } if self.target_card else None,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<CardLink {self.link_type.value}: {self.source_card_id} -> {self.target_card_id}>"
