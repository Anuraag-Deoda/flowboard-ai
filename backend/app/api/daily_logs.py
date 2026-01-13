"""Daily log endpoints for time tracking."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError
from datetime import date, datetime, timedelta

from ..extensions import db
from ..models import DailyLog, Project, Workspace, OrganizationMember, Card

daily_logs_bp = Blueprint("daily_logs", __name__)


class TaskWorkedSchema(Schema):
    card_id = fields.UUID(required=True)
    time_spent = fields.Int(required=True, validate=validate.Range(min=0))  # minutes
    notes = fields.Str(required=False)


class DailyLogSchema(Schema):
    project_id = fields.UUID(required=True)
    log_date = fields.Date(required=False)  # Defaults to today
    tasks_worked = fields.List(fields.Nested(TaskWorkedSchema), required=False)
    remaining_work = fields.Str(required=False)
    blockers = fields.Str(required=False)
    notes = fields.Str(required=False)


daily_log_schema = DailyLogSchema()


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


@daily_logs_bp.route("/", methods=["GET"])
@jwt_required()
def list_daily_logs():
    """List daily logs with filters."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    user_filter = request.args.get("user_id")

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    query = DailyLog.query.filter_by(project_id=project_id)

    # Filter by user (default to current user)
    if user_filter:
        query = query.filter_by(user_id=user_filter)
    else:
        query = query.filter_by(user_id=user_id)

    # Filter by date range
    if start_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(DailyLog.log_date >= start)
        except ValueError:
            return jsonify({"error": "Invalid start_date format"}), 400

    if end_date:
        try:
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(DailyLog.log_date <= end)
        except ValueError:
            return jsonify({"error": "Invalid end_date format"}), 400

    logs = query.order_by(DailyLog.log_date.desc()).limit(30).all()
    return jsonify({"daily_logs": [log.to_dict() for log in logs]})


@daily_logs_bp.route("/today", methods=["GET"])
@jwt_required()
def get_today_log():
    """Get today's log for a project."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    log = DailyLog.query.filter_by(
        user_id=user_id,
        project_id=project_id,
        log_date=date.today()
    ).first()

    if not log:
        return jsonify({"daily_log": None, "suggestions": get_task_suggestions(user_id, project_id)})

    return jsonify({"daily_log": log.to_dict()})


@daily_logs_bp.route("/", methods=["POST"])
@jwt_required()
def create_or_update_daily_log():
    """Create or update a daily log."""
    user_id = get_jwt_identity()

    try:
        data = daily_log_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    project, membership = check_project_access(data["project_id"], user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    log_date = data.get("log_date", date.today())

    # Find existing log or create new one
    log = DailyLog.query.filter_by(
        user_id=user_id,
        project_id=data["project_id"],
        log_date=log_date
    ).first()

    if log:
        # Update existing
        if "tasks_worked" in data:
            log.tasks_worked = data["tasks_worked"]
            log.total_time_spent = sum(t.get("time_spent", 0) for t in data["tasks_worked"])
        if "remaining_work" in data:
            log.remaining_work = data["remaining_work"]
        if "blockers" in data:
            log.blockers = data["blockers"]
        if "notes" in data:
            log.notes = data["notes"]
    else:
        # Create new
        tasks = data.get("tasks_worked", [])
        log = DailyLog(
            user_id=user_id,
            project_id=data["project_id"],
            log_date=log_date,
            tasks_worked=tasks,
            total_time_spent=sum(t.get("time_spent", 0) for t in tasks),
            remaining_work=data.get("remaining_work"),
            blockers=data.get("blockers"),
            notes=data.get("notes"),
        )
        db.session.add(log)

    db.session.commit()
    return jsonify({"daily_log": log.to_dict()}), 201


@daily_logs_bp.route("/<uuid:log_id>", methods=["GET"])
@jwt_required()
def get_daily_log(log_id):
    """Get a specific daily log."""
    user_id = get_jwt_identity()

    log = DailyLog.query.get(log_id)
    if not log:
        return jsonify({"error": "Daily log not found"}), 404

    project, membership = check_project_access(log.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"daily_log": log.to_dict()})


@daily_logs_bp.route("/<uuid:log_id>", methods=["DELETE"])
@jwt_required()
def delete_daily_log(log_id):
    """Delete a daily log."""
    user_id = get_jwt_identity()

    log = DailyLog.query.get(log_id)
    if not log:
        return jsonify({"error": "Daily log not found"}), 404

    # Only owner can delete
    if str(log.user_id) != user_id:
        return jsonify({"error": "Forbidden"}), 403

    db.session.delete(log)
    db.session.commit()

    return jsonify({"message": "Daily log deleted"})


@daily_logs_bp.route("/suggestions", methods=["GET"])
@jwt_required()
def get_suggestions():
    """Get task suggestions for today's log."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    suggestions = get_task_suggestions(user_id, project_id)
    return jsonify({"suggestions": suggestions})


def get_task_suggestions(user_id, project_id):
    """Get suggested tasks based on user's assignments and recent work."""
    from ..models import CardAssignee, Column, Board

    suggestions = []

    # Get cards assigned to user in this project
    assigned_cards = (
        Card.query
        .join(CardAssignee)
        .join(Column)
        .join(Board)
        .join(Project)
        .filter(
            CardAssignee.user_id == user_id,
            Project.id == project_id
        )
        .limit(10)
        .all()
    )

    for card in assigned_cards:
        suggestions.append({
            "card_id": str(card.id),
            "title": card.title,
            "column": card.column.name if card.column else None,
            "priority": card.priority.value if card.priority else None,
            "story_points": card.story_points,
            "reason": "assigned",
        })

    # Get cards from yesterday's remaining work
    yesterday = date.today() - timedelta(days=1)
    yesterday_log = DailyLog.query.filter_by(
        user_id=user_id,
        project_id=project_id,
        log_date=yesterday
    ).first()

    if yesterday_log and yesterday_log.remaining_work:
        suggestions.append({
            "card_id": None,
            "title": "Remaining work from yesterday",
            "description": yesterday_log.remaining_work,
            "reason": "yesterday_remaining",
        })

    return suggestions


@daily_logs_bp.route("/summary", methods=["GET"])
@jwt_required()
def get_time_summary():
    """Get time tracking summary for a date range."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")
    days = int(request.args.get("days", 7))

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    start_date = date.today() - timedelta(days=days)

    logs = DailyLog.query.filter(
        DailyLog.user_id == user_id,
        DailyLog.project_id == project_id,
        DailyLog.log_date >= start_date
    ).all()

    total_time = sum(log.total_time_spent or 0 for log in logs)
    days_logged = len(logs)

    # Calculate time per card
    card_times = {}
    for log in logs:
        for task in (log.tasks_worked or []):
            card_id = task.get("card_id")
            time_spent = task.get("time_spent", 0)
            if card_id:
                card_times[card_id] = card_times.get(card_id, 0) + time_spent

    return jsonify({
        "summary": {
            "total_time_minutes": total_time,
            "total_time_hours": round(total_time / 60, 1),
            "days_logged": days_logged,
            "average_per_day": round(total_time / days_logged, 1) if days_logged > 0 else 0,
            "card_breakdown": card_times,
        }
    })
