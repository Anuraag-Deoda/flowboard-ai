"""Workspace model."""

from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class Workspace(db.Model, UUIDMixin, TimestampMixin):
    """Workspace - container for projects within an organization."""

    __tablename__ = "workspaces"

    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="workspaces")
    projects = relationship(
        "Project", back_populates="workspace", cascade="all, delete-orphan"
    )

    def to_dict(self):
        """Serialize workspace to dictionary."""
        return {
            "id": str(self.id),
            "organization_id": str(self.organization_id),
            "name": self.name,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Workspace {self.name}>"
