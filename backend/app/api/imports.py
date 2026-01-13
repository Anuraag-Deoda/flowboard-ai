"""Document import endpoints for Excel/CSV file processing."""

import os
import csv
import json
import uuid as uuid_lib
from io import StringIO
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from datetime import datetime
from openpyxl import load_workbook

from ..extensions import db
from ..models import Project, Workspace, OrganizationMember, Card, Column, Board
from ..services.ai_service import get_ai_service

imports_bp = Blueprint("imports", __name__)

UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "uploads")
ALLOWED_EXTENSIONS = {"xlsx", "xls", "csv"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# In-memory storage for import sessions (in production, use Redis or database)
import_sessions = {}


def allowed_file(filename):
    """Check if file extension is allowed."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


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


def detect_data_type(value):
    """Detect the data type of a cell value."""
    if value is None or value == "":
        return "empty"

    value_str = str(value).strip()

    # Check for priority patterns
    if value_str.upper() in ["P0", "P1", "P2", "P3", "P4", "HIGH", "MEDIUM", "LOW", "CRITICAL"]:
        return "priority"

    # Check for number
    try:
        float(value_str.replace(",", ""))
        return "number"
    except ValueError:
        pass

    # Check for date
    date_patterns = ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"]
    for pattern in date_patterns:
        try:
            datetime.strptime(value_str, pattern)
            return "date"
        except ValueError:
            continue

    # Check for email
    if "@" in value_str and "." in value_str.split("@")[-1]:
        return "email"

    # Default to text
    return "text"


def parse_excel(file_path):
    """Parse Excel file and return structured data."""
    wb = load_workbook(file_path, read_only=True)
    sheet = wb.active

    rows = []
    headers = None

    for row_num, row in enumerate(sheet.iter_rows(values_only=True), 1):
        # Skip completely empty rows
        if all(cell is None for cell in row):
            continue

        if headers is None:
            # First non-empty row is headers
            headers = [str(cell) if cell else f"Column {i+1}" for i, cell in enumerate(row)]
            continue

        row_dict = {}
        for i, cell in enumerate(row):
            if i < len(headers):
                row_dict[headers[i]] = cell

        rows.append(row_dict)

    wb.close()
    return headers, rows


def parse_csv(file_path):
    """Parse CSV file and return structured data."""
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        # Try to detect dialect
        sample = f.read(4096)
        f.seek(0)

        try:
            dialect = csv.Sniffer().sniff(sample)
        except csv.Error:
            dialect = csv.excel  # Default to excel dialect

        reader = csv.DictReader(f, dialect=dialect)
        headers = reader.fieldnames
        rows = list(reader)

    return headers, rows


def detect_structure(headers, rows):
    """Detect data types for each column based on sample values."""
    data_types = {}

    for header in headers:
        # Sample values from first 10 rows
        sample_values = [row.get(header) for row in rows[:10] if row.get(header)]
        types = [detect_data_type(v) for v in sample_values]

        # Most common type wins (excluding empty)
        non_empty_types = [t for t in types if t != "empty"]
        if non_empty_types:
            data_types[header] = max(set(non_empty_types), key=non_empty_types.count)
        else:
            data_types[header] = "text"

    return {
        "headers": headers,
        "data_types": data_types,
        "row_count": len(rows),
        "column_count": len(headers),
    }


def smart_detect_column_mapping(headers, rows, data_types):
    """AI-like smart detection of column mappings based on header names and content patterns."""
    mapping = {
        "title": None,
        "description": None,
        "priority": None,
        "story_points": None,
        "assignee": None,
        "due_date": None,
        "status": None,
        "labels": None,
    }

    headers_lower = {h.lower().strip(): h for h in headers}

    # Title detection - look for common patterns
    title_patterns = ["title", "name", "task", "item", "issue", "ticket", "summary", "subject", "todo", "card"]
    for pattern in title_patterns:
        for h_lower, h_orig in headers_lower.items():
            if pattern in h_lower:
                mapping["title"] = h_orig
                break
        if mapping["title"]:
            break

    # If no title found, use first text column with diverse long content
    if not mapping["title"]:
        for header in headers:
            if data_types.get(header) == "text":
                sample_values = [str(row.get(header, "")) for row in rows[:10] if row.get(header)]
                avg_len = sum(len(v) for v in sample_values) / len(sample_values) if sample_values else 0
                unique_ratio = len(set(sample_values)) / len(sample_values) if sample_values else 0
                # Good title column: moderate length, high uniqueness
                if 3 < avg_len < 200 and unique_ratio > 0.8:
                    mapping["title"] = header
                    break

    # Description detection
    desc_patterns = ["description", "desc", "detail", "details", "body", "content", "notes", "note", "comment"]
    for pattern in desc_patterns:
        for h_lower, h_orig in headers_lower.items():
            if pattern in h_lower and h_orig != mapping["title"]:
                mapping["description"] = h_orig
                break
        if mapping["description"]:
            break

    # If no explicit description, find longest text column (not title)
    if not mapping["description"]:
        max_avg_len = 0
        for header in headers:
            if header == mapping["title"]:
                continue
            if data_types.get(header) == "text":
                sample_values = [str(row.get(header, "")) for row in rows[:10] if row.get(header)]
                avg_len = sum(len(v) for v in sample_values) / len(sample_values) if sample_values else 0
                if avg_len > max_avg_len and avg_len > 50:  # Description should be substantial
                    max_avg_len = avg_len
                    mapping["description"] = header

    # Priority detection
    prio_patterns = ["priority", "prio", "urgency", "importance", "severity", "p0", "p1", "p2", "level"]
    for pattern in prio_patterns:
        for h_lower, h_orig in headers_lower.items():
            if pattern in h_lower:
                mapping["priority"] = h_orig
                break
        if mapping["priority"]:
            break

    # Also check content - columns with P0/P1/P2 or High/Medium/Low values
    if not mapping["priority"]:
        for header in headers:
            sample_values = [str(row.get(header, "")).upper().strip() for row in rows[:10] if row.get(header)]
            priority_keywords = {"P0", "P1", "P2", "P3", "P4", "HIGH", "MEDIUM", "LOW", "CRITICAL", "URGENT"}
            if sample_values and sum(1 for v in sample_values if v in priority_keywords) / len(sample_values) > 0.5:
                mapping["priority"] = header
                break

    # Story points detection
    points_patterns = ["point", "points", "story_point", "estimate", "effort", "size", "sp", "complexity"]
    for pattern in points_patterns:
        for h_lower, h_orig in headers_lower.items():
            if pattern in h_lower:
                mapping["story_points"] = h_orig
                break
        if mapping["story_points"]:
            break

    # Check for columns with small numbers (1, 2, 3, 5, 8, 13)
    if not mapping["story_points"]:
        fibonacci_like = {1, 2, 3, 5, 8, 13, 21}
        for header in headers:
            if data_types.get(header) == "number":
                sample_values = []
                for row in rows[:10]:
                    try:
                        val = int(float(str(row.get(header, 0))))
                        sample_values.append(val)
                    except:
                        pass
                if sample_values and all(v in fibonacci_like or 0 <= v <= 21 for v in sample_values):
                    mapping["story_points"] = header
                    break

    # Assignee detection
    assignee_patterns = ["assignee", "assigned", "owner", "responsible", "user", "person", "member"]
    for pattern in assignee_patterns:
        for h_lower, h_orig in headers_lower.items():
            if pattern in h_lower:
                mapping["assignee"] = h_orig
                break
        if mapping["assignee"]:
            break

    # Due date detection
    date_patterns = ["due", "deadline", "date", "target", "finish", "end"]
    for pattern in date_patterns:
        for h_lower, h_orig in headers_lower.items():
            if pattern in h_lower and data_types.get(headers_lower[h_lower]) in ["date", "text"]:
                mapping["due_date"] = h_orig
                break
        if mapping["due_date"]:
            break

    # Status detection
    status_patterns = ["status", "state", "stage", "column", "progress", "phase"]
    for pattern in status_patterns:
        for h_lower, h_orig in headers_lower.items():
            if pattern in h_lower:
                mapping["status"] = h_orig
                break
        if mapping["status"]:
            break

    # Labels/Tags detection
    label_patterns = ["label", "tag", "category", "type", "kind", "group"]
    for pattern in label_patterns:
        for h_lower, h_orig in headers_lower.items():
            if pattern in h_lower:
                mapping["labels"] = h_orig
                break
        if mapping["labels"]:
            break

    # Calculate confidence score
    confidence = 0
    if mapping["title"]:
        confidence += 40  # Title is most important
    if mapping["description"]:
        confidence += 20
    if mapping["priority"]:
        confidence += 15
    if mapping["story_points"]:
        confidence += 15
    if mapping["due_date"]:
        confidence += 5
    if mapping["assignee"]:
        confidence += 5

    return mapping, confidence


@imports_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_file():
    """Upload and parse an Excel or CSV file."""
    user_id = get_jwt_identity()
    project_id = request.form.get("project_id")

    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    project, membership = check_project_access(project_id, user_id)
    if not membership:
        return jsonify({"error": "Forbidden"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed. Supported: xlsx, xls, csv"}), 400

    # Check file size
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)

    if file_size > MAX_FILE_SIZE:
        return jsonify({"error": "File too large. Maximum size is 10MB"}), 400

    # Generate unique import ID and save file
    import_id = str(uuid_lib.uuid4())
    ext = file.filename.rsplit(".", 1)[1].lower()
    secure_name = f"{import_id}.{ext}"

    # Create uploads directory if needed
    upload_dir = os.path.join(UPLOAD_FOLDER, "imports")
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, secure_name)
    file.save(file_path)

    try:
        # Parse the file based on type
        if ext in ["xlsx", "xls"]:
            headers, rows = parse_excel(file_path)
        else:
            headers, rows = parse_csv(file_path)

        if not headers or len(headers) == 0:
            os.remove(file_path)
            return jsonify({"error": "Could not detect headers in file"}), 400

        # Detect structure
        structure = detect_structure(headers, rows)

        # Smart detect column mapping
        smart_mapping, confidence = smart_detect_column_mapping(headers, rows, structure["data_types"])

        # Store session data
        import_sessions[import_id] = {
            "id": import_id,
            "project_id": project_id,
            "user_id": user_id,
            "file_path": file_path,
            "file_type": ext,
            "original_filename": file.filename,
            "file_size": file_size,
            "headers": headers,
            "rows": rows,
            "structure": structure,
            "smart_mapping": smart_mapping,
            "mapping_confidence": confidence,
            "status": "preview",
            "created_at": datetime.now().isoformat(),
        }

        # Return preview data with smart mapping
        return jsonify({
            "import_id": import_id,
            "filename": file.filename,
            "file_type": ext,
            "structure": structure,
            "preview_rows": rows[:10],  # First 10 rows for preview
            "smart_mapping": smart_mapping,
            "mapping_confidence": confidence,
        }), 201

    except Exception as e:
        # Cleanup on error
        if os.path.exists(file_path):
            os.remove(file_path)
        return jsonify({"error": f"Failed to parse file: {str(e)}"}), 400


@imports_bp.route("/<import_id>/preview", methods=["GET"])
@jwt_required()
def get_preview(import_id):
    """Get preview data for an import session."""
    user_id = get_jwt_identity()

    session = import_sessions.get(import_id)
    if not session:
        return jsonify({"error": "Import session not found"}), 404

    if session["user_id"] != user_id:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({
        "import_id": import_id,
        "filename": session["original_filename"],
        "file_type": session["file_type"],
        "structure": session["structure"],
        "preview_rows": session["rows"][:20],
    })


@imports_bp.route("/<import_id>/process", methods=["POST"])
@jwt_required()
def process_import(import_id):
    """Process import with AI task extraction."""
    user_id = get_jwt_identity()

    session = import_sessions.get(import_id)
    if not session:
        return jsonify({"error": "Import session not found"}), 404

    if session["user_id"] != user_id:
        return jsonify({"error": "Forbidden"}), 403

    # Get column mapping from request
    data = request.json or {}
    column_mapping = data.get("column_mapping", {})
    use_ai = data.get("use_ai", True)

    # Default mapping if not provided (try to auto-detect)
    if not column_mapping:
        headers_lower = {h.lower(): h for h in session["headers"]}
        column_mapping = {
            "title": headers_lower.get("title") or headers_lower.get("name") or headers_lower.get("task") or session["headers"][0],
            "description": headers_lower.get("description") or headers_lower.get("desc") or headers_lower.get("details"),
            "priority": headers_lower.get("priority") or headers_lower.get("prio"),
            "story_points": headers_lower.get("story_points") or headers_lower.get("points") or headers_lower.get("estimate"),
        }

    # Extract tasks from rows
    tasks = []
    for row in session["rows"]:
        title_col = column_mapping.get("title")
        title = row.get(title_col) if title_col else None

        if not title or str(title).strip() == "":
            continue

        task = {
            "title": str(title).strip(),
            "description": "",
            "priority": None,
            "story_points": None,
        }

        # Map other fields
        if column_mapping.get("description"):
            desc = row.get(column_mapping["description"])
            task["description"] = str(desc) if desc else ""

        if column_mapping.get("priority"):
            prio = row.get(column_mapping["priority"])
            if prio:
                prio_str = str(prio).upper().strip()
                if prio_str in ["P0", "P1", "P2", "P3", "P4"]:
                    task["priority"] = prio_str
                elif prio_str in ["CRITICAL", "HIGH"]:
                    task["priority"] = "P0"
                elif prio_str == "MEDIUM":
                    task["priority"] = "P2"
                elif prio_str == "LOW":
                    task["priority"] = "P4"

        if column_mapping.get("story_points"):
            points = row.get(column_mapping["story_points"])
            if points:
                try:
                    task["story_points"] = int(float(str(points)))
                except (ValueError, TypeError):
                    pass

        tasks.append(task)

    # AI enhancement if enabled
    ai_suggestions = None
    if use_ai and tasks:
        ai_service = get_ai_service()
        if ai_service.is_enabled():
            ai_suggestions = ai_service.enhance_imported_tasks(tasks[:20])  # Limit for API costs

    # Update session
    session["extracted_tasks"] = tasks
    session["column_mapping"] = column_mapping
    session["ai_suggestions"] = ai_suggestions
    session["status"] = "processed"

    return jsonify({
        "import_id": import_id,
        "task_count": len(tasks),
        "tasks": tasks[:50],  # Return first 50 for preview
        "ai_suggestions": ai_suggestions,
        "column_mapping": column_mapping,
    })


@imports_bp.route("/<import_id>/confirm", methods=["POST"])
@jwt_required()
def confirm_import(import_id):
    """Create cards from confirmed import tasks."""
    user_id = get_jwt_identity()

    session = import_sessions.get(import_id)
    if not session:
        return jsonify({"error": "Import session not found"}), 404

    if session["user_id"] != user_id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.json or {}
    approved_tasks = data.get("tasks", session.get("extracted_tasks", []))
    board_id = data.get("board_id")
    column_id = data.get("column_id")

    if not board_id:
        # Get the first board in the project
        project_id = session["project_id"]
        board = Board.query.filter_by(project_id=project_id).first()
        if not board:
            return jsonify({"error": "No board found in project. Create a board first."}), 400
        board_id = board.id

    if not column_id:
        # Get the first column (usually "Backlog" or "To Do")
        column = Column.query.filter_by(board_id=board_id).order_by(Column.position).first()
        if not column:
            return jsonify({"error": "No column found in board. Create a column first."}), 400
        column_id = column.id

    # Create cards
    created_cards = []
    max_position = db.session.query(db.func.max(Card.position)).filter_by(column_id=column_id).scalar() or 0

    for i, task in enumerate(approved_tasks):
        if not task.get("title"):
            continue

        card = Card(
            column_id=column_id,
            title=task["title"][:500],  # Limit title length
            description=task.get("description", "")[:5000] if task.get("description") else None,
            priority=task.get("priority"),
            story_points=task.get("story_points"),
            position=max_position + i + 1,
            created_by=user_id,
        )
        db.session.add(card)
        created_cards.append(card)

    db.session.commit()

    # Cleanup session
    if os.path.exists(session["file_path"]):
        os.remove(session["file_path"])
    del import_sessions[import_id]

    return jsonify({
        "message": f"Successfully created {len(created_cards)} cards",
        "created_count": len(created_cards),
        "card_ids": [str(c.id) for c in created_cards],
        "board_id": str(board_id),
        "column_id": str(column_id),
    })


@imports_bp.route("/<import_id>", methods=["DELETE"])
@jwt_required()
def cancel_import(import_id):
    """Cancel an import session and cleanup files."""
    user_id = get_jwt_identity()

    session = import_sessions.get(import_id)
    if not session:
        return jsonify({"error": "Import session not found"}), 404

    if session["user_id"] != user_id:
        return jsonify({"error": "Forbidden"}), 403

    # Cleanup
    if os.path.exists(session["file_path"]):
        os.remove(session["file_path"])
    del import_sessions[import_id]

    return jsonify({"message": "Import cancelled"})
