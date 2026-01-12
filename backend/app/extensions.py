"""Flask extensions instantiation."""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_socketio import SocketIO

# Database
db = SQLAlchemy()
migrate = Migrate()

# Auth
jwt = JWTManager()

# CORS
cors = CORS()

# WebSocket
socketio = SocketIO()
