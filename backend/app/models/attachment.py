"""Attachment model - files attached to cards."""

from sqlalchemy import Column as SAColumn, String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class Attachment(db.Model, UUIDMixin, TimestampMixin):
    """Attachment - file attached to a card."""

    __tablename__ = "attachments"

    card_id = SAColumn(
        UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    filename = SAColumn(String(255), nullable=False)  # Original filename
    storage_path = SAColumn(String(500), nullable=False)  # Path in storage
    file_size = SAColumn(Integer, nullable=False)  # Size in bytes
    mime_type = SAColumn(String(100))  # MIME type
    uploaded_by = SAColumn(UUID(as_uuid=True), ForeignKey("users.id"))

    # Relationships
    card = relationship("Card", back_populates="attachments")
    uploaded_by_user = relationship("User")

    def to_dict(self):
        """Serialize attachment to dictionary."""
        return {
            "id": str(self.id),
            "card_id": str(self.card_id),
            "filename": self.filename,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "uploaded_by": str(self.uploaded_by) if self.uploaded_by else None,
            "uploaded_by_user": self.uploaded_by_user.to_dict() if self.uploaded_by_user else None,
            "created_at": self.created_at.isoformat(),
        }

    @property
    def file_size_display(self):
        """Return human-readable file size."""
        if self.file_size < 1024:
            return f"{self.file_size} B"
        elif self.file_size < 1024 * 1024:
            return f"{self.file_size / 1024:.1f} KB"
        else:
            return f"{self.file_size / (1024 * 1024):.1f} MB"

    def __repr__(self):
        return f"<Attachment {self.filename}>"
