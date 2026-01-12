"""Daily log model."""

from sqlalchemy import Column, Text, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from ..extensions import db
from .base import UUIDMixin, TimestampMixin


class DailyLog(db.Model, UUIDMixin, TimestampMixin):
    """Daily log - programmer's daily time tracking."""

    __tablename__ = "daily_logs"
    __table_args__ = (
        UniqueConstraint("user_id", "project_id", "log_date", name="uq_daily_log"),
    )

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    project_id = Column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True
    )
    log_date = Column(Date, nullable=False, index=True)

    # Tasks worked on: [{card_id, time_spent (minutes), notes}]
    tasks_worked = Column(JSONB, default=list)
    remaining_work = Column(Text)
    blockers = Column(Text)
    notes = Column(Text)

    # Relationships
    user = relationship("User", back_populates="daily_logs")
    project = relationship("Project", back_populates="daily_logs")

    @property
    def total_time_spent(self):
        """Calculate total time spent in minutes."""
        if not self.tasks_worked:
            return 0
        return sum(task.get("time_spent", 0) for task in self.tasks_worked)

    def to_dict(self):
        """Serialize daily log to dictionary."""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "project_id": str(self.project_id),
            "log_date": self.log_date.isoformat(),
            "tasks_worked": self.tasks_worked,
            "total_time_spent": self.total_time_spent,
            "remaining_work": self.remaining_work,
            "blockers": self.blockers,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<DailyLog {self.user_id} {self.log_date}>"
