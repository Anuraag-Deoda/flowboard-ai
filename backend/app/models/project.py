"""Project model."""

from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class Project(db.Model, UUIDMixin, TimestampMixin):
    """Project - container for boards within a workspace."""

    __tablename__ = "projects"

    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Relationships
    workspace = relationship("Workspace", back_populates="projects")
    boards = relationship(
        "Board", back_populates="project", cascade="all, delete-orphan"
    )
    labels = relationship(
        "Label", back_populates="project", cascade="all, delete-orphan"
    )
    sprints = relationship(
        "Sprint", back_populates="project", cascade="all, delete-orphan"
    )
    daily_logs = relationship(
        "DailyLog", back_populates="project", cascade="all, delete-orphan"
    )

    def to_dict(self):
        """Serialize project to dictionary."""
        return {
            "id": str(self.id),
            "workspace_id": str(self.workspace_id),
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Project {self.name}>"
