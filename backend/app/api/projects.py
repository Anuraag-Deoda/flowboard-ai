"""Project endpoints."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError

from ..extensions import db
from ..models import Project, Workspace, OrganizationMember

projects_bp = Blueprint("projects", __name__)


class ProjectSchema(Schema):
    workspace_id = fields.UUID(required=True)
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    description = fields.Str(required=False)


project_schema = ProjectSchema()


def check_workspace_access(workspace_id, user_id):
    """Check if user has access to workspace."""
    workspace = Workspace.query.get(workspace_id)
    if not workspace:
        return None, None

    membership = OrganizationMember.query.filter_by(
        organization_id=workspace.organization_id, user_id=user_id
    ).first()

    return workspace, membership


@projects_bp.route("/", methods=["GET"])
@jwt_required()
def list_projects():
    """List projects in a workspace."""
    user_id = get_jwt_identity()
    workspace_id = request.args.get("workspace_id")

    if not workspace_id:
        return jsonify({"error": "workspace_id required"}), 400

    workspace, membership = check_workspace_access(workspace_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    projects = Project.query.filter_by(workspace_id=workspace_id).all()
    return jsonify({"projects": [p.to_dict() for p in projects]})


@projects_bp.route("/", methods=["POST"])
@jwt_required()
def create_project():
    """Create a new project."""
    user_id = get_jwt_identity()

    try:
        data = project_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    workspace, membership = check_workspace_access(data["workspace_id"], user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    project = Project(
        workspace_id=data["workspace_id"],
        name=data["name"],
        description=data.get("description"),
    )
    db.session.add(project)
    db.session.commit()

    return jsonify({"project": project.to_dict()}), 201


@projects_bp.route("/<uuid:project_id>", methods=["GET"])
@jwt_required()
def get_project(project_id):
    """Get project by ID."""
    user_id = get_jwt_identity()

    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    workspace, membership = check_workspace_access(project.workspace_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"project": project.to_dict()})


@projects_bp.route("/<uuid:project_id>", methods=["PUT"])
@jwt_required()
def update_project(project_id):
    """Update project."""
    user_id = get_jwt_identity()

    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    workspace, membership = check_workspace_access(project.workspace_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    data = request.json
    if "name" in data:
        project.name = data["name"]
    if "description" in data:
        project.description = data["description"]

    db.session.commit()
    return jsonify({"project": project.to_dict()})


@projects_bp.route("/<uuid:project_id>", methods=["DELETE"])
@jwt_required()
def delete_project(project_id):
    """Delete project."""
    user_id = get_jwt_identity()

    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    workspace, membership = check_workspace_access(project.workspace_id, user_id)
    from ..models import MemberRole
    if not membership or membership.role != MemberRole.ADMIN:
        return jsonify({"error": "Forbidden"}), 403

    db.session.delete(project)
    db.session.commit()

    return jsonify({"message": "Project deleted"})
