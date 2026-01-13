#!/usr/bin/env python3
"""Initialize the database with tables and optionally seed data."""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models import (
    User, Organization, OrganizationMember, Workspace, Project,
    Board, Column, Card, Label, Sprint, DailyLog, DomainEvent,
    Subtask, CardLink, Attachment
)
from app.models.column import DEFAULT_COLUMNS
from app.models.organization import MemberRole


def init_db():
    """Create all tables."""
    app = create_app()
    with app.app_context():
        db.create_all()
        print("Database tables created successfully!")


def seed_demo_data():
    """Seed demo data for development."""
    app = create_app()
    with app.app_context():
        # Check if already seeded
        if User.query.filter_by(email="demo@flowboard.ai").first():
            print("Demo data already exists. Skipping.")
            return

        # Create demo user
        user = User(
            email="demo@flowboard.ai",
            full_name="Demo User",
        )
        user.set_password("demo1234")
        db.session.add(user)
        db.session.flush()

        # Create organization
        org = Organization(
            name="Demo Organization",
            slug="demo-org",
        )
        db.session.add(org)
        db.session.flush()

        # Add user as admin
        membership = OrganizationMember(
            organization_id=org.id,
            user_id=user.id,
            role=MemberRole.ADMIN,
        )
        db.session.add(membership)

        # Create workspace
        workspace = Workspace(
            organization_id=org.id,
            name="Engineering",
        )
        db.session.add(workspace)
        db.session.flush()

        # Create project
        project = Project(
            workspace_id=workspace.id,
            name="FlowBoard Development",
            description="Building the FlowBoard AI application",
        )
        db.session.add(project)
        db.session.flush()

        # Create board
        board = Board(
            project_id=project.id,
            name="Sprint Board",
        )
        db.session.add(board)
        db.session.flush()

        # Create default columns
        columns = []
        for col_data in DEFAULT_COLUMNS:
            column = Column(
                board_id=board.id,
                name=col_data["name"],
                position=col_data["position"],
                color=col_data.get("color"),
                wip_limit=col_data.get("wip_limit"),
            )
            db.session.add(column)
            columns.append(column)
        db.session.flush()

        # Create some sample cards
        sample_cards = [
            {"title": "Set up authentication", "priority": "P1", "story_points": 5, "column_idx": 4},
            {"title": "Design database schema", "priority": "P0", "story_points": 8, "column_idx": 4},
            {"title": "Implement Kanban board UI", "priority": "P1", "story_points": 13, "column_idx": 3},
            {"title": "Add drag and drop functionality", "priority": "P2", "story_points": 8, "column_idx": 2},
            {"title": "Create daily log feature", "priority": "P2", "story_points": 5, "column_idx": 1},
            {"title": "Implement AI suggestions", "priority": "P3", "story_points": 13, "column_idx": 0},
            {"title": "Add real-time updates", "priority": "P2", "story_points": 8, "column_idx": 0},
            {"title": "Write documentation", "priority": "P4", "story_points": 3, "column_idx": 0},
        ]

        from app.models.card import Priority
        for i, card_data in enumerate(sample_cards):
            card = Card(
                column_id=columns[card_data["column_idx"]].id,
                title=card_data["title"],
                priority=Priority(card_data["priority"]),
                story_points=card_data["story_points"],
                position=i % 3,
                created_by=user.id,
            )
            db.session.add(card)

        # Create some labels
        labels = [
            {"name": "bug", "color": "#EF4444"},
            {"name": "feature", "color": "#3B82F6"},
            {"name": "enhancement", "color": "#8B5CF6"},
            {"name": "documentation", "color": "#6B7280"},
        ]
        for label_data in labels:
            label = Label(
                project_id=project.id,
                name=label_data["name"],
                color=label_data["color"],
            )
            db.session.add(label)

        db.session.commit()
        print("Demo data seeded successfully!")
        print(f"  Email: demo@flowboard.ai")
        print(f"  Password: demo1234")
        print(f"  Board ID: {board.id}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--seed":
        init_db()
        seed_demo_data()
    else:
        init_db()
