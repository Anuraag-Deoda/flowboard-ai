"""Labels API endpoints."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import Label, Board, Card, CardLabel

labels_bp = Blueprint("labels", __name__, url_prefix="/api/labels")


@labels_bp.route("/", methods=["GET"])
@jwt_required()
def list_labels():
    """List labels for a board (via its project)."""
    board_id = request.args.get("board_id")
    if not board_id:
        return jsonify({"error": "board_id is required"}), 400

    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    # Get project_id from board
    project_id = board.project_id

    labels = Label.query.filter_by(project_id=project_id).all()
    return jsonify({"labels": [l.to_dict() for l in labels]})


@labels_bp.route("/", methods=["POST"])
@jwt_required()
def create_label():
    """Create a new label."""
    data = request.get_json()

    board_id = data.get("board_id")
    if not board_id:
        return jsonify({"error": "board_id is required"}), 400

    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    name = data.get("name")
    if not name:
        return jsonify({"error": "name is required"}), 400

    color = data.get("color", "#6B7280")

    label = Label(
        project_id=board.project_id,
        name=name,
        color=color,
    )
    db.session.add(label)
    db.session.commit()

    return jsonify({"label": label.to_dict()}), 201


@labels_bp.route("/<label_id>", methods=["PUT"])
@jwt_required()
def update_label(label_id):
    """Update a label."""
    label = Label.query.get(label_id)
    if not label:
        return jsonify({"error": "Label not found"}), 404

    data = request.get_json()

    if "name" in data:
        label.name = data["name"]
    if "color" in data:
        label.color = data["color"]

    db.session.commit()

    return jsonify({"label": label.to_dict()})


@labels_bp.route("/<label_id>", methods=["DELETE"])
@jwt_required()
def delete_label(label_id):
    """Delete a label."""
    label = Label.query.get(label_id)
    if not label:
        return jsonify({"error": "Label not found"}), 404

    db.session.delete(label)
    db.session.commit()

    return jsonify({"message": "Label deleted"})
