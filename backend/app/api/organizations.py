"""Organization endpoints."""

import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError

from ..extensions import db
from ..models import Organization, OrganizationMember, MemberRole

organizations_bp = Blueprint("organizations", __name__)


class OrganizationSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    slug = fields.Str(required=False, validate=validate.Length(min=1, max=255))


org_schema = OrganizationSchema()


def generate_slug(name: str) -> str:
    """Generate URL-friendly slug from name."""
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug


@organizations_bp.route("/", methods=["GET"])
@jwt_required()
def list_organizations():
    """List organizations the user belongs to."""
    user_id = get_jwt_identity()

    memberships = OrganizationMember.query.filter_by(user_id=user_id).all()
    orgs = [m.organization.to_dict() for m in memberships]

    return jsonify({"organizations": orgs})


@organizations_bp.route("/", methods=["POST"])
@jwt_required()
def create_organization():
    """Create a new organization."""
    user_id = get_jwt_identity()

    try:
        data = org_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    # Generate slug if not provided
    slug = data.get("slug") or generate_slug(data["name"])

    # Check if slug is unique
    if Organization.query.filter_by(slug=slug).first():
        return jsonify({"error": "Organization slug already exists"}), 409

    # Create organization
    org = Organization(name=data["name"], slug=slug)
    db.session.add(org)
    db.session.flush()

    # Add creator as admin
    membership = OrganizationMember(
        organization_id=org.id,
        user_id=user_id,
        role=MemberRole.ADMIN,
    )
    db.session.add(membership)
    db.session.commit()

    return jsonify({"organization": org.to_dict()}), 201


@organizations_bp.route("/<uuid:org_id>", methods=["GET"])
@jwt_required()
def get_organization(org_id):
    """Get organization by ID."""
    user_id = get_jwt_identity()

    # Check membership
    membership = OrganizationMember.query.filter_by(
        organization_id=org_id, user_id=user_id
    ).first()

    if not membership:
        return jsonify({"error": "Organization not found"}), 404

    org = Organization.query.get(org_id)
    return jsonify({"organization": org.to_dict()})


@organizations_bp.route("/<uuid:org_id>", methods=["PUT"])
@jwt_required()
def update_organization(org_id):
    """Update organization."""
    user_id = get_jwt_identity()

    # Check admin membership
    membership = OrganizationMember.query.filter_by(
        organization_id=org_id, user_id=user_id
    ).first()

    if not membership or membership.role != MemberRole.ADMIN:
        return jsonify({"error": "Forbidden"}), 403

    try:
        data = org_schema.load(request.json, partial=True)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": err.messages}), 400

    org = Organization.query.get(org_id)
    if not org:
        return jsonify({"error": "Organization not found"}), 404

    if "name" in data:
        org.name = data["name"]
    if "slug" in data:
        org.slug = data["slug"]

    db.session.commit()
    return jsonify({"organization": org.to_dict()})


@organizations_bp.route("/<uuid:org_id>", methods=["DELETE"])
@jwt_required()
def delete_organization(org_id):
    """Delete organization."""
    user_id = get_jwt_identity()

    # Check admin membership
    membership = OrganizationMember.query.filter_by(
        organization_id=org_id, user_id=user_id
    ).first()

    if not membership or membership.role != MemberRole.ADMIN:
        return jsonify({"error": "Forbidden"}), 403

    org = Organization.query.get(org_id)
    if not org:
        return jsonify({"error": "Organization not found"}), 404

    db.session.delete(org)
    db.session.commit()

    return jsonify({"message": "Organization deleted"})


@organizations_bp.route("/<uuid:org_id>/members", methods=["GET"])
@jwt_required()
def list_members(org_id):
    """List organization members."""
    user_id = get_jwt_identity()

    # Check membership
    membership = OrganizationMember.query.filter_by(
        organization_id=org_id, user_id=user_id
    ).first()

    if not membership:
        return jsonify({"error": "Organization not found"}), 404

    members = OrganizationMember.query.filter_by(organization_id=org_id).all()
    return jsonify({"members": [m.to_dict() for m in members]})
