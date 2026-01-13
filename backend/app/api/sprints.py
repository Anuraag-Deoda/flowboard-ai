"""Sprint management endpoints."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError
from datetime import datetime

from ..extensions import db
from ..models import (
    Sprint, SprintStatus, CardSprint, Card, Project, Workspace,
    OrganizationMember, SprintRetrospective, SprintNote, NoteType
)

sprints_bp = Blueprint("sprints", __name__)


class SprintSchema(Schema):
    project_id = fields.UUID(required=True)
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    goal = fields.Str(required=False)
    start_date = fields.Date(required=True)
    end_date = fields.Date(required=True)


class SprintUpdateSchema(Schema):
    name = fields.Str(validate=validate.Length(min=1, max=255))
    goal = fields.Str()
    start_date = fields.Date()
    end_date = fields.Date()
    status = fields.Str(validate=validate.OneOf(["planning", "active", "completed"]))


sprint_schema = SprintSchema()
sprint_update_schema = SprintUpdateSchema()


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


@sprints_bp.route("/", methods=["GET"])
@jwt_required()
def list_sprints():
    """List sprints for a project."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")
    status = request.args.get("status")

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    query = Sprint.query.filter_by(project_id=project_id)

    if status:
        try:
            query = query.filter_by(status=SprintStatus(status))
        except ValueError:
            return jsonify({"error": "Invalid status"}), 400

    sprints = query.order_by(Sprint.start_date.desc()).all()
    return jsonify({"sprints": [s.to_dict() for s in sprints]})


@sprints_bp.route("/", methods=["POST"])
@jwt_required()
def create_sprint():
    """Create a new sprint."""
    user_id = get_jwt_identity()

    try:
        data = sprint_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    project, membership = check_project_access(data["project_id"], user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Validate dates
    if data["end_date"] <= data["start_date"]:
        return jsonify({"error": "End date must be after start date"}), 400

    sprint = Sprint(
        project_id=data["project_id"],
        name=data["name"],
        goal=data.get("goal"),
        start_date=data["start_date"],
        end_date=data["end_date"],
        status=SprintStatus.PLANNING,
    )
    db.session.add(sprint)
    db.session.commit()

    return jsonify({"sprint": sprint.to_dict()}), 201


@sprints_bp.route("/<uuid:sprint_id>", methods=["GET"])
@jwt_required()
def get_sprint(sprint_id):
    """Get sprint with cards."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"sprint": sprint.to_dict(include_cards=True)})


@sprints_bp.route("/<uuid:sprint_id>", methods=["PUT"])
@jwt_required()
def update_sprint(sprint_id):
    """Update sprint."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    try:
        data = sprint_update_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    if "name" in data:
        sprint.name = data["name"]
    if "goal" in data:
        sprint.goal = data["goal"]
    if "start_date" in data:
        sprint.start_date = data["start_date"]
    if "end_date" in data:
        sprint.end_date = data["end_date"]
    if "status" in data:
        sprint.status = SprintStatus(data["status"])

    db.session.commit()
    return jsonify({"sprint": sprint.to_dict()})


@sprints_bp.route("/<uuid:sprint_id>", methods=["DELETE"])
@jwt_required()
def delete_sprint(sprint_id):
    """Delete sprint."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    db.session.delete(sprint)
    db.session.commit()

    return jsonify({"message": "Sprint deleted"})


@sprints_bp.route("/<uuid:sprint_id>/start", methods=["POST"])
@jwt_required()
def start_sprint(sprint_id):
    """Start a sprint (set status to active)."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    if sprint.status != SprintStatus.PLANNING:
        return jsonify({"error": "Can only start sprints in planning status"}), 400

    # Check if there's already an active sprint
    active_sprint = Sprint.query.filter_by(
        project_id=sprint.project_id, status=SprintStatus.ACTIVE
    ).first()
    if active_sprint:
        return jsonify({"error": "Another sprint is already active"}), 409

    sprint.status = SprintStatus.ACTIVE
    db.session.commit()

    return jsonify({"sprint": sprint.to_dict()})


@sprints_bp.route("/<uuid:sprint_id>/complete", methods=["POST"])
@jwt_required()
def complete_sprint(sprint_id):
    """Complete a sprint."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    if sprint.status != SprintStatus.ACTIVE:
        return jsonify({"error": "Can only complete active sprints"}), 400

    sprint.status = SprintStatus.COMPLETED
    db.session.commit()

    return jsonify({"sprint": sprint.to_dict()})


# Card-Sprint management

@sprints_bp.route("/<uuid:sprint_id>/cards", methods=["POST"])
@jwt_required()
def add_card_to_sprint(sprint_id):
    """Add a card to sprint."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    card_id = request.json.get("card_id")
    if not card_id:
        return jsonify({"error": "card_id required"}), 400

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    # Check if already in sprint
    existing = CardSprint.query.filter_by(
        card_id=card_id, sprint_id=sprint_id
    ).first()
    if existing:
        return jsonify({"error": "Card already in sprint"}), 409

    card_sprint = CardSprint(card_id=card_id, sprint_id=sprint_id)
    db.session.add(card_sprint)
    db.session.commit()

    return jsonify({"sprint": sprint.to_dict(include_cards=True)})


@sprints_bp.route("/<uuid:sprint_id>/cards/<uuid:card_id>", methods=["DELETE"])
@jwt_required()
def remove_card_from_sprint(sprint_id, card_id):
    """Remove a card from sprint."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    card_sprint = CardSprint.query.filter_by(
        card_id=card_id, sprint_id=sprint_id
    ).first()
    if not card_sprint:
        return jsonify({"error": "Card not in sprint"}), 404

    db.session.delete(card_sprint)
    db.session.commit()

    return jsonify({"sprint": sprint.to_dict(include_cards=True)})


# Sprint metrics

@sprints_bp.route("/<uuid:sprint_id>/metrics", methods=["GET"])
@jwt_required()
def get_sprint_metrics(sprint_id):
    """Get sprint metrics (velocity, burndown data, etc.)."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Calculate metrics
    cards = [assoc.card for assoc in sprint.card_associations]

    total_points = sum(c.story_points or 0 for c in cards)
    completed_cards = [c for c in cards if c.column and c.column.name.lower() == "done"]
    completed_points = sum(c.story_points or 0 for c in completed_cards)

    return jsonify({
        "metrics": {
            "total_cards": len(cards),
            "completed_cards": len(completed_cards),
            "total_story_points": total_points,
            "completed_story_points": completed_points,
            "completion_percentage": round((completed_points / total_points * 100) if total_points > 0 else 0, 1),
            "days_remaining": (sprint.end_date - datetime.now().date()).days if sprint.status == SprintStatus.ACTIVE else 0,
        }
    })
