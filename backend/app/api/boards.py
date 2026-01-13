"""Board endpoints."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError

from ..extensions import db
from ..models import Board, Project, Workspace, OrganizationMember, Column
from ..models.column import DEFAULT_COLUMNS

boards_bp = Blueprint("boards", __name__)


class BoardSchema(Schema):
    project_id = fields.UUID(required=True)
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))


board_schema = BoardSchema()


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


@boards_bp.route("/", methods=["GET"])
@jwt_required()
def list_boards():
    """List boards in a project."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, workspace, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    boards = Board.query.filter_by(project_id=project_id).all()
    return jsonify({"boards": [b.to_dict() for b in boards]})


@boards_bp.route("/", methods=["POST"])
@jwt_required()
def create_board():
    """Create a new board with default columns."""
    user_id = get_jwt_identity()

    try:
        data = board_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    project, workspace, membership = check_project_access(data["project_id"], user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Create board
    board = Board(
        project_id=data["project_id"],
        name=data["name"],
    )
    db.session.add(board)
    db.session.flush()

    # Create default columns
    for col_data in DEFAULT_COLUMNS:
        column = Column(
            board_id=board.id,
            name=col_data["name"],
            position=col_data["position"],
            color=col_data.get("color"),
            wip_limit=col_data.get("wip_limit"),
        )
        db.session.add(column)

    db.session.commit()

    return jsonify({"board": board.to_dict(include_columns=True)}), 201


@boards_bp.route("/<uuid:board_id>", methods=["GET"])
@jwt_required()
def get_board(board_id):
    """Get board with columns and cards."""
    user_id = get_jwt_identity()

    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    project, workspace, membership = check_project_access(board.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Build full board data with columns and cards
    board_data = board.to_dict()
    board_data["organization_id"] = str(workspace.organization_id)
    board_data["columns"] = []

    for column in board.columns:
        col_data = column.to_dict()
        col_data["cards"] = [card.to_dict() for card in column.cards]
        board_data["columns"].append(col_data)

    return jsonify({"board": board_data})


@boards_bp.route("/<uuid:board_id>", methods=["PUT"])
@jwt_required()
def update_board(board_id):
    """Update board."""
    user_id = get_jwt_identity()

    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    project, workspace, membership = check_project_access(board.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    data = request.json
    if "name" in data:
        board.name = data["name"]

    db.session.commit()
    return jsonify({"board": board.to_dict()})


@boards_bp.route("/<uuid:board_id>", methods=["DELETE"])
@jwt_required()
def delete_board(board_id):
    """Delete board."""
    user_id = get_jwt_identity()

    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    project, workspace, membership = check_project_access(board.project_id, user_id)
    from ..models import MemberRole
    if not membership or membership.role != MemberRole.ADMIN:
        return jsonify({"error": "Forbidden"}), 403

    db.session.delete(board)
    db.session.commit()

    return jsonify({"message": "Board deleted"})
