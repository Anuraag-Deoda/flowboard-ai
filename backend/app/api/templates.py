"""Board templates API endpoints."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import Board, Project, Workspace, OrganizationMember, Column

templates_bp = Blueprint("templates", __name__)

# Predefined board templates
BOARD_TEMPLATES = {
    "kanban_basic": {
        "name": "Basic Kanban",
        "description": "Simple three-column workflow for small teams",
        "icon": "layout",
        "columns": [
            {"name": "To Do", "position": 0, "color": "#94a3b8"},
            {"name": "In Progress", "position": 1, "color": "#3b82f6", "wip_limit": 5},
            {"name": "Done", "position": 2, "color": "#22c55e"},
        ]
    },
    "scrum": {
        "name": "Scrum Board",
        "description": "Sprint-based workflow with testing phase",
        "icon": "zap",
        "columns": [
            {"name": "Backlog", "position": 0, "color": "#94a3b8"},
            {"name": "To Do", "position": 1, "color": "#f59e0b"},
            {"name": "In Progress", "position": 2, "color": "#3b82f6", "wip_limit": 4},
            {"name": "In Review", "position": 3, "color": "#8b5cf6", "wip_limit": 3},
            {"name": "Done", "position": 4, "color": "#22c55e"},
        ]
    },
    "software_dev": {
        "name": "Software Development",
        "description": "Full development lifecycle with code review and QA",
        "icon": "code",
        "columns": [
            {"name": "Backlog", "position": 0, "color": "#94a3b8"},
            {"name": "Ready", "position": 1, "color": "#f59e0b"},
            {"name": "In Development", "position": 2, "color": "#3b82f6", "wip_limit": 3},
            {"name": "Code Review", "position": 3, "color": "#8b5cf6", "wip_limit": 2},
            {"name": "QA Testing", "position": 4, "color": "#ec4899", "wip_limit": 3},
            {"name": "Ready for Deploy", "position": 5, "color": "#06b6d4"},
            {"name": "Done", "position": 6, "color": "#22c55e"},
        ]
    },
    "bug_tracking": {
        "name": "Bug Tracking",
        "description": "Track and manage bug reports through resolution",
        "icon": "bug",
        "columns": [
            {"name": "Reported", "position": 0, "color": "#ef4444"},
            {"name": "Confirmed", "position": 1, "color": "#f59e0b"},
            {"name": "In Progress", "position": 2, "color": "#3b82f6", "wip_limit": 5},
            {"name": "Fixed", "position": 3, "color": "#8b5cf6"},
            {"name": "Verified", "position": 4, "color": "#22c55e"},
            {"name": "Closed", "position": 5, "color": "#64748b"},
        ]
    },
    "marketing": {
        "name": "Marketing Campaign",
        "description": "Plan and execute marketing campaigns",
        "icon": "megaphone",
        "columns": [
            {"name": "Ideas", "position": 0, "color": "#fbbf24"},
            {"name": "Planning", "position": 1, "color": "#f59e0b"},
            {"name": "In Production", "position": 2, "color": "#3b82f6", "wip_limit": 3},
            {"name": "Awaiting Approval", "position": 3, "color": "#8b5cf6"},
            {"name": "Scheduled", "position": 4, "color": "#06b6d4"},
            {"name": "Published", "position": 5, "color": "#22c55e"},
        ]
    },
    "design": {
        "name": "Design Pipeline",
        "description": "Creative workflow for design projects",
        "icon": "palette",
        "columns": [
            {"name": "Brief", "position": 0, "color": "#f472b6"},
            {"name": "Research", "position": 1, "color": "#a78bfa"},
            {"name": "Concept", "position": 2, "color": "#60a5fa"},
            {"name": "Design", "position": 3, "color": "#3b82f6", "wip_limit": 3},
            {"name": "Feedback", "position": 4, "color": "#f59e0b"},
            {"name": "Final", "position": 5, "color": "#22c55e"},
        ]
    },
    "personal": {
        "name": "Personal Tasks",
        "description": "Simple task management for individuals",
        "icon": "user",
        "columns": [
            {"name": "Inbox", "position": 0, "color": "#94a3b8"},
            {"name": "Today", "position": 1, "color": "#ef4444", "wip_limit": 5},
            {"name": "This Week", "position": 2, "color": "#3b82f6"},
            {"name": "Later", "position": 3, "color": "#8b5cf6"},
            {"name": "Done", "position": 4, "color": "#22c55e"},
        ]
    },
    "customer_support": {
        "name": "Customer Support",
        "description": "Track support tickets through resolution",
        "icon": "headphones",
        "columns": [
            {"name": "New", "position": 0, "color": "#ef4444"},
            {"name": "Triaged", "position": 1, "color": "#f59e0b"},
            {"name": "In Progress", "position": 2, "color": "#3b82f6", "wip_limit": 5},
            {"name": "Awaiting Customer", "position": 3, "color": "#8b5cf6"},
            {"name": "Resolved", "position": 4, "color": "#22c55e"},
            {"name": "Closed", "position": 5, "color": "#64748b"},
        ]
    },
}


def check_project_access(project_id, user_id):
    """Check if user has access to project."""
    project = Project.query.get(project_id)
    if not project:
        return None, None, None

    workspace = Workspace.query.get(project.workspace_id)
    membership = OrganizationMember.query.filter_by(
        organization_id=workspace.organization_id, user_id=user_id
    ).first()

    return project, workspace, membership


@templates_bp.route("", methods=["GET"])
@jwt_required()
def list_templates():
    """List available board templates."""
    templates = [
        {
            "id": key,
            "name": template["name"],
            "description": template["description"],
            "icon": template["icon"],
            "column_count": len(template["columns"]),
            "columns_preview": [c["name"] for c in template["columns"]],
        }
        for key, template in BOARD_TEMPLATES.items()
    ]
    return jsonify({"templates": templates})


@templates_bp.route("/<template_id>", methods=["GET"])
@jwt_required()
def get_template(template_id):
    """Get details of a specific template."""
    if template_id not in BOARD_TEMPLATES:
        return jsonify({"error": "Template not found"}), 404

    template = BOARD_TEMPLATES[template_id]
    return jsonify({
        "template": {
            "id": template_id,
            **template,
        }
    })


@templates_bp.route("/<template_id>/apply", methods=["POST"])
@jwt_required()
def apply_template(template_id):
    """Create a new board from a template."""
    user_id = get_jwt_identity()

    if template_id not in BOARD_TEMPLATES:
        return jsonify({"error": "Template not found"}), 404

    data = request.json or {}
    project_id = data.get("project_id")
    board_name = data.get("name")

    if not project_id:
        return jsonify({"error": "project_id is required"}), 400

    project, workspace, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    template = BOARD_TEMPLATES[template_id]

    # Use custom name or template name
    name = board_name or template["name"]

    # Create board
    board = Board(
        project_id=project_id,
        name=name,
    )
    db.session.add(board)
    db.session.flush()

    # Create columns from template
    for col_data in template["columns"]:
        column = Column(
            board_id=board.id,
            name=col_data["name"],
            position=col_data["position"],
            color=col_data.get("color"),
            wip_limit=col_data.get("wip_limit"),
        )
        db.session.add(column)

    db.session.commit()

    return jsonify({
        "board": board.to_dict(include_columns=True),
        "message": f"Board created from template '{template['name']}'"
    }), 201
