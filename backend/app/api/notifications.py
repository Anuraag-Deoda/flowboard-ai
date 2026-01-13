"""Notifications API endpoints."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import desc

from ..extensions import db
from ..models import Notification, NotificationType, User, Card, Project, Sprint

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("", methods=["GET"])
@jwt_required()
def list_notifications():
    """List notifications for the current user."""
    user_id = get_jwt_identity()

    # Query parameters
    unread_only = request.args.get("unread_only", "false").lower() == "true"
    limit = min(int(request.args.get("limit", 50)), 100)
    offset = int(request.args.get("offset", 0))

    query = Notification.query.filter_by(user_id=user_id)

    if unread_only:
        query = query.filter_by(is_read=False)

    total = query.count()
    notifications = (
        query
        .order_by(desc(Notification.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Count unread
    unread_count = Notification.query.filter_by(user_id=user_id, is_read=False).count()

    return jsonify({
        "notifications": [n.to_dict() for n in notifications],
        "total": total,
        "unread_count": unread_count,
    })


@notifications_bp.route("/unread-count", methods=["GET"])
@jwt_required()
def get_unread_count():
    """Get count of unread notifications."""
    user_id = get_jwt_identity()
    count = Notification.query.filter_by(user_id=user_id, is_read=False).count()
    return jsonify({"unread_count": count})


@notifications_bp.route("/<notification_id>/read", methods=["POST"])
@jwt_required()
def mark_as_read(notification_id):
    """Mark a notification as read."""
    user_id = get_jwt_identity()

    notification = Notification.query.filter_by(
        id=notification_id,
        user_id=user_id
    ).first()

    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    notification.is_read = True
    db.session.commit()

    return jsonify({"notification": notification.to_dict()})


@notifications_bp.route("/read-all", methods=["POST"])
@jwt_required()
def mark_all_as_read():
    """Mark all notifications as read for the current user."""
    user_id = get_jwt_identity()

    Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).update({"is_read": True})

    db.session.commit()

    return jsonify({"message": "All notifications marked as read"})


@notifications_bp.route("/<notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id):
    """Delete a notification."""
    user_id = get_jwt_identity()

    notification = Notification.query.filter_by(
        id=notification_id,
        user_id=user_id
    ).first()

    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    db.session.delete(notification)
    db.session.commit()

    return jsonify({"message": "Notification deleted"})


@notifications_bp.route("/clear-all", methods=["DELETE"])
@jwt_required()
def clear_all_notifications():
    """Delete all notifications for the current user."""
    user_id = get_jwt_identity()

    Notification.query.filter_by(user_id=user_id).delete()
    db.session.commit()

    return jsonify({"message": "All notifications cleared"})


# Helper functions to create notifications

def create_notification(
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str = None,
    card_id: str = None,
    project_id: str = None,
    sprint_id: str = None,
    organization_id: str = None,
    actor_id: str = None,
    action_url: str = None
):
    """Create a new notification."""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        card_id=card_id,
        project_id=project_id,
        sprint_id=sprint_id,
        organization_id=organization_id,
        actor_id=actor_id,
        action_url=action_url
    )
    db.session.add(notification)
    db.session.commit()
    return notification


def notify_card_assigned(card, assignee_id: str, actor_id: str):
    """Notify user when assigned to a card."""
    if assignee_id == actor_id:
        return  # Don't notify if self-assigning

    actor = User.query.get(actor_id)
    actor_name = actor.full_name or actor.email if actor else "Someone"

    # Get project_id through card -> column -> board -> project
    project_id = None
    action_url = None
    if card.column and card.column.board:
        project_id = card.column.board.project_id
        action_url = f"/board/{card.column.board_id}"

    create_notification(
        user_id=assignee_id,
        notification_type=NotificationType.CARD_ASSIGNED,
        title=f"You've been assigned to \"{card.title}\"",
        message=f"{actor_name} assigned you to this card.",
        card_id=str(card.id),
        project_id=str(project_id) if project_id else None,
        actor_id=actor_id,
        action_url=action_url
    )


def notify_card_commented(card, commenter_id: str, comment_text: str):
    """Notify card assignees and creator when a comment is added."""
    notified_users = set()

    commenter = User.query.get(commenter_id)
    commenter_name = commenter.full_name or commenter.email if commenter else "Someone"

    # Get action URL
    action_url = None
    project_id = None
    if card.column and card.column.board:
        project_id = card.column.board.project_id
        action_url = f"/board/{card.column.board_id}"

    # Truncate comment for preview
    preview = comment_text[:100] + "..." if len(comment_text) > 100 else comment_text

    # Notify card creator
    if card.created_by and card.created_by != commenter_id:
        create_notification(
            user_id=str(card.created_by),
            notification_type=NotificationType.CARD_COMMENTED,
            title=f"New comment on \"{card.title}\"",
            message=f"{commenter_name}: {preview}",
            card_id=str(card.id),
            project_id=str(project_id) if project_id else None,
            actor_id=commenter_id,
            action_url=action_url
        )
        notified_users.add(str(card.created_by))

    # Notify assignees
    for assignee in card.assignees:
        assignee_id = str(assignee.user_id)
        if assignee_id != commenter_id and assignee_id not in notified_users:
            create_notification(
                user_id=assignee_id,
                notification_type=NotificationType.CARD_COMMENTED,
                title=f"New comment on \"{card.title}\"",
                message=f"{commenter_name}: {preview}",
                card_id=str(card.id),
                project_id=str(project_id) if project_id else None,
                actor_id=commenter_id,
                action_url=action_url
            )
            notified_users.add(assignee_id)


def notify_card_moved(card, from_column_name: str, to_column_name: str, actor_id: str):
    """Notify card assignees when card is moved."""
    actor = User.query.get(actor_id)
    actor_name = actor.full_name or actor.email if actor else "Someone"

    action_url = None
    project_id = None
    if card.column and card.column.board:
        project_id = card.column.board.project_id
        action_url = f"/board/{card.column.board_id}"

    for assignee in card.assignees:
        assignee_id = str(assignee.user_id)
        if assignee_id != actor_id:
            create_notification(
                user_id=assignee_id,
                notification_type=NotificationType.CARD_MOVED,
                title=f"\"{card.title}\" moved to {to_column_name}",
                message=f"{actor_name} moved this card from {from_column_name}.",
                card_id=str(card.id),
                project_id=str(project_id) if project_id else None,
                actor_id=actor_id,
                action_url=action_url
            )


def notify_sprint_started(sprint, actor_id: str):
    """Notify project members when sprint starts."""
    actor = User.query.get(actor_id)
    actor_name = actor.full_name or actor.email if actor else "Someone"

    # Get all project members through cards in the sprint
    notified_users = set()

    for card_sprint in sprint.cards:
        card = card_sprint.card
        if card:
            for assignee in card.assignees:
                assignee_id = str(assignee.user_id)
                if assignee_id not in notified_users and assignee_id != actor_id:
                    create_notification(
                        user_id=assignee_id,
                        notification_type=NotificationType.SPRINT_STARTED,
                        title=f"Sprint \"{sprint.name}\" has started!",
                        message=f"{actor_name} started the sprint. You have cards assigned in this sprint.",
                        sprint_id=str(sprint.id),
                        project_id=str(sprint.project_id),
                        actor_id=actor_id,
                        action_url=f"/project/{sprint.project_id}/sprints/{sprint.id}"
                    )
                    notified_users.add(assignee_id)


def notify_sprint_completed(sprint, actor_id: str):
    """Notify project members when sprint completes."""
    actor = User.query.get(actor_id)
    actor_name = actor.full_name or actor.email if actor else "Someone"

    notified_users = set()

    for card_sprint in sprint.cards:
        card = card_sprint.card
        if card:
            for assignee in card.assignees:
                assignee_id = str(assignee.user_id)
                if assignee_id not in notified_users and assignee_id != actor_id:
                    create_notification(
                        user_id=assignee_id,
                        notification_type=NotificationType.SPRINT_COMPLETED,
                        title=f"Sprint \"{sprint.name}\" completed!",
                        message=f"{actor_name} marked the sprint as completed.",
                        sprint_id=str(sprint.id),
                        project_id=str(sprint.project_id),
                        actor_id=actor_id,
                        action_url=f"/project/{sprint.project_id}/sprints/{sprint.id}"
                    )
                    notified_users.add(assignee_id)
