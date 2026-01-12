"""Label model."""

from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin


class Label(db.Model, UUIDMixin):
    """Label - tag for categorizing cards within a project."""

    __tablename__ = "labels"

    project_id = Column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True
    )
    name = Column(String(100), nullable=False)
    color = Column(String(50))

    # Relationships
    project = relationship("Project", back_populates="labels")

    def to_dict(self):
        """Serialize label to dictionary."""
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "name": self.name,
            "color": self.color,
        }

    def __repr__(self):
        return f"<Label {self.name}>"
