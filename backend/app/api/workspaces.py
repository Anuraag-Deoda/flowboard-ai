"""Workspace endpoints."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError

from ..extensions import db
from ..models import Workspace, OrganizationMember

workspaces_bp = Blueprint("workspaces", __name__)


class WorkspaceSchema(Schema):
    organization_id = fields.UUID(required=True)
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))


workspace_schema = WorkspaceSchema()


@workspaces_bp.route("/", methods=["GET"])
@jwt_required()
def list_workspaces():
    """List workspaces user has access to."""
    user_id = get_jwt_identity()
    org_id = request.args.get("organization_id")

    if not org_id:
        return jsonify({"error": "organization_id required"}), 400

    # Check membership
    membership = OrganizationMember.query.filter_by(
        organization_id=org_id, user_id=user_id
    ).first()

    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    workspaces = Workspace.query.filter_by(organization_id=org_id).all()
    return jsonify({"workspaces": [w.to_dict() for w in workspaces]})


@workspaces_bp.route("/", methods=["POST"])
@jwt_required()
def create_workspace():
    """Create a new workspace."""
    user_id = get_jwt_identity()

    try:
        data = workspace_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    # Check membership
    membership = OrganizationMember.query.filter_by(
        organization_id=data["organization_id"], user_id=user_id
    ).first()

    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    workspace = Workspace(
        organization_id=data["organization_id"],
        name=data["name"],
    )
    db.session.add(workspace)
    db.session.commit()

    return jsonify({"workspace": workspace.to_dict()}), 201


@workspaces_bp.route("/<uuid:workspace_id>", methods=["GET"])
@jwt_required()
def get_workspace(workspace_id):
    """Get workspace by ID."""
    user_id = get_jwt_identity()

    workspace = Workspace.query.get(workspace_id)
    if not workspace:
        return jsonify({"error": "Workspace not found"}), 404

    # Check membership
    membership = OrganizationMember.query.filter_by(
        organization_id=workspace.organization_id, user_id=user_id
    ).first()

    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"workspace": workspace.to_dict()})


@workspaces_bp.route("/<uuid:workspace_id>", methods=["PUT"])
@jwt_required()
def update_workspace(workspace_id):
    """Update workspace."""
    user_id = get_jwt_identity()

    workspace = Workspace.query.get(workspace_id)
    if not workspace:
        return jsonify({"error": "Workspace not found"}), 404

    # Check membership
    membership = OrganizationMember.query.filter_by(
        organization_id=workspace.organization_id, user_id=user_id
    ).first()

    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    data = request.json
    if "name" in data:
        workspace.name = data["name"]

    db.session.commit()
    return jsonify({"workspace": workspace.to_dict()})


@workspaces_bp.route("/<uuid:workspace_id>", methods=["DELETE"])
@jwt_required()
def delete_workspace(workspace_id):
    """Delete workspace."""
    user_id = get_jwt_identity()

    workspace = Workspace.query.get(workspace_id)
    if not workspace:
        return jsonify({"error": "Workspace not found"}), 404

    # Check admin membership
    from ..models import MemberRole
    membership = OrganizationMember.query.filter_by(
        organization_id=workspace.organization_id, user_id=user_id
    ).first()

    if not membership or membership.role != MemberRole.ADMIN:
        return jsonify({"error": "Forbidden"}), 403

    db.session.delete(workspace)
    db.session.commit()

    return jsonify({"message": "Workspace deleted"})
