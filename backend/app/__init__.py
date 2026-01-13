"""Flask application factory."""

import os
import logging
from flask import Flask, jsonify
from .config import config
from .extensions import db, migrate, jwt, cors, socketio


def create_app(config_name=None):
    """Create and configure the Flask application."""

    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    register_extensions(app)

    # Register blueprints
    register_blueprints(app)

    # Register error handlers
    register_error_handlers(app)

    # Register shell context
    register_shell_context(app)

    # Configure logging
    configure_logging(app)

    return app


def register_extensions(app):
    """Register Flask extensions."""
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True)
    socketio.init_app(
        app,
        cors_allowed_origins=app.config["CORS_ORIGINS"],
        async_mode="eventlet",
    )


def register_blueprints(app):
    """Register Flask blueprints."""
    from .api.health import health_bp
    from .api.auth import auth_bp
    from .api.organizations import organizations_bp
    from .api.workspaces import workspaces_bp
    from .api.projects import projects_bp
    from .api.boards import boards_bp
    from .api.columns import columns_bp
    from .api.cards import cards_bp
    from .api.labels import labels_bp
    from .api.sprints import sprints_bp
    from .api.daily_logs import daily_logs_bp
    from .api.ai import ai_bp
    from .api.analytics import analytics_bp
    from .api.imports import imports_bp

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(organizations_bp, url_prefix="/api/organizations")
    app.register_blueprint(workspaces_bp, url_prefix="/api/workspaces")
    app.register_blueprint(projects_bp, url_prefix="/api/projects")
    app.register_blueprint(boards_bp, url_prefix="/api/boards")
    app.register_blueprint(columns_bp, url_prefix="/api/columns")
    app.register_blueprint(cards_bp, url_prefix="/api/cards")
    app.register_blueprint(labels_bp)
    app.register_blueprint(sprints_bp, url_prefix="/api/sprints")
    app.register_blueprint(daily_logs_bp, url_prefix="/api/daily-logs")
    app.register_blueprint(ai_bp, url_prefix="/api/ai")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
    app.register_blueprint(imports_bp, url_prefix="/api/import")


def register_error_handlers(app):
    """Register error handlers."""

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"error": "Bad request", "message": str(error)}), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({"error": "Unauthorized", "message": str(error)}), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({"error": "Forbidden", "message": str(error)}), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Not found", "message": str(error)}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({"error": "Internal server error", "message": str(error)}), 500


def register_shell_context(app):
    """Register shell context objects."""

    @app.shell_context_processor
    def make_shell_context():
        from .models import User, Organization, Workspace, Project, Board, Column, Card

        return {
            "db": db,
            "User": User,
            "Organization": Organization,
            "Workspace": Workspace,
            "Project": Project,
            "Board": Board,
            "Column": Column,
            "Card": Card,
        }


def configure_logging(app):
    """Configure logging."""
    if not app.debug:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter(
                "[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
            )
        )
        app.logger.addHandler(handler)
        app.logger.setLevel(logging.INFO)
