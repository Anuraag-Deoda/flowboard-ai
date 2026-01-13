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


# Sprint Retrospective endpoints

class RetrospectiveSchema(Schema):
    what_went_well = fields.Str()
    what_went_wrong = fields.Str()
    action_items = fields.List(fields.Dict())  # [{description, assignee_id, status}]
    team_mood = fields.Int(validate=validate.Range(min=1, max=5))


class RetrospectiveUpdateSchema(Schema):
    what_went_well = fields.Str()
    what_went_wrong = fields.Str()
    action_items = fields.List(fields.Dict())
    team_mood = fields.Int(validate=validate.Range(min=1, max=5))


retrospective_schema = RetrospectiveSchema()
retrospective_update_schema = RetrospectiveUpdateSchema()


@sprints_bp.route("/<uuid:sprint_id>/retrospective", methods=["GET"])
@jwt_required()
def get_retrospective(sprint_id):
    """Get sprint retrospective."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    if not sprint.retrospective:
        return jsonify({"retrospective": None})

    return jsonify({"retrospective": sprint.retrospective.to_dict()})


@sprints_bp.route("/<uuid:sprint_id>/retrospective", methods=["POST"])
@jwt_required()
def create_retrospective(sprint_id):
    """Create sprint retrospective."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    if sprint.retrospective:
        return jsonify({"error": "Retrospective already exists for this sprint"}), 409

    try:
        data = retrospective_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    retrospective = SprintRetrospective(
        sprint_id=sprint_id,
        what_went_well=data.get("what_went_well"),
        what_went_wrong=data.get("what_went_wrong"),
        action_items=data.get("action_items", []),
        team_mood=data.get("team_mood"),
        created_by=user_id,
    )
    db.session.add(retrospective)
    db.session.commit()

    return jsonify({"retrospective": retrospective.to_dict()}), 201


@sprints_bp.route("/<uuid:sprint_id>/retrospective", methods=["PUT"])
@jwt_required()
def update_retrospective(sprint_id):
    """Update sprint retrospective."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    if not sprint.retrospective:
        return jsonify({"error": "No retrospective found for this sprint"}), 404

    try:
        data = retrospective_update_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    retro = sprint.retrospective
    if "what_went_well" in data:
        retro.what_went_well = data["what_went_well"]
    if "what_went_wrong" in data:
        retro.what_went_wrong = data["what_went_wrong"]
    if "action_items" in data:
        retro.action_items = data["action_items"]
    if "team_mood" in data:
        retro.team_mood = data["team_mood"]

    db.session.commit()
    return jsonify({"retrospective": retro.to_dict()})


@sprints_bp.route("/<uuid:sprint_id>/retrospective", methods=["DELETE"])
@jwt_required()
def delete_retrospective(sprint_id):
    """Delete sprint retrospective."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    if not sprint.retrospective:
        return jsonify({"error": "No retrospective found for this sprint"}), 404

    db.session.delete(sprint.retrospective)
    db.session.commit()

    return jsonify({"message": "Retrospective deleted"})


@sprints_bp.route("/<uuid:sprint_id>/retrospective/generate-summary", methods=["POST"])
@jwt_required()
def generate_retrospective_summary(sprint_id):
    """Generate AI summary for sprint retrospective."""
    from ..services.ai_service import get_ai_service

    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    ai_service = get_ai_service()
    if not ai_service.is_enabled():
        return jsonify({"error": "AI service not available"}), 503

    # Gather sprint context for AI
    cards = [assoc.card for assoc in sprint.card_associations]
    completed_cards = [c for c in cards if c.column and c.column.name.lower() == "done"]
    incomplete_cards = [c for c in cards if c.column and c.column.name.lower() != "done"]

    sprint_context = {
        "sprint_name": sprint.name,
        "sprint_goal": sprint.goal,
        "total_cards": len(cards),
        "completed_cards": len(completed_cards),
        "incomplete_cards": [c.title for c in incomplete_cards],
        "completed_titles": [c.title for c in completed_cards],
        "notes": [n.to_dict() for n in sprint.notes],
        "retrospective": sprint.retrospective.to_dict() if sprint.retrospective else None,
    }

    result = ai_service.generate_retrospective_summary(sprint_context)
    if not result:
        return jsonify({"error": "Failed to generate summary"}), 500

    # Save AI summary to retrospective if it exists
    if sprint.retrospective:
        sprint.retrospective.ai_summary = result.get("summary")
        sprint.retrospective.ai_insights = result.get("insights")
        db.session.commit()

    return jsonify({"ai_summary": result})


# Sprint Notes endpoints

class SprintNoteSchema(Schema):
    content = fields.Str(required=True, validate=validate.Length(min=1))
    note_type = fields.Str(validate=validate.OneOf(["observation", "risk", "decision", "blocker"]))


sprint_note_schema = SprintNoteSchema()


@sprints_bp.route("/<uuid:sprint_id>/notes", methods=["GET"])
@jwt_required()
def list_sprint_notes(sprint_id):
    """List all notes for a sprint."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    note_type = request.args.get("note_type")
    query = SprintNote.query.filter_by(sprint_id=sprint_id)

    if note_type:
        try:
            query = query.filter_by(note_type=NoteType(note_type))
        except ValueError:
            return jsonify({"error": "Invalid note_type"}), 400

    notes = query.order_by(SprintNote.created_at.desc()).all()
    return jsonify({"notes": [n.to_dict() for n in notes]})


@sprints_bp.route("/<uuid:sprint_id>/notes", methods=["POST"])
@jwt_required()
def create_sprint_note(sprint_id):
    """Create a sprint note."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    try:
        data = sprint_note_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    note = SprintNote(
        sprint_id=sprint_id,
        user_id=user_id,
        content=data["content"],
        note_type=NoteType(data["note_type"]) if data.get("note_type") else None,
    )
    db.session.add(note)
    db.session.commit()

    return jsonify({"note": note.to_dict()}), 201


@sprints_bp.route("/<uuid:sprint_id>/notes/<uuid:note_id>", methods=["PUT"])
@jwt_required()
def update_sprint_note(sprint_id, note_id):
    """Update a sprint note."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    note = SprintNote.query.filter_by(id=note_id, sprint_id=sprint_id).first()
    if not note:
        return jsonify({"error": "Note not found"}), 404

    # Only author can update
    if str(note.user_id) != user_id:
        return jsonify({"error": "Can only edit your own notes"}), 403

    try:
        data = sprint_note_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    note.content = data["content"]
    if data.get("note_type"):
        note.note_type = NoteType(data["note_type"])

    db.session.commit()
    return jsonify({"note": note.to_dict()})


@sprints_bp.route("/<uuid:sprint_id>/notes/<uuid:note_id>", methods=["DELETE"])
@jwt_required()
def delete_sprint_note(sprint_id, note_id):
    """Delete a sprint note."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    note = SprintNote.query.filter_by(id=note_id, sprint_id=sprint_id).first()
    if not note:
        return jsonify({"error": "Note not found"}), 404

    # Only author can delete
    if str(note.user_id) != user_id:
        return jsonify({"error": "Can only delete your own notes"}), 403

    db.session.delete(note)
    db.session.commit()

    return jsonify({"message": "Note deleted"})
