"""User model."""

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import Column, String
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin, TimestampMixin

ph = PasswordHasher()


class User(db.Model, UUIDMixin, TimestampMixin):
    """User model for authentication and identity."""

    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    avatar_url = Column(String(500))

    # Relationships
    organization_memberships = relationship(
        "OrganizationMember", back_populates="user", cascade="all, delete-orphan"
    )
    created_cards = relationship("Card", back_populates="created_by_user")
    comments = relationship("Comment", back_populates="user")
    daily_logs = relationship("DailyLog", back_populates="user")
    activity_logs = relationship("ActivityLog", back_populates="user")

    def set_password(self, password: str) -> None:
        """Hash and set the user's password."""
        self.password_hash = ph.hash(password)

    def verify_password(self, password: str) -> bool:
        """Verify the user's password."""
        try:
            ph.verify(self.password_hash, password)
            # Rehash if needed (argon2 handles parameter upgrades)
            if ph.check_needs_rehash(self.password_hash):
                self.password_hash = ph.hash(password)
            return True
        except VerifyMismatchError:
            return False

    def to_dict(self):
        """Serialize user to dictionary."""
        return {
            "id": str(self.id),
            "email": self.email,
            "full_name": self.full_name,
            "avatar_url": self.avatar_url,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<User {self.email}>"
