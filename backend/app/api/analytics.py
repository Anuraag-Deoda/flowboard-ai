"""Analytics and reporting endpoints."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from sqlalchemy import func, and_

from ..extensions import db
from ..models import (
    Sprint, SprintStatus, CardSprint, Card, Column, Project, Workspace,
    OrganizationMember, DailyLog, User
)

analytics_bp = Blueprint("analytics", __name__)


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


@analytics_bp.route("/velocity", methods=["GET"])
@jwt_required()
def get_velocity():
    """Get velocity data for completed sprints."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")
    limit = request.args.get("limit", 10, type=int)

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Get completed sprints ordered by end date
    sprints = Sprint.query.filter_by(
        project_id=project_id,
        status=SprintStatus.COMPLETED
    ).order_by(Sprint.end_date.desc()).limit(limit).all()

    velocity_data = []
    for sprint in reversed(sprints):  # oldest to newest
        cards = [assoc.card for assoc in sprint.card_associations]
        completed_cards = [c for c in cards if c.column and c.column.name.lower() == "done"]

        total_points = sum(c.story_points or 0 for c in cards)
        completed_points = sum(c.story_points or 0 for c in completed_cards)

        velocity_data.append({
            "sprint_id": str(sprint.id),
            "sprint_name": sprint.name,
            "start_date": sprint.start_date.isoformat(),
            "end_date": sprint.end_date.isoformat(),
            "planned_points": total_points,
            "completed_points": completed_points,
            "total_cards": len(cards),
            "completed_cards": len(completed_cards),
        })

    # Calculate average velocity
    avg_velocity = 0
    if velocity_data:
        avg_velocity = sum(v["completed_points"] for v in velocity_data) / len(velocity_data)

    return jsonify({
        "velocity": velocity_data,
        "average_velocity": round(avg_velocity, 1),
        "total_sprints": len(velocity_data),
    })


@analytics_bp.route("/sprint/<uuid:sprint_id>/burndown", methods=["GET"])
@jwt_required()
def get_burndown(sprint_id):
    """Get burndown chart data for a sprint."""
    user_id = get_jwt_identity()

    sprint = Sprint.query.get(sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    project, membership = check_project_access(sprint.project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    cards = [assoc.card for assoc in sprint.card_associations]
    total_points = sum(c.story_points or 0 for c in cards)
    total_cards = len(cards)

    # Generate daily data points from start to end (or today if active)
    start_date = sprint.start_date
    end_date = sprint.end_date if sprint.status == SprintStatus.COMPLETED else min(sprint.end_date, datetime.now().date())

    # Calculate ideal burndown (linear)
    total_days = (sprint.end_date - start_date).days + 1
    daily_ideal_burn = total_points / total_days if total_days > 0 else 0

    burndown_data = []
    current_date = start_date
    day_index = 0

    while current_date <= end_date:
        # For now, we'll use a simplified approach
        # A more accurate version would use activity logs to track daily completion
        ideal_remaining = max(0, total_points - (daily_ideal_burn * day_index))

        # Actual remaining - simplified calculation
        # In production, this would query activity logs for actual completion per day
        if sprint.status == SprintStatus.COMPLETED and current_date == end_date:
            completed_cards = [c for c in cards if c.column and c.column.name.lower() == "done"]
            actual_remaining = total_points - sum(c.story_points or 0 for c in completed_cards)
        else:
            # Linear interpolation for demo (would use activity logs in production)
            progress_ratio = day_index / total_days if total_days > 0 else 0
            completed_cards = [c for c in cards if c.column and c.column.name.lower() == "done"]
            actual_completed = sum(c.story_points or 0 for c in completed_cards)

            if sprint.status == SprintStatus.COMPLETED:
                # Completed sprint - estimate daily progress
                actual_remaining = max(0, total_points - (actual_completed * (day_index / total_days)))
            elif current_date == datetime.now().date():
                # Today - use actual completion
                actual_remaining = total_points - actual_completed
            else:
                # Past days - interpolate
                actual_remaining = max(0, total_points - (actual_completed * progress_ratio))

        burndown_data.append({
            "date": current_date.isoformat(),
            "day": day_index + 1,
            "ideal_remaining": round(ideal_remaining, 1),
            "actual_remaining": round(actual_remaining, 1),
            "ideal_completed": round(daily_ideal_burn * day_index, 1),
        })

        current_date += timedelta(days=1)
        day_index += 1

    return jsonify({
        "burndown": burndown_data,
        "sprint_name": sprint.name,
        "total_points": total_points,
        "total_cards": total_cards,
        "start_date": start_date.isoformat(),
        "end_date": sprint.end_date.isoformat(),
        "status": sprint.status.value,
    })


@analytics_bp.route("/workload", methods=["GET"])
@jwt_required()
def get_team_workload():
    """Get team workload distribution."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")
    sprint_id = request.args.get("sprint_id")

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Get workspace for org members
    workspace = Workspace.query.get(project.workspace_id)
    members = OrganizationMember.query.filter_by(
        organization_id=workspace.organization_id
    ).all()

    workload_data = []

    for member in members:
        user = User.query.get(member.user_id)
        if not user:
            continue

        # Get cards assigned to this user
        if sprint_id:
            # Filter by sprint
            sprint = Sprint.query.get(sprint_id)
            if not sprint:
                continue
            sprint_card_ids = [assoc.card_id for assoc in sprint.card_associations]
            assigned_cards = Card.query.join(Card.assignees).filter(
                and_(
                    Card.id.in_(sprint_card_ids),
                    Card.assignees.any(user_id=user.id)
                )
            ).all()
        else:
            # All cards in project (across all boards)
            from ..models import Board
            project_boards = Board.query.filter_by(project_id=project_id).all()
            board_ids = [b.id for b in project_boards]
            columns = Column.query.filter(Column.board_id.in_(board_ids)).all()
            column_ids = [c.id for c in columns]
            assigned_cards = Card.query.join(Card.assignees).filter(
                and_(
                    Card.column_id.in_(column_ids),
                    Card.assignees.any(user_id=user.id)
                )
            ).all()

        # Calculate metrics
        total_cards = len(assigned_cards)
        total_points = sum(c.story_points or 0 for c in assigned_cards)
        completed_cards = [c for c in assigned_cards if c.column and c.column.name.lower() == "done"]
        completed_points = sum(c.story_points or 0 for c in completed_cards)
        in_progress_cards = [c for c in assigned_cards if c.column and c.column.name.lower() in ["in progress", "in review", "review"]]

        # Get time spent from daily logs
        time_query = db.session.query(func.sum(DailyLog.total_time_spent)).filter(
            DailyLog.user_id == user.id,
            DailyLog.project_id == project_id
        )
        total_time_spent = time_query.scalar() or 0

        workload_data.append({
            "user_id": str(user.id),
            "user_name": user.full_name or user.email,
            "avatar_url": user.avatar_url,
            "total_cards": total_cards,
            "completed_cards": len(completed_cards),
            "in_progress_cards": len(in_progress_cards),
            "total_points": total_points,
            "completed_points": completed_points,
            "total_time_spent": total_time_spent,  # in minutes
            "completion_rate": round((len(completed_cards) / total_cards * 100) if total_cards > 0 else 0, 1),
        })

    # Sort by total cards (descending)
    workload_data.sort(key=lambda x: x["total_cards"], reverse=True)

    return jsonify({
        "workload": workload_data,
        "total_members": len(workload_data),
    })


@analytics_bp.route("/personal", methods=["GET"])
@jwt_required()
def get_personal_productivity():
    """Get personal productivity metrics."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")
    days = request.args.get("days", 30, type=int)

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    start_date = datetime.now().date() - timedelta(days=days)

    # Get daily logs for this user
    daily_logs = DailyLog.query.filter(
        DailyLog.user_id == user_id,
        DailyLog.project_id == project_id,
        DailyLog.log_date >= start_date
    ).order_by(DailyLog.log_date).all()

    # Get assigned cards
    from ..models import Board
    project_boards = Board.query.filter_by(project_id=project_id).all()
    board_ids = [b.id for b in project_boards]
    columns = Column.query.filter(Column.board_id.in_(board_ids)).all()
    column_ids = [c.id for c in columns]
    assigned_cards = Card.query.join(Card.assignees).filter(
        and_(
            Card.column_id.in_(column_ids),
            Card.assignees.any(user_id=user_id)
        )
    ).all()

    # Calculate metrics
    total_time_spent = sum(log.total_time_spent or 0 for log in daily_logs)
    total_cards = len(assigned_cards)
    completed_cards = [c for c in assigned_cards if c.column and c.column.name.lower() == "done"]
    total_points = sum(c.story_points or 0 for c in assigned_cards)
    completed_points = sum(c.story_points or 0 for c in completed_cards)

    # Daily breakdown
    daily_data = []
    for log in daily_logs:
        daily_data.append({
            "date": log.log_date.isoformat(),
            "time_spent": log.total_time_spent or 0,
            "tasks_count": len(log.tasks_worked) if log.tasks_worked else 0,
            "has_blockers": bool(log.blockers),
        })

    # Calculate averages
    avg_daily_time = total_time_spent / len(daily_logs) if daily_logs else 0
    blocker_days = sum(1 for log in daily_logs if log.blockers)

    return jsonify({
        "summary": {
            "total_time_spent": total_time_spent,
            "avg_daily_time": round(avg_daily_time, 1),
            "total_cards": total_cards,
            "completed_cards": len(completed_cards),
            "total_points": total_points,
            "completed_points": completed_points,
            "completion_rate": round((len(completed_cards) / total_cards * 100) if total_cards > 0 else 0, 1),
            "days_with_blockers": blocker_days,
            "days_tracked": len(daily_logs),
        },
        "daily_data": daily_data,
        "date_range": {
            "start": start_date.isoformat(),
            "end": datetime.now().date().isoformat(),
            "days": days,
        },
    })


@analytics_bp.route("/time-vs-estimate", methods=["GET"])
@jwt_required()
def get_time_vs_estimate():
    """Compare actual time spent vs estimated time for cards."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")
    sprint_id = request.args.get("sprint_id")

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Get time from daily logs
    logs = DailyLog.query.filter(
        DailyLog.project_id == project_id
    ).all()

    # Calculate time spent per card
    card_times = {}
    for log in logs:
        for task in (log.tasks_worked or []):
            card_id = task.get("card_id")
            time_spent = task.get("time_spent", 0)
            if card_id:
                if card_id not in card_times:
                    card_times[card_id] = 0
                card_times[card_id] += time_spent

    # Get cards with estimates
    from ..models import Board
    project_boards = Board.query.filter_by(project_id=project_id).all()
    board_ids = [b.id for b in project_boards]
    columns = Column.query.filter(Column.board_id.in_(board_ids)).all()
    column_ids = [c.id for c in columns]

    # If sprint_id provided, filter by sprint
    if sprint_id:
        sprint = Sprint.query.get(sprint_id)
        if sprint:
            sprint_card_ids = [str(assoc.card_id) for assoc in sprint.card_associations]
            cards = Card.query.filter(Card.id.in_(sprint_card_ids)).all()
        else:
            cards = []
    else:
        cards = Card.query.filter(Card.column_id.in_(column_ids)).all()

    # Build comparison data
    comparison_data = []
    total_estimated = 0
    total_actual = 0
    over_estimate_count = 0
    under_estimate_count = 0

    for card in cards:
        card_id_str = str(card.id)
        actual_time = card_times.get(card_id_str, 0)

        # time_estimate is in minutes
        estimated_time = card.time_estimate or 0

        if estimated_time > 0 or actual_time > 0:
            variance = actual_time - estimated_time if estimated_time > 0 else None
            variance_pct = ((actual_time - estimated_time) / estimated_time * 100) if estimated_time > 0 else None

            if variance is not None:
                if variance > 0:
                    over_estimate_count += 1
                else:
                    under_estimate_count += 1

            comparison_data.append({
                "card_id": card_id_str,
                "card_title": card.title,
                "priority": card.priority.value if card.priority else None,
                "column_name": card.column.name if card.column else None,
                "estimated_minutes": estimated_time,
                "actual_minutes": actual_time,
                "variance_minutes": variance,
                "variance_percent": round(variance_pct, 1) if variance_pct is not None else None,
                "status": "over" if variance and variance > 0 else "under" if variance and variance < 0 else "on_track" if variance == 0 else "no_estimate",
            })

            total_estimated += estimated_time
            total_actual += actual_time

    # Sort by variance (biggest overruns first)
    comparison_data.sort(key=lambda x: x["variance_minutes"] if x["variance_minutes"] else 0, reverse=True)

    return jsonify({
        "comparison": comparison_data[:50],  # Limit results
        "summary": {
            "total_estimated_minutes": total_estimated,
            "total_actual_minutes": total_actual,
            "total_variance_minutes": total_actual - total_estimated,
            "total_variance_percent": round((total_actual - total_estimated) / total_estimated * 100, 1) if total_estimated > 0 else None,
            "over_estimate_count": over_estimate_count,
            "under_estimate_count": under_estimate_count,
            "cards_tracked": len([c for c in comparison_data if c["actual_minutes"] > 0]),
            "cards_with_estimates": len([c for c in comparison_data if c["estimated_minutes"] > 0]),
        },
    })


@analytics_bp.route("/individual-velocity", methods=["GET"])
@jwt_required()
def get_individual_velocity():
    """Get velocity metrics for individual team members."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")
    sprints_count = request.args.get("sprints", 5, type=int)

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Get completed sprints
    sprints = Sprint.query.filter_by(
        project_id=project_id,
        status=SprintStatus.COMPLETED
    ).order_by(Sprint.end_date.desc()).limit(sprints_count).all()

    # Get workspace for org members
    workspace = Workspace.query.get(project.workspace_id)
    members = OrganizationMember.query.filter_by(
        organization_id=workspace.organization_id
    ).all()

    member_velocities = {}

    for member in members:
        user = User.query.get(member.user_id)
        if not user:
            continue

        member_velocities[str(user.id)] = {
            "user_id": str(user.id),
            "user_name": user.full_name or user.email,
            "avatar_url": user.avatar_url,
            "sprints": [],
            "average_velocity": 0,
            "total_points": 0,
            "total_cards": 0,
        }

    for sprint in reversed(sprints):  # Oldest to newest
        cards = [assoc.card for assoc in sprint.card_associations]
        completed_cards = [c for c in cards if c.column and c.column.name.lower() == "done"]

        # Group by assignee
        for card in completed_cards:
            for assignee in card.assignees:
                user_id_str = str(assignee.user_id)
                if user_id_str in member_velocities:
                    # Find or create sprint entry
                    sprint_entry = next(
                        (s for s in member_velocities[user_id_str]["sprints"] if s["sprint_id"] == str(sprint.id)),
                        None
                    )
                    if not sprint_entry:
                        sprint_entry = {
                            "sprint_id": str(sprint.id),
                            "sprint_name": sprint.name,
                            "points": 0,
                            "cards": 0,
                        }
                        member_velocities[user_id_str]["sprints"].append(sprint_entry)

                    sprint_entry["points"] += card.story_points or 0
                    sprint_entry["cards"] += 1

    # Calculate averages
    for member_id, data in member_velocities.items():
        if data["sprints"]:
            data["total_points"] = sum(s["points"] for s in data["sprints"])
            data["total_cards"] = sum(s["cards"] for s in data["sprints"])
            data["average_velocity"] = round(data["total_points"] / len(data["sprints"]), 1)

    # Filter out members with no data and sort by velocity
    active_members = [v for v in member_velocities.values() if v["total_points"] > 0]
    active_members.sort(key=lambda x: x["average_velocity"], reverse=True)

    return jsonify({
        "members": active_members,
        "sprints_analyzed": len(sprints),
    })


@analytics_bp.route("/invisible-work", methods=["GET"])
@jwt_required()
def get_invisible_work():
    """Detect 'invisible work' - time logged but not attributed to cards."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")
    days = request.args.get("days", 30, type=int)

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    start_date = datetime.now().date() - timedelta(days=days)

    # Get daily logs
    logs = DailyLog.query.filter(
        DailyLog.project_id == project_id,
        DailyLog.log_date >= start_date
    ).all()

    # Analyze patterns
    total_time_tracked = 0
    time_per_user = {}
    time_on_cards = 0
    orphan_time = 0
    logs_with_blockers = 0
    blocker_time = 0

    for log in logs:
        user_id_str = str(log.user_id)
        if user_id_str not in time_per_user:
            time_per_user[user_id_str] = {
                "user_id": user_id_str,
                "total_time": 0,
                "card_time": 0,
                "orphan_time": 0,
                "blocker_days": 0,
            }

        log_total = log.total_time_spent or 0
        total_time_tracked += log_total
        time_per_user[user_id_str]["total_time"] += log_total

        # Count time on cards vs orphan time
        card_time_in_log = 0
        for task in (log.tasks_worked or []):
            if task.get("card_id"):
                card_time_in_log += task.get("time_spent", 0)

        time_on_cards += card_time_in_log
        time_per_user[user_id_str]["card_time"] += card_time_in_log

        orphan_in_log = log_total - card_time_in_log
        orphan_time += orphan_in_log
        time_per_user[user_id_str]["orphan_time"] += orphan_in_log

        if log.blockers:
            logs_with_blockers += 1
            blocker_time += log_total
            time_per_user[user_id_str]["blocker_days"] += 1

    # Get user names
    user_data = []
    for user_id_str, data in time_per_user.items():
        user = User.query.get(user_id_str)
        if user:
            data["user_name"] = user.full_name or user.email
            data["orphan_percent"] = round(data["orphan_time"] / data["total_time"] * 100, 1) if data["total_time"] > 0 else 0
            user_data.append(data)

    user_data.sort(key=lambda x: x["orphan_time"], reverse=True)

    return jsonify({
        "summary": {
            "total_time_tracked": total_time_tracked,
            "time_on_cards": time_on_cards,
            "orphan_time": orphan_time,
            "orphan_percent": round(orphan_time / total_time_tracked * 100, 1) if total_time_tracked > 0 else 0,
            "logs_with_blockers": logs_with_blockers,
            "blocker_time": blocker_time,
            "total_logs": len(logs),
        },
        "by_user": user_data,
        "insights": generate_invisible_work_insights(total_time_tracked, orphan_time, logs_with_blockers, len(logs)),
    })


def generate_invisible_work_insights(total_time, orphan_time, blocker_logs, total_logs):
    """Generate insights about invisible work patterns."""
    insights = []

    orphan_pct = (orphan_time / total_time * 100) if total_time > 0 else 0
    blocker_pct = (blocker_logs / total_logs * 100) if total_logs > 0 else 0

    if orphan_pct > 30:
        insights.append({
            "type": "warning",
            "message": f"{round(orphan_pct)}% of time is not linked to specific cards. Consider improving task tracking.",
        })
    elif orphan_pct > 15:
        insights.append({
            "type": "info",
            "message": f"{round(orphan_pct)}% of time is unattributed. Some meeting/admin time is normal.",
        })

    if blocker_pct > 40:
        insights.append({
            "type": "critical",
            "message": f"{round(blocker_pct)}% of days have blockers reported. Review impediments regularly.",
        })
    elif blocker_pct > 20:
        insights.append({
            "type": "warning",
            "message": f"{round(blocker_pct)}% of days have blockers. Consider a blocker resolution process.",
        })

    if total_logs < 5:
        insights.append({
            "type": "info",
            "message": "Limited data available. Encourage more daily log entries for better insights.",
        })

    return insights


@analytics_bp.route("/summary", methods=["GET"])
@jwt_required()
def get_project_summary():
    """Get overall project analytics summary."""
    user_id = get_jwt_identity()
    project_id = request.args.get("project_id")

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    # Get all sprints
    all_sprints = Sprint.query.filter_by(project_id=project_id).all()
    completed_sprints = [s for s in all_sprints if s.status == SprintStatus.COMPLETED]
    active_sprint = next((s for s in all_sprints if s.status == SprintStatus.ACTIVE), None)

    # Calculate velocity
    velocity_values = []
    for sprint in completed_sprints:
        cards = [assoc.card for assoc in sprint.card_associations]
        completed_cards = [c for c in cards if c.column and c.column.name.lower() == "done"]
        velocity_values.append(sum(c.story_points or 0 for c in completed_cards))

    avg_velocity = sum(velocity_values) / len(velocity_values) if velocity_values else 0

    # Get total cards across project
    from ..models import Board
    project_boards = Board.query.filter_by(project_id=project_id).all()
    total_cards = 0
    completed_cards = 0
    for board in project_boards:
        for column in board.columns:
            total_cards += len(column.cards) if column.cards else 0
            if column.name.lower() == "done":
                completed_cards += len(column.cards) if column.cards else 0

    # Get recent activity (last 7 days of logs)
    recent_start = datetime.now().date() - timedelta(days=7)
    recent_logs = DailyLog.query.filter(
        DailyLog.project_id == project_id,
        DailyLog.log_date >= recent_start
    ).all()
    recent_time_spent = sum(log.total_time_spent or 0 for log in recent_logs)

    return jsonify({
        "project_id": str(project_id),
        "project_name": project.name,
        "total_sprints": len(all_sprints),
        "completed_sprints": len(completed_sprints),
        "active_sprint": {
            "id": str(active_sprint.id),
            "name": active_sprint.name,
            "days_remaining": (active_sprint.end_date - datetime.now().date()).days,
        } if active_sprint else None,
        "average_velocity": round(avg_velocity, 1),
        "total_cards": total_cards,
        "completed_cards": completed_cards,
        "completion_rate": round((completed_cards / total_cards * 100) if total_cards > 0 else 0, 1),
        "recent_time_spent": recent_time_spent,  # last 7 days
    })
