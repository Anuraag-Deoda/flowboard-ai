"""Sprint and retrospective models."""

from sqlalchemy import Column, String, Text, Integer, Date, ForeignKey, Enum, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class SprintStatus(enum.Enum):
    """Sprint status."""

    PLANNING = "planning"
    ACTIVE = "active"
    COMPLETED = "completed"


class Sprint(db.Model, UUIDMixin, TimestampMixin):
    """Sprint - time-boxed iteration for a project."""

    __tablename__ = "sprints"

    project_id = Column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    goal = Column(Text)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(
        Enum(SprintStatus), nullable=False, default=SprintStatus.PLANNING
    )

    # Relationships
    project = relationship("Project", back_populates="sprints")
    card_associations = relationship(
        "CardSprint", back_populates="sprint", cascade="all, delete-orphan"
    )
    retrospective = relationship(
        "SprintRetrospective", back_populates="sprint", uselist=False,
        cascade="all, delete-orphan"
    )
    notes = relationship(
        "SprintNote", back_populates="sprint", cascade="all, delete-orphan",
        order_by="SprintNote.created_at"
    )

    def to_dict(self, include_cards=False):
        """Serialize sprint to dictionary."""
        data = {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "name": self.name,
            "goal": self.goal,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
        }
        if include_cards:
            data["cards"] = [assoc.card.to_dict() for assoc in self.card_associations]
        return data

    def __repr__(self):
        return f"<Sprint {self.name}>"


class CardSprint(db.Model):
    """Card-Sprint association."""

    __tablename__ = "card_sprints"
    __table_args__ = (
        db.PrimaryKeyConstraint("card_id", "sprint_id"),
    )

    card_id = Column(UUID(as_uuid=True), ForeignKey("cards.id"), nullable=False)
    sprint_id = Column(UUID(as_uuid=True), ForeignKey("sprints.id"), nullable=False)

    # Relationships
    card = relationship("Card", back_populates="sprint_associations")
    sprint = relationship("Sprint", back_populates="card_associations")


class SprintRetrospective(db.Model, UUIDMixin, TimestampMixin):
    """Sprint retrospective - post-sprint analysis."""

    __tablename__ = "sprint_retrospectives"
    __table_args__ = (
        CheckConstraint("team_mood >= 1 AND team_mood <= 5", name="ck_team_mood_range"),
    )

    sprint_id = Column(
        UUID(as_uuid=True), ForeignKey("sprints.id"), unique=True, nullable=False
    )
    what_went_well = Column(Text)
    what_went_wrong = Column(Text)
    action_items = Column(JSONB)  # [{description, assignee_id, status, card_id}]
    team_mood = Column(Integer)  # 1-5 scale
    ai_summary = Column(Text)  # AI-generated summary
    ai_insights = Column(JSONB)  # AI-detected patterns
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Relationships
    sprint = relationship("Sprint", back_populates="retrospective")

    def to_dict(self):
        """Serialize retrospective to dictionary."""
        return {
            "id": str(self.id),
            "sprint_id": str(self.sprint_id),
            "what_went_well": self.what_went_well,
            "what_went_wrong": self.what_went_wrong,
            "action_items": self.action_items,
            "team_mood": self.team_mood,
            "ai_summary": self.ai_summary,
            "ai_insights": self.ai_insights,
            "created_by": str(self.created_by) if self.created_by else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<SprintRetrospective {self.sprint_id}>"


class NoteType(enum.Enum):
    """Sprint note types."""

    OBSERVATION = "observation"
    RISK = "risk"
    DECISION = "decision"
    BLOCKER = "blocker"


class SprintNote(db.Model, UUIDMixin, TimestampMixin):
    """Sprint note - ongoing context during sprint."""

    __tablename__ = "sprint_notes"

    sprint_id = Column(
        UUID(as_uuid=True), ForeignKey("sprints.id"), nullable=False, index=True
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    note_type = Column(Enum(NoteType))

    # Relationships
    sprint = relationship("Sprint", back_populates="notes")
    user = relationship("User")

    def to_dict(self):
        """Serialize sprint note to dictionary."""
        return {
            "id": str(self.id),
            "sprint_id": str(self.sprint_id),
            "user_id": str(self.user_id),
            "user": self.user.to_dict() if self.user else None,
            "content": self.content,
            "note_type": self.note_type.value if self.note_type else None,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<SprintNote {self.id}>"
