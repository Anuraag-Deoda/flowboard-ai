"""AI-powered endpoints."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..services.ai_service import get_ai_service
from ..models import Card, Project, Workspace, OrganizationMember, Column, Board

ai_bp = Blueprint("ai", __name__)


def check_project_access(project_id, user_id):
    """Check if user has access to project."""
    project = Project.query.get(project_id)
    if not project:
        return None, None

    workspace = Workspace.query.get(project.workspace_id)
    membership = OrganizationMember.query.filter_by(
        organization_id=workspace.organization_id, user_id=user_id
    ).first()

    return project, membership


@ai_bp.route("/status", methods=["GET"])
@jwt_required()
def get_ai_status():
    """Check if AI features are enabled."""
    ai_service = get_ai_service()
    return jsonify({"enabled": ai_service.is_enabled()})


@ai_bp.route("/card/<uuid:card_id>/suggestions", methods=["GET"])
@jwt_required()
def get_card_suggestions(card_id):
    """Get AI suggestions for improving a card."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    # Get project access through card -> column -> board -> project
    column = Column.query.get(card.column_id)
    board = Board.query.get(column.board_id)
    project, membership = check_project_access(board.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    ai_service = get_ai_service()
    if not ai_service.is_enabled():
        return jsonify({"error": "AI features not enabled"}), 503

    suggestions = ai_service.suggest_card_improvements({
        "title": card.title,
        "description": card.description,
        "priority": card.priority.value if card.priority else None,
        "story_points": card.story_points,
    })

    if suggestions is None:
        return jsonify({"error": "Failed to generate suggestions"}), 500

    return jsonify({"suggestions": suggestions})


@ai_bp.route("/backlog/groom", methods=["POST"])
@jwt_required()
def groom_backlog():
    """Get AI suggestions for backlog grooming."""
    user_id = get_jwt_identity()
    project_id = request.json.get("project_id")

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    ai_service = get_ai_service()
    if not ai_service.is_enabled():
        return jsonify({"error": "AI features not enabled"}), 503

    # Get backlog cards (cards not in "Done" column)
    cards = (
        Card.query
        .join(Column)
        .join(Board)
        .filter(Board.project_id == project_id)
        .filter(Column.name != "Done")
        .order_by(Card.priority, Card.position)
        .limit(30)
        .all()
    )

    card_data = [
        {
            "title": c.title,
            "description": c.description,
            "priority": c.priority.value if c.priority else None,
            "story_points": c.story_points,
        }
        for c in cards
    ]

    suggestions = ai_service.groom_backlog(card_data)

    if suggestions is None:
        return jsonify({"error": "Failed to groom backlog"}), 500

    return jsonify({"grooming": suggestions})


@ai_bp.route("/sprint/goal", methods=["POST"])
@jwt_required()
def generate_sprint_goal():
    """Generate a sprint goal based on selected cards."""
    user_id = get_jwt_identity()
    card_ids = request.json.get("card_ids", [])
    project_context = request.json.get("project_context", "")

    if not card_ids:
        return jsonify({"error": "card_ids required"}), 400

    # Get cards and verify access
    cards = Card.query.filter(Card.id.in_(card_ids)).all()
    if not cards:
        return jsonify({"error": "No valid cards found"}), 404

    # Check project access via first card
    column = Column.query.get(cards[0].column_id)
    board = Board.query.get(column.board_id)
    project, membership = check_project_access(board.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    ai_service = get_ai_service()
    if not ai_service.is_enabled():
        return jsonify({"error": "AI features not enabled"}), 503

    card_data = [{"title": c.title} for c in cards]
    goal = ai_service.generate_sprint_goal(card_data, project_context)

    if goal is None:
        return jsonify({"error": "Failed to generate sprint goal"}), 500

    return jsonify({"goal": goal})


@ai_bp.route("/daily-log/summary", methods=["POST"])
@jwt_required()
def generate_daily_summary():
    """Generate a daily standup summary."""
    user_id = get_jwt_identity()
    tasks_worked = request.json.get("tasks_worked", [])
    blockers = request.json.get("blockers", "")

    if not tasks_worked:
        return jsonify({"error": "tasks_worked required"}), 400

    ai_service = get_ai_service()
    if not ai_service.is_enabled():
        return jsonify({"error": "AI features not enabled"}), 503

    summary = ai_service.suggest_daily_log_summary(tasks_worked, blockers)

    if summary is None:
        return jsonify({"error": "Failed to generate summary"}), 500

    return jsonify({"summary": summary})
