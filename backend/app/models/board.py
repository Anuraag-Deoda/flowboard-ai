"""Board model."""

from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class Board(db.Model, UUIDMixin, TimestampMixin):
    """Board - Kanban board within a project."""

    __tablename__ = "boards"

    project_id = Column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="boards")
    columns = relationship(
        "Column", back_populates="board", cascade="all, delete-orphan",
        order_by="Column.position"
    )

    def to_dict(self, include_columns=False):
        """Serialize board to dictionary."""
        data = {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "name": self.name,
            "created_at": self.created_at.isoformat(),
        }
        if include_columns:
            data["columns"] = [col.to_dict() for col in self.columns]
        return data

    def __repr__(self):
        return f"<Board {self.name}>"
