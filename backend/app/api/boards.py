"""Board endpoints."""

import csv
import io
from datetime import datetime
from flask import Blueprint, request, jsonify, Response
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


@boards_bp.route("/<uuid:board_id>/export", methods=["GET"])
@jwt_required()
def export_board(board_id):
    """Export board data to CSV."""
    user_id = get_jwt_identity()
    export_format = request.args.get("format", "csv")

    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    project, workspace, membership = check_project_access(board.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Collect all cards from all columns
    cards_data = []
    for column in board.columns:
        for card in column.cards:
            assignees = ", ".join([
                a.user.full_name or a.user.email for a in card.assignees
            ]) if card.assignees else ""

            labels = ", ".join([
                cl.label.name for cl in card.labels
            ]) if card.labels else ""

            cards_data.append({
                "id": str(card.id),
                "title": card.title,
                "description": card.description or "",
                "status": column.name,
                "priority": card.priority or "",
                "story_points": card.story_points if card.story_points else "",
                "time_estimate": card.time_estimate if card.time_estimate else "",
                "due_date": card.due_date.isoformat() if card.due_date else "",
                "assignees": assignees,
                "labels": labels,
                "created_at": card.created_at.isoformat(),
                "position": card.position,
            })

    if export_format == "json":
        return jsonify({
            "board_name": board.name,
            "exported_at": datetime.utcnow().isoformat(),
            "total_cards": len(cards_data),
            "cards": cards_data
        })

    # Default: CSV export
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "id", "title", "description", "status", "priority", "story_points",
        "time_estimate", "due_date", "assignees", "labels", "created_at", "position"
    ])
    writer.writeheader()
    writer.writerows(cards_data)

    response = Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={board.name.replace(' ', '_')}_export_{datetime.utcnow().strftime('%Y%m%d')}.csv"
        }
    )
    return response


@boards_bp.route("/<uuid:board_id>/export/summary", methods=["GET"])
@jwt_required()
def export_board_summary(board_id):
    """Export board summary as JSON (for PDF generation on frontend)."""
    user_id = get_jwt_identity()

    board = Board.query.get(board_id)
    if not board:
        return jsonify({"error": "Board not found"}), 404

    project, workspace, membership = check_project_access(board.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Build summary data
    columns_summary = []
    total_cards = 0
    total_points = 0
    completed_points = 0
    priority_breakdown = {"P0": 0, "P1": 0, "P2": 0, "P3": 0, "P4": 0, "None": 0}

    for column in board.columns:
        col_cards = len(column.cards)
        col_points = sum(c.story_points or 0 for c in column.cards)
        total_cards += col_cards
        total_points += col_points

        if column.name.lower() == "done":
            completed_points += col_points

        for card in column.cards:
            priority = card.priority if card.priority else "None"
            if priority in priority_breakdown:
                priority_breakdown[priority] += 1

        columns_summary.append({
            "name": column.name,
            "card_count": col_cards,
            "story_points": col_points,
            "wip_limit": column.wip_limit,
            "is_over_limit": column.wip_limit and col_cards > column.wip_limit,
        })

    # Assignee workload
    assignee_workload = {}
    for column in board.columns:
        for card in column.cards:
            for assignee in card.assignees:
                user_name = assignee.user.full_name or assignee.user.email
                if user_name not in assignee_workload:
                    assignee_workload[user_name] = {"cards": 0, "points": 0}
                assignee_workload[user_name]["cards"] += 1
                assignee_workload[user_name]["points"] += card.story_points or 0

    return jsonify({
        "board_name": board.name,
        "project_name": project.name if project else "",
        "exported_at": datetime.utcnow().isoformat(),
        "summary": {
            "total_cards": total_cards,
            "total_story_points": total_points,
            "completed_story_points": completed_points,
            "completion_rate": round((completed_points / total_points * 100) if total_points > 0 else 0, 1),
        },
        "columns": columns_summary,
        "priority_breakdown": priority_breakdown,
        "assignee_workload": [
            {"name": name, **data} for name, data in assignee_workload.items()
        ],
    })
