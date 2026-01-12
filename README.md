# FlowBoard AI

A Jira-like Kanban board with AI-first workflows. Built with Next.js 14 and Flask.

## Features

- **Smart Kanban Board**: Drag-and-drop cards, WIP limits, custom columns
- **Daily Time Tracking**: Log work in under 2 minutes
- **Domain Event Architecture**: Event-driven system for automation and AI
- **Sprint Retrospectives**: Capture context and insights
- **AI Integration**: Intelligent document import and suggestions (coming soon)

## Tech Stack

### Frontend
- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- dnd-kit for drag-and-drop
- Zustand for state management
- TanStack Query for data fetching

### Backend
- Flask 3.0
- SQLAlchemy 2.0
- PostgreSQL 15
- Redis
- Flask-SocketIO for real-time

## Quick Start

### Using Docker (Recommended)

1. **Clone and start services**:
   ```bash
   cd kanban
   docker-compose up -d
   ```

2. **Initialize the database**:
   ```bash
   docker-compose exec backend python scripts/init_db.py --seed
   ```

3. **Access the app**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000/api
   - Demo credentials: `demo@flowboard.ai` / `demo1234`

### Manual Setup

#### Backend

1. **Create virtual environment**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Start PostgreSQL and Redis** (locally or via Docker):
   ```bash
   docker run -d --name flowboard-db -e POSTGRES_USER=flowboard -e POSTGRES_PASSWORD=flowboard -e POSTGRES_DB=flowboard -p 5432:5432 postgres:15-alpine
   docker run -d --name flowboard-redis -p 6379:6379 redis:7-alpine
   ```

4. **Initialize database**:
   ```bash
   python scripts/init_db.py --seed
   ```

5. **Run the server**:
   ```bash
   python wsgi.py
   ```

#### Frontend

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

## Project Structure

```
kanban/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # Flask factory
│   │   ├── config.py            # Configuration
│   │   ├── extensions.py        # Flask extensions
│   │   ├── api/                  # API blueprints
│   │   │   ├── auth.py
│   │   │   ├── boards.py
│   │   │   ├── cards.py
│   │   │   └── ...
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── card.py
│   │   │   ├── domain_event.py
│   │   │   └── ...
│   │   ├── events/              # Domain events
│   │   │   ├── dispatcher.py
│   │   │   ├── handlers.py
│   │   │   └── base.py
│   │   └── services/            # Business logic
│   ├── scripts/
│   │   └── init_db.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router
│   │   │   ├── page.tsx
│   │   │   ├── login/
│   │   │   ├── dashboard/
│   │   │   └── board/[boardId]/
│   │   ├── components/
│   │   │   └── board/
│   │   │       ├── KanbanColumn.tsx
│   │   │       └── KanbanCard.tsx
│   │   ├── lib/
│   │   │   └── api.ts
│   │   ├── store/
│   │   │   ├── auth.ts
│   │   │   └── board.ts
│   │   └── types/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── PHASE_PLANNER.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh token

### Organizations
- `GET /api/organizations/` - List organizations
- `POST /api/organizations/` - Create organization
- `GET /api/organizations/:id` - Get organization
- `PUT /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Delete organization

### Boards
- `GET /api/boards/?project_id=` - List boards
- `POST /api/boards/` - Create board
- `GET /api/boards/:id` - Get board with columns and cards

### Cards
- `GET /api/cards/?board_id=` - List cards
- `POST /api/cards/` - Create card
- `GET /api/cards/:id` - Get card details
- `PUT /api/cards/:id` - Update card
- `PUT /api/cards/:id/move` - Move card
- `DELETE /api/cards/:id` - Delete card

## Domain Events

The system uses domain events for:
- Activity log generation
- Real-time WebSocket updates
- Automation rules (future)
- AI context assembly (future)

Event types:
- `card.created`, `card.moved`, `card.assigned`, etc.
- `column.wip_exceeded`
- `sprint.started`, `sprint.completed`
- `daily_log.submitted`

## Development

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Database Migrations

```bash
cd backend
flask db init      # First time only
flask db migrate -m "Description"
flask db upgrade
```

## Roadmap

See [PHASE_PLANNER.md](./PHASE_PLANNER.md) for detailed implementation phases.

**MVP (Phases 0-7)**:
- [x] Phase 0: Foundation & Setup
- [ ] Phase 1: Authentication & Core Structure
- [ ] Phase 2: Kanban Board Core
- [ ] Phase 3: Backlog & Sprint Management
- [ ] Phase 4: Daily Time Tracking
- [ ] Phase 5: Document Import
- [ ] Phase 6: AI Integration
- [ ] Phase 7: Reporting & Analytics

**Post-MVP (Phases 8-10)**:
- Phase 8: Advanced Automation
- Phase 9: Predictive Features
- Phase 10: Integrations (GitHub, Slack, etc.)

## License

MIT
