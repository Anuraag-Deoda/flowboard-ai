"""Column endpoints."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError

from ..extensions import db
from ..models import Column, Board, Project, Workspace, OrganizationMember

columns_bp = Blueprint("columns", __name__)


class ColumnSchema(Schema):
    board_id = fields.UUID(required=True)
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    wip_limit = fields.Int(required=False, allow_none=True)
    color = fields.Str(required=False)


class ReorderSchema(Schema):
    column_ids = fields.List(fields.UUID(), required=True)


column_schema = ColumnSchema()
reorder_schema = ReorderSchema()


def check_board_access(board_id, user_id):
    """Check if user has access to board."""
    board = Board.query.get(board_id)
    if not board:
        return None, None

    project = Project.query.get(board.project_id)
    workspace = Workspace.query.get(project.workspace_id)
    membership = OrganizationMember.query.filter_by(
        organization_id=workspace.organization_id, user_id=user_id
    ).first()

    return board, membership


@columns_bp.route("/", methods=["POST"])
@jwt_required()
def create_column():
    """Create a new column."""
    user_id = get_jwt_identity()

    try:
        data = column_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    board, membership = check_board_access(data["board_id"], user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Get next position
    max_pos = db.session.query(db.func.max(Column.position)).filter_by(
        board_id=data["board_id"]
    ).scalar() or -1

    column = Column(
        board_id=data["board_id"],
        name=data["name"],
        position=max_pos + 1,
        wip_limit=data.get("wip_limit"),
        color=data.get("color"),
    )
    db.session.add(column)
    db.session.commit()

    return jsonify({"column": column.to_dict()}), 201


@columns_bp.route("/<uuid:column_id>", methods=["GET"])
@jwt_required()
def get_column(column_id):
    """Get column with cards."""
    user_id = get_jwt_identity()

    column = Column.query.get(column_id)
    if not column:
        return jsonify({"error": "Column not found"}), 404

    board, membership = check_board_access(column.board_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"column": column.to_dict(include_cards=True)})


@columns_bp.route("/<uuid:column_id>", methods=["PUT"])
@jwt_required()
def update_column(column_id):
    """Update column."""
    user_id = get_jwt_identity()

    column = Column.query.get(column_id)
    if not column:
        return jsonify({"error": "Column not found"}), 404

    board, membership = check_board_access(column.board_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    data = request.json
    if "name" in data:
        column.name = data["name"]
    if "wip_limit" in data:
        column.wip_limit = data["wip_limit"]
    if "color" in data:
        column.color = data["color"]

    db.session.commit()
    return jsonify({"column": column.to_dict()})


@columns_bp.route("/<uuid:column_id>", methods=["DELETE"])
@jwt_required()
def delete_column(column_id):
    """Delete column."""
    user_id = get_jwt_identity()

    column = Column.query.get(column_id)
    if not column:
        return jsonify({"error": "Column not found"}), 404

    board, membership = check_board_access(column.board_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Check if column has cards
    if column.cards:
        return jsonify({"error": "Cannot delete column with cards"}), 400

    db.session.delete(column)
    db.session.commit()

    return jsonify({"message": "Column deleted"})


@columns_bp.route("/reorder", methods=["PUT"])
@jwt_required()
def reorder_columns():
    """Reorder columns within a board."""
    user_id = get_jwt_identity()

    try:
        data = reorder_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    if not data["column_ids"]:
        return jsonify({"error": "No columns provided"}), 400

    # Get first column to check access
    first_column = Column.query.get(data["column_ids"][0])
    if not first_column:
        return jsonify({"error": "Column not found"}), 404

    board, membership = check_board_access(first_column.board_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Update positions
    for position, column_id in enumerate(data["column_ids"]):
        column = Column.query.get(column_id)
        if column and column.board_id == first_column.board_id:
            column.position = position

    db.session.commit()

    # Return updated columns
    columns = Column.query.filter_by(board_id=first_column.board_id).order_by(
        Column.position
    ).all()

    return jsonify({"columns": [c.to_dict() for c in columns]})
