"""Card endpoints with domain event emission."""

from uuid import UUID
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError

from ..extensions import db
import os
import uuid as uuid_lib
from werkzeug.utils import secure_filename

from ..models import (
    Card, Column, Board, Project, Workspace, OrganizationMember,
    CardAssignee, CardLabel, Label, Comment, Priority, ActivityLog, Subtask,
    CardLink, LinkType, INVERSE_LINK_TYPES, Attachment
)

# File upload configuration
UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "uploads")
ALLOWED_EXTENSIONS = {"txt", "pdf", "png", "jpg", "jpeg", "gif", "doc", "docx", "xls", "xlsx", "csv", "zip", "md"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
from ..events import event_dispatcher
from ..events.base import DomainEventBase

cards_bp = Blueprint("cards", __name__)


class CardCreateSchema(Schema):
    column_id = fields.UUID(required=True)
    title = fields.Str(required=True, validate=validate.Length(min=1, max=500))
    description = fields.Str(required=False)
    priority = fields.Str(required=False, validate=validate.OneOf(["P0", "P1", "P2", "P3", "P4"]))
    story_points = fields.Int(required=False)
    time_estimate = fields.Int(required=False)
    due_date = fields.Date(required=False)


class CardMoveSchema(Schema):
    column_id = fields.UUID(required=True)
    position = fields.Int(required=True)


class CommentSchema(Schema):
    content = fields.Str(required=True, validate=validate.Length(min=1))


card_create_schema = CardCreateSchema()
card_move_schema = CardMoveSchema()
comment_schema = CommentSchema()


def check_column_access(column_id, user_id):
    """Check if user has access to column's board."""
    column = Column.query.get(column_id)
    if not column:
        return None, None, None

    board = Board.query.get(column.board_id)
    project = Project.query.get(board.project_id)
    workspace = Workspace.query.get(project.workspace_id)
    membership = OrganizationMember.query.filter_by(
        organization_id=workspace.organization_id, user_id=user_id
    ).first()

    return column, board, membership


def emit_card_event(event_type: str, card: Card, actor_id: str, payload: dict = None):
    """Emit a card domain event."""
    board = Board.query.get(card.column.board_id)

    event = DomainEventBase(
        event_type=event_type,
        aggregate_type="card",
        aggregate_id=card.id,
        actor_id=UUID(actor_id),
        payload={
            "card_id": str(card.id),
            "board_id": str(board.id),
            "column_id": str(card.column_id),
            **(payload or {}),
        },
    )
    event_dispatcher.emit(event)


@cards_bp.route("/", methods=["GET"])
@jwt_required()
def list_cards():
    """List cards with optional filters."""
    user_id = get_jwt_identity()
    column_id = request.args.get("column_id")
    board_id = request.args.get("board_id")

    if column_id:
        column, board, membership = check_column_access(column_id, user_id)
        if not membership:
            return jsonify({"error": "Forbidden"}), 403
        cards = Card.query.filter_by(column_id=column_id).order_by(Card.position).all()
    elif board_id:
        board = Board.query.get(board_id)
        if not board:
            return jsonify({"error": "Board not found"}), 404
        # Check access via any column
        if board.columns:
            _, _, membership = check_column_access(board.columns[0].id, user_id)
            if not membership:
                return jsonify({"error": "Forbidden"}), 403
        cards = Card.query.join(Column).filter(Column.board_id == board_id).order_by(
            Column.position, Card.position
        ).all()
    else:
        return jsonify({"error": "column_id or board_id required"}), 400

    return jsonify({"cards": [c.to_dict() for c in cards]})


@cards_bp.route("/", methods=["POST"])
@jwt_required()
def create_card():
    """Create a new card."""
    user_id = get_jwt_identity()

    try:
        data = card_create_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    column, board, membership = check_column_access(data["column_id"], user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Get next position
    max_pos = db.session.query(db.func.max(Card.position)).filter_by(
        column_id=data["column_id"]
    ).scalar() or -1

    card = Card(
        column_id=data["column_id"],
        title=data["title"],
        description=data.get("description"),
        priority=Priority(data["priority"]) if data.get("priority") else None,
        story_points=data.get("story_points"),
        time_estimate=data.get("time_estimate"),
        due_date=data.get("due_date"),
        position=max_pos + 1,
        created_by=user_id,
    )
    db.session.add(card)
    db.session.commit()

    # Emit event
    emit_card_event("card.created", card, user_id, {
        "title": card.title,
        "priority": card.priority.value if card.priority else None,
    })

    return jsonify({"card": card.to_dict(include_details=True)}), 201


@cards_bp.route("/<uuid:card_id>", methods=["GET"])
@jwt_required()
def get_card(card_id):
    """Get card with full details."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"card": card.to_dict(include_details=True)})


@cards_bp.route("/<uuid:card_id>", methods=["PUT"])
@jwt_required()
def update_card(card_id):
    """Update card."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    data = request.json
    changes = {}

    if "title" in data:
        card.title = data["title"]
        changes["title"] = data["title"]
    if "description" in data:
        card.description = data["description"]
    if "priority" in data:
        card.priority = Priority(data["priority"]) if data["priority"] else None
        changes["priority"] = data["priority"]
    if "story_points" in data:
        card.story_points = data["story_points"]
    if "time_estimate" in data:
        card.time_estimate = data["time_estimate"]
    if "due_date" in data:
        card.due_date = data["due_date"]

    db.session.commit()

    # Emit event
    if changes:
        emit_card_event("card.updated", card, user_id, {"changes": changes})

    return jsonify({"card": card.to_dict(include_details=True)})


@cards_bp.route("/<uuid:card_id>", methods=["DELETE"])
@jwt_required()
def delete_card(card_id):
    """Delete card."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    card_title = card.title
    board_id = board.id

    db.session.delete(card)
    db.session.commit()

    # Emit event (manually since card is deleted)
    event = DomainEventBase(
        event_type="card.deleted",
        aggregate_type="card",
        aggregate_id=card_id,
        actor_id=UUID(user_id),
        payload={"card_id": str(card_id), "board_id": str(board_id), "title": card_title},
    )
    event_dispatcher.emit(event)

    return jsonify({"message": "Card deleted"})


@cards_bp.route("/<uuid:card_id>/move", methods=["PUT"])
@jwt_required()
def move_card(card_id):
    """Move card to different column/position."""
    user_id = get_jwt_identity()

    try:
        data = card_move_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    # Check access to source column
    source_column, source_board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Check access to target column
    target_column, target_board, _ = check_column_access(data["column_id"], user_id)
    if not target_column:
        return jsonify({"error": "Target column not found"}), 404

    # Ensure same board
    if source_board.id != target_board.id:
        return jsonify({"error": "Cannot move card to different board"}), 400

    # Store old values for event
    from_column_id = card.column_id
    from_position = card.position

    # Update card
    card.column_id = data["column_id"]
    card.position = data["position"]

    # Reorder other cards in target column
    cards_to_shift = Card.query.filter(
        Card.column_id == data["column_id"],
        Card.id != card_id,
        Card.position >= data["position"]
    ).all()
    for c in cards_to_shift:
        c.position += 1

    db.session.commit()

    # Emit move event
    emit_card_event("card.moved", card, user_id, {
        "from_column_id": str(from_column_id),
        "to_column_id": str(data["column_id"]),
        "from_position": from_position,
        "to_position": data["position"],
    })

    # Check WIP limit
    if target_column.is_over_wip_limit:
        wip_event = DomainEventBase(
            event_type="column.wip_exceeded",
            aggregate_type="column",
            aggregate_id=target_column.id,
            actor_id=UUID(user_id),
            payload={
                "board_id": str(target_board.id),
                "card_count": target_column.card_count,
                "wip_limit": target_column.wip_limit,
            },
        )
        event_dispatcher.emit(wip_event)

    return jsonify({"card": card.to_dict()})


@cards_bp.route("/<uuid:card_id>/assignees", methods=["POST"])
@jwt_required()
def assign_card(card_id):
    """Assign user to card."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    assignee_id = request.json.get("user_id")
    if not assignee_id:
        return jsonify({"error": "user_id required"}), 400

    # Check if already assigned
    existing = CardAssignee.query.filter_by(
        card_id=card_id, user_id=assignee_id
    ).first()
    if existing:
        return jsonify({"error": "User already assigned"}), 409

    assignee = CardAssignee(card_id=card_id, user_id=assignee_id)
    db.session.add(assignee)
    db.session.commit()

    # Emit event
    emit_card_event("card.assigned", card, user_id, {"assignee_id": assignee_id})

    return jsonify({"card": card.to_dict(include_details=True)})


@cards_bp.route("/<uuid:card_id>/assignees/<uuid:assignee_id>", methods=["DELETE"])
@jwt_required()
def unassign_card(card_id, assignee_id):
    """Remove user assignment from card."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    assignee = CardAssignee.query.filter_by(
        card_id=card_id, user_id=assignee_id
    ).first()
    if not assignee:
        return jsonify({"error": "Assignment not found"}), 404

    db.session.delete(assignee)
    db.session.commit()

    # Emit event
    emit_card_event("card.unassigned", card, user_id, {"assignee_id": str(assignee_id)})

    return jsonify({"card": card.to_dict(include_details=True)})


@cards_bp.route("/<uuid:card_id>/comments", methods=["POST"])
@jwt_required()
def add_comment(card_id):
    """Add comment to card."""
    user_id = get_jwt_identity()

    try:
        data = comment_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    comment = Comment(
        card_id=card_id,
        user_id=user_id,
        content=data["content"],
    )
    db.session.add(comment)
    db.session.commit()

    # Emit event
    emit_card_event("card.commented", card, user_id, {
        "comment_id": str(comment.id),
        "content_preview": data["content"][:100],
    })

    return jsonify({"comment": comment.to_dict()}), 201


@cards_bp.route("/<uuid:card_id>/labels", methods=["POST"])
@jwt_required()
def add_label_to_card(card_id):
    """Add label to card."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    label_id = request.json.get("label_id")
    if not label_id:
        return jsonify({"error": "label_id required"}), 400

    label = Label.query.get(label_id)
    if not label:
        return jsonify({"error": "Label not found"}), 404

    # Check if already added
    existing = CardLabel.query.filter_by(
        card_id=card_id, label_id=label_id
    ).first()
    if existing:
        return jsonify({"error": "Label already added"}), 409

    card_label = CardLabel(card_id=card_id, label_id=label_id)
    db.session.add(card_label)
    db.session.commit()

    return jsonify({"card": card.to_dict(include_details=True)})


@cards_bp.route("/<uuid:card_id>/labels/<uuid:label_id>", methods=["DELETE"])
@jwt_required()
def remove_label_from_card(card_id, label_id):
    """Remove label from card."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    card_label = CardLabel.query.filter_by(
        card_id=card_id, label_id=label_id
    ).first()
    if not card_label:
        return jsonify({"error": "Label not on card"}), 404

    db.session.delete(card_label)
    db.session.commit()

    return jsonify({"card": card.to_dict(include_details=True)})


@cards_bp.route("/<uuid:card_id>/activity", methods=["GET"])
@jwt_required()
def get_card_activity(card_id):
    """Get activity logs for a card."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    activities = ActivityLog.query.filter_by(card_id=card_id).order_by(
        ActivityLog.created_at.desc()
    ).limit(50).all()

    return jsonify({"activities": [a.to_dict() for a in activities]})


# Subtask endpoints

class SubtaskSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=1, max=500))


subtask_schema = SubtaskSchema()


@cards_bp.route("/<uuid:card_id>/subtasks", methods=["GET"])
@jwt_required()
def list_subtasks(card_id):
    """List subtasks for a card."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"subtasks": [s.to_dict() for s in card.subtasks]})


@cards_bp.route("/<uuid:card_id>/subtasks", methods=["POST"])
@jwt_required()
def create_subtask(card_id):
    """Create a subtask for a card."""
    user_id = get_jwt_identity()

    try:
        data = subtask_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Get next position
    max_pos = db.session.query(db.func.max(Subtask.position)).filter_by(
        card_id=card_id
    ).scalar() or -1

    subtask = Subtask(
        card_id=card_id,
        title=data["title"],
        position=max_pos + 1,
    )
    db.session.add(subtask)
    db.session.commit()

    return jsonify({"subtask": subtask.to_dict()}), 201


@cards_bp.route("/<uuid:card_id>/subtasks/<uuid:subtask_id>", methods=["PUT"])
@jwt_required()
def update_subtask(card_id, subtask_id):
    """Update a subtask."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    subtask = Subtask.query.filter_by(id=subtask_id, card_id=card_id).first()
    if not subtask:
        return jsonify({"error": "Subtask not found"}), 404

    data = request.json
    if "title" in data:
        subtask.title = data["title"]
    if "is_completed" in data:
        subtask.is_completed = data["is_completed"]
    if "position" in data:
        subtask.position = data["position"]

    db.session.commit()

    return jsonify({"subtask": subtask.to_dict()})


@cards_bp.route("/<uuid:card_id>/subtasks/<uuid:subtask_id>", methods=["DELETE"])
@jwt_required()
def delete_subtask(card_id, subtask_id):
    """Delete a subtask."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    subtask = Subtask.query.filter_by(id=subtask_id, card_id=card_id).first()
    if not subtask:
        return jsonify({"error": "Subtask not found"}), 404

    db.session.delete(subtask)
    db.session.commit()

    return jsonify({"message": "Subtask deleted"})


# Card Link endpoints

VALID_LINK_TYPES = ["blocks", "blocked_by", "relates_to", "duplicates", "duplicated_by"]


@cards_bp.route("/<uuid:card_id>/links", methods=["GET"])
@jwt_required()
def list_card_links(card_id):
    """List all links for a card (both outgoing and incoming)."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Get outgoing and incoming links
    outgoing = CardLink.query.filter_by(source_card_id=card_id).all()
    incoming = CardLink.query.filter_by(target_card_id=card_id).all()

    return jsonify({
        "links": {
            "outgoing": [l.to_dict() for l in outgoing],
            "incoming": [l.to_dict() for l in incoming],
        }
    })


@cards_bp.route("/<uuid:card_id>/links", methods=["POST"])
@jwt_required()
def create_card_link(card_id):
    """Create a link from this card to another card."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    data = request.json
    target_card_id = data.get("target_card_id")
    link_type_str = data.get("link_type")

    if not target_card_id or not link_type_str:
        return jsonify({"error": "target_card_id and link_type required"}), 400

    if link_type_str not in VALID_LINK_TYPES:
        return jsonify({"error": f"Invalid link_type. Must be one of: {VALID_LINK_TYPES}"}), 400

    # Prevent self-linking
    if str(card_id) == target_card_id:
        return jsonify({"error": "Cannot link a card to itself"}), 400

    # Check target card exists and user has access
    target_card = Card.query.get(target_card_id)
    if not target_card:
        return jsonify({"error": "Target card not found"}), 404

    # Check for existing link
    existing = CardLink.query.filter_by(
        source_card_id=card_id,
        target_card_id=target_card_id,
        link_type=LinkType(link_type_str)
    ).first()
    if existing:
        return jsonify({"error": "Link already exists"}), 409

    link = CardLink(
        source_card_id=card_id,
        target_card_id=target_card_id,
        link_type=LinkType(link_type_str),
        created_by=user_id,
    )
    db.session.add(link)
    db.session.commit()

    return jsonify({"link": link.to_dict()}), 201


@cards_bp.route("/<uuid:card_id>/links/<uuid:link_id>", methods=["DELETE"])
@jwt_required()
def delete_card_link(card_id, link_id):
    """Delete a card link."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Find link where this card is either source or target
    link = CardLink.query.filter(
        CardLink.id == link_id,
        db.or_(
            CardLink.source_card_id == card_id,
            CardLink.target_card_id == card_id
        )
    ).first()

    if not link:
        return jsonify({"error": "Link not found"}), 404

    db.session.delete(link)
    db.session.commit()

    return jsonify({"message": "Link deleted"})


# Attachment endpoints

@cards_bp.route("/<uuid:card_id>/attachments", methods=["GET"])
@jwt_required()
def list_attachments(card_id):
    """List attachments for a card."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"attachments": [a.to_dict() for a in card.attachments]})


@cards_bp.route("/<uuid:card_id>/attachments", methods=["POST"])
@jwt_required()
def upload_attachment(card_id):
    """Upload an attachment to a card."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    # Check file size
    file.seek(0, 2)  # Seek to end
    file_size = file.tell()
    file.seek(0)  # Seek back to start

    if file_size > MAX_FILE_SIZE:
        return jsonify({"error": f"File too large. Max size: {MAX_FILE_SIZE / (1024*1024):.0f}MB"}), 400

    # Secure the filename and generate unique storage path
    original_filename = secure_filename(file.filename)
    ext = original_filename.rsplit(".", 1)[1].lower() if "." in original_filename else ""
    storage_filename = f"{uuid_lib.uuid4().hex}.{ext}" if ext else f"{uuid_lib.uuid4().hex}"

    # Create upload directory if it doesn't exist
    card_upload_dir = os.path.join(UPLOAD_FOLDER, str(card_id))
    os.makedirs(card_upload_dir, exist_ok=True)

    storage_path = os.path.join(card_upload_dir, storage_filename)

    # Save file
    file.save(storage_path)

    # Get MIME type
    mime_type = file.content_type or "application/octet-stream"

    # Create attachment record
    attachment = Attachment(
        card_id=card_id,
        filename=original_filename,
        storage_path=storage_path,
        file_size=file_size,
        mime_type=mime_type,
        uploaded_by=user_id,
    )
    db.session.add(attachment)
    db.session.commit()

    return jsonify({"attachment": attachment.to_dict()}), 201


@cards_bp.route("/<uuid:card_id>/attachments/<uuid:attachment_id>", methods=["DELETE"])
@jwt_required()
def delete_attachment(card_id, attachment_id):
    """Delete an attachment."""
    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    attachment = Attachment.query.filter_by(id=attachment_id, card_id=card_id).first()
    if not attachment:
        return jsonify({"error": "Attachment not found"}), 404

    # Delete file from storage
    if os.path.exists(attachment.storage_path):
        os.remove(attachment.storage_path)

    db.session.delete(attachment)
    db.session.commit()

    return jsonify({"message": "Attachment deleted"})


@cards_bp.route("/<uuid:card_id>/attachments/<uuid:attachment_id>/download", methods=["GET"])
@jwt_required()
def download_attachment(card_id, attachment_id):
    """Download an attachment."""
    from flask import send_file

    user_id = get_jwt_identity()

    card = Card.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    column, board, membership = check_column_access(card.column_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    attachment = Attachment.query.filter_by(id=attachment_id, card_id=card_id).first()
    if not attachment:
        return jsonify({"error": "Attachment not found"}), 404

    if not os.path.exists(attachment.storage_path):
        return jsonify({"error": "File not found on server"}), 404

    return send_file(
        attachment.storage_path,
        download_name=attachment.filename,
        as_attachment=True,
        mimetype=attachment.mime_type
    )
