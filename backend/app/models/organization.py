"""Organization and membership models."""

from sqlalchemy import Column, String, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class MemberRole(enum.Enum):
    """Organization member roles."""

    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class Organization(db.Model, UUIDMixin, TimestampMixin):
    """Organization - top level grouping."""

    __tablename__ = "organizations"

    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)

    # Relationships
    members = relationship(
        "OrganizationMember", back_populates="organization", cascade="all, delete-orphan"
    )
    workspaces = relationship(
        "Workspace", back_populates="organization", cascade="all, delete-orphan"
    )

    def to_dict(self):
        """Serialize organization to dictionary."""
        return {
            "id": str(self.id),
            "name": self.name,
            "slug": self.slug,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Organization {self.name}>"


class OrganizationMember(db.Model, UUIDMixin):
    """Organization membership with role."""

    __tablename__ = "organization_members"
    __table_args__ = (
        db.UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
    )

    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(
        Enum(MemberRole), nullable=False, default=MemberRole.MEMBER
    )

    # Relationships
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="organization_memberships")

    def to_dict(self):
        """Serialize membership to dictionary."""
        return {
            "id": str(self.id),
            "organization_id": str(self.organization_id),
            "user_id": str(self.user_id),
            "role": self.role.value,
            "user": self.user.to_dict() if self.user else None,
        }

    def __repr__(self):
        return f"<OrganizationMember {self.user_id} in {self.organization_id}>"
