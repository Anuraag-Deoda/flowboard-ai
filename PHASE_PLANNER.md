# FlowBoard AI - Implementation Phase Planner

> **Tech Stack**: Next.js (Frontend) + Flask (Backend) + PostgreSQL + Redis

---

## Overview

This document outlines the phased implementation plan for FlowBoard AI, a Jira-like Kanban board with AI-first workflows. The plan is structured to deliver incremental value while building toward the complete vision.

---

## Phase 0: Foundation & Setup

### 0.1 Project Infrastructure

**Frontend (Next.js)**
- [x] Initialize Next.js 14+ with App Router
- [x] Configure TypeScript
- [x] Set up Tailwind CSS + shadcn/ui components
- [x] Configure ESLint + Prettier
- [x] Set up environment variables structure

**Backend (Flask)**
- [x] Initialize Flask application with factory pattern
- [x] Configure Flask-SQLAlchemy + Flask-Migrate
- [x] Set up PostgreSQL connection
- [x] Configure Redis connection
- [x] Set up Flask-CORS for API access
- [x] Implement base API structure (blueprints)
- [x] Configure logging and error handling

**DevOps**
- [x] Set up Docker Compose for local development
- [x] Configure database migrations workflow
- [ ] Set up basic CI pipeline (lint + tests)

### 0.2 Database Schema Design

```sql
-- Core entities to design upfront
Organizations
Workspaces
Projects
Boards
Columns
Cards (Issues)
Users
TeamMemberships
Labels
Comments
ActivityLogs
DailyLogs
Attachments
```

### 0.3 Domain Event Architecture (Critical Foundation)

> **Why this matters**: Without events, activity logs become brittle, the rules engine becomes spaghetti, and AI context reconstruction becomes expensive. Build this foundation early.

**Event Types to Define**
```python
# Card Events
card.created
card.updated
card.moved          # column change
card.assigned
card.unassigned
card.commented
card.blocked
card.unblocked
card.completed

# Column Events
column.created
column.wip_exceeded
column.wip_resolved

# Sprint Events
sprint.started
sprint.completed
sprint.extended

# Daily Log Events
daily_log.submitted
daily_log.updated

# Import Events
import.started
import.completed
import.failed
```

**Backend Tasks**
- [x] Create `DomainEvent` base class
- [x] Implement event dispatcher (in-process, sync for MVP)
- [x] Create `domain_events` table for persistence
- [x] Build event handlers registry
- [x] Wire events into service layer (not controllers)
- [x] Activity log handler (subscribes to all events)
- [ ] Future-proof: Redis pub/sub adapter for async handlers

**Event Flow Pattern**
```
Service Method → Emit Event → Dispatcher → Handlers
                                    ├── ActivityLogHandler (always)
                                    ├── NotificationHandler (if configured)
                                    ├── AutomationHandler (Phase 8)
                                    └── AIContextHandler (Phase 6)
```

**Database Schema**
```sql
CREATE TABLE domain_events (
    id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,      -- 'card.moved'
    aggregate_type VARCHAR(50) NOT NULL,   -- 'card'
    aggregate_id UUID NOT NULL,            -- card.id
    actor_id UUID REFERENCES users(id),
    payload JSONB NOT NULL,                -- event-specific data
    metadata JSONB,                        -- request_id, ip, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_aggregate ON domain_events(aggregate_type, aggregate_id);
CREATE INDEX idx_events_type ON domain_events(event_type);
CREATE INDEX idx_events_created ON domain_events(created_at);
```

**Why Not Just activity_logs?**
- `activity_logs` = human-readable history for UI
- `domain_events` = machine-readable facts for:
  - Rebuilding state
  - Automation triggers
  - AI context assembly
  - Audit compliance
  - Analytics pipelines

**Deliverable**: Working local dev environment with empty Next.js app connecting to Flask API + event infrastructure

---

## Phase 1: Authentication & Core Structure (MVP Foundation)

### 1.1 Authentication System

**Backend Tasks**
- [x] User model with password hashing (argon2/bcrypt)
- [x] JWT token generation and validation
- [x] Token refresh mechanism
- [x] Login endpoint (`POST /api/auth/login`)
- [x] Register endpoint (`POST /api/auth/register`)
- [x] Logout endpoint (`POST /api/auth/logout`)
- [x] Current user endpoint (`GET /api/auth/me`)
- [ ] Password reset flow (optional for MVP)

**Frontend Tasks**
- [x] Login page with form validation
- [x] Registration page
- [x] Auth context/store (Zustand or Context API)
- [x] Protected route wrapper
- [x] Token storage and auto-refresh
- [x] Auth state persistence

**OAuth (Can defer to Phase 1.5)**
- [ ] Google OAuth integration
- [ ] GitHub OAuth integration

### 1.2 Workspace & Project Structure

**Backend Tasks**
- [x] Organization CRUD endpoints
- [x] Workspace CRUD endpoints
- [x] Project CRUD endpoints
- [x] Team membership management
- [x] Role-based access control (Admin/Member/Viewer)

**Database Models**
```python
# Key relationships
Organization -> Workspaces (1:N)
Workspace -> Projects (1:N)
Project -> Boards (1:N)
User -> Organizations (M:N via memberships)
```

**Frontend Tasks**
- [x] Organization selector/switcher
- [x] Workspace list view
- [x] Project list view
- [x] Create/Edit project modals
- [ ] Team management UI
- [ ] Settings pages

**Deliverable**: Users can register, login, create organizations, workspaces, and projects

---

## Phase 2: Kanban Board Core

### 2.1 Board Infrastructure

**Backend Tasks**
- [x] Board model and CRUD endpoints
- [x] Column model with ordering support
- [x] Default column templates (Backlog, To Do, In Progress, Review, Done)
- [x] Column reordering endpoint
- [x] WIP limit configuration

**Frontend Tasks**
- [x] Board view layout
- [x] Column components with headers
- [x] Column add/edit/delete functionality
- [x] Column drag-to-reorder
- [x] WIP limit indicators

### 2.2 Card/Issue System

**Backend Tasks**
- [x] Card model with all fields:
  - Title, Description (Markdown)
  - Status, Assignee(s), Priority (P0-P4)
  - Story points, Time estimate
  - Labels, Due date
  - Position within column
- [x] Card CRUD endpoints
- [x] Card move endpoint (column + position)
- [x] Card search/filter endpoint
- [x] Bulk operations endpoint

**Frontend Tasks**
- [x] Card component (compact board view)
- [x] Card detail modal/panel
- [x] Markdown editor for description
- [x] Assignee picker
- [x] Priority selector
- [x] Label management
- [x] Due date picker
- [x] Drag-and-drop between columns (use dnd-kit)
- [x] Card quick-create inline

### 2.3 Advanced Card Features

**Backend Tasks**
- [x] Subtasks model and endpoints
- [x] Issue linking (blocks, relates to, duplicates)
- [x] Comments model and endpoints
- [x] Attachments (file upload to S3/local)
- [x] Activity log auto-generation

**Frontend Tasks**
- [x] Subtasks checklist UI
- [x] Issue linking interface
- [x] Comments thread
- [x] File attachment upload
- [x] Activity timeline view

**Deliverable**: Fully functional Kanban board with drag-drop, cards, and all core features

---

## Phase 3: Backlog Management

### 3.1 Backlog View

**Backend Tasks**
- [ ] Backlog-specific query endpoint (cards in Backlog column)
- [ ] Backlog ordering/prioritization
- [ ] Grouping support (by Epic, Label, Priority)
- [ ] Epic model and endpoints

**Frontend Tasks**
- [ ] Dedicated backlog page/view
- [ ] Drag-to-prioritize list
- [ ] Group by toggles
- [ ] Epic management
- [ ] Quick filters

### 3.2 Sprint Planning

**Backend Tasks**
- [ ] Sprint model (start date, end date, goal)
- [ ] Sprint CRUD endpoints
- [ ] Move cards to sprint
- [ ] Sprint capacity tracking

**Frontend Tasks**
- [ ] Sprint planning view
- [ ] Drag cards from backlog to sprint
- [ ] Sprint capacity indicator
- [ ] Active sprint board filter

### 3.3 Sprint Retrospectives & Context (Key Insight Layer)

> **Why this matters**: Teams track tasks, time, and status. But when a sprint fails, the story is scattered across logs, cards, and comments. Retrospectives turn raw data into actionable insight.

**Backend Tasks**
- [ ] SprintRetrospective model:
  ```python
  sprint_id (FK),
  what_went_well: text,
  what_went_wrong: text,
  action_items: JSONB,  # [{description, assignee_id, status}]
  team_mood: int,       # 1-5 scale
  created_by: user_id,
  ai_summary: text,     # generated
  ai_insights: JSONB    # detected patterns
  ```
- [ ] Retrospective CRUD endpoints
- [ ] Link action items to cards (create follow-up tasks)
- [ ] Historical retrospective query (patterns over time)

**Frontend Tasks**
- [ ] Sprint retrospective form (post-sprint)
- [ ] What went well / wrong sections
- [ ] Action items with owner assignment
- [ ] Team mood indicator
- [ ] Historical retro timeline view
- [ ] Pattern visualization (recurring issues)

**AI Integration (Phase 6)**
- [ ] Auto-generate retro summary from:
  - Cards completed vs planned
  - Blockers reported in daily logs
  - Cards that spilled over
  - Time estimate vs actual drift
  - Event patterns (many moves = scope creep?)
- [ ] Detect recurring problems across sprints
- [ ] Suggest action items based on patterns

**Database Schema**
```sql
CREATE TABLE sprint_retrospectives (
    id UUID PRIMARY KEY,
    sprint_id UUID REFERENCES sprints(id) UNIQUE,
    what_went_well TEXT,
    what_went_wrong TEXT,
    action_items JSONB,     -- [{description, assignee_id, status, card_id}]
    team_mood INTEGER CHECK (team_mood BETWEEN 1 AND 5),
    ai_summary TEXT,
    ai_insights JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Sprint notes for ongoing context (not just end-of-sprint)
CREATE TABLE sprint_notes (
    id UUID PRIMARY KEY,
    sprint_id UUID REFERENCES sprints(id),
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    note_type VARCHAR(50),  -- 'observation', 'risk', 'decision', 'blocker'
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sprint_notes_sprint ON sprint_notes(sprint_id);
```

**Deliverable**: Complete backlog, sprint planning, and retrospective workflow

---

## Phase 4: Daily Time Tracking (Key Differentiator)

### 4.1 Daily Log System

**Backend Tasks**
- [ ] DailyLog model:
  ```python
  user_id, date,
  tasks_worked: [{card_id, time_spent, notes}],
  remaining_work: text,
  blockers: text,
  general_notes: text
  ```
- [ ] Daily log CRUD endpoints
- [ ] Auto-suggest tasks (cards assigned + recently touched)
- [ ] Aggregation endpoints (by user, task, sprint, project)

**Frontend Tasks**
- [ ] Daily log form (single-screen UX)
- [ ] Task auto-suggestions
- [ ] Time input per task
- [ ] Pre-fill from yesterday's remaining work
- [ ] Calendar view of past logs
- [ ] Quick blockers input

### 4.2 Time Analytics

**Backend Tasks**
- [ ] Time vs estimate comparison endpoint
- [ ] Burndown data calculation
- [ ] Individual velocity metrics
- [ ] "Invisible work" detection logic

**Frontend Tasks**
- [ ] Personal time dashboard
- [ ] Time vs estimate charts
- [ ] Burndown chart
- [ ] Drift alerts/indicators

**Deliverable**: Complete daily tracking workflow with < 2 min completion target

---

## Phase 5: Document/Sheet Import

### 5.1 File Upload & Parsing

**Backend Tasks**
- [ ] File upload endpoint (xlsx, csv)
- [ ] Excel parsing (openpyxl)
- [ ] CSV parsing
- [ ] Structure detection (headers, data types)
- [ ] Preview generation endpoint

**Frontend Tasks**
- [ ] Upload dropzone
- [ ] File type validation
- [ ] Upload progress indicator
- [ ] Structure preview table

### 5.2 AI-Powered Import Processing

**Backend Tasks**
- [ ] AI service integration (OpenRouter/OpenAI)
- [ ] Prompt for task extraction
- [ ] Backlog item generation from parsed data
- [ ] Subtask inference
- [ ] Duplicate detection
- [ ] Dependency suggestion

**Frontend Tasks**
- [ ] AI suggestion preview
- [ ] Edit/approve/reject interface
- [ ] Mapping customization
- [ ] Batch import confirmation
- [ ] Import history

**Deliverable**: Upload Excel/CSV → AI suggests backlog items → User approves → Cards created

---

## Phase 6: AI Integration Layer

### 6.1 AI Service Architecture

**Backend Tasks**
- [ ] AI service abstraction layer
- [ ] OpenRouter integration
- [ ] OpenAI integration
- [ ] Model routing logic:
  - Document parsing → Claude/GPT-4
  - Task splitting → GPT-4/LLaMA
  - Summaries → lightweight models
- [ ] Prompt template management
- [ ] Response caching (Redis)
- [ ] Rate limiting per user/org
- [ ] Cost tracking

### 6.2 AI Features - Backlog Grooming

**Backend Tasks**
- [ ] Vague task detection endpoint
- [ ] Task splitting suggestions
- [ ] Missing acceptance criteria detection
- [ ] Estimation validation

**Frontend Tasks**
- [ ] AI suggestions panel in backlog
- [ ] Accept/reject suggestion buttons
- [ ] Explanation tooltips
- [ ] Bulk apply suggestions

### 6.3 AI Features - Daily Summaries

**Backend Tasks**
- [ ] Daily standup summary generation
- [ ] Team progress summary
- [ ] Risk detection (stuck tasks)

**Frontend Tasks**
- [ ] AI summary cards
- [ ] Team daily digest view

**Deliverable**: AI assists with backlog grooming, task refinement, and daily summaries

---

## Phase 7: Reporting & Analytics (MVP Complete)

### 7.1 Dashboards

**Backend Tasks**
- [ ] Sprint health metrics endpoint
- [ ] Velocity calculation
- [ ] Completion rate metrics
- [ ] Time tracking aggregations

**Frontend Tasks**
- [ ] Sprint dashboard
- [ ] Velocity chart
- [ ] Burndown/burnup charts
- [ ] Team workload view
- [ ] Personal productivity view

### 7.2 Export

**Backend Tasks**
- [ ] CSV export endpoint
- [ ] PDF report generation (WeasyPrint/ReportLab)
- [ ] API documentation (for future integrations)

**Frontend Tasks**
- [ ] Export buttons/modals
- [ ] Report customization
- [ ] Scheduled reports setup

**Deliverable**: MVP Complete - Full Kanban + Time Tracking + AI Import + Analytics

---

## Phase 8: Advanced Automation (Post-MVP)

### 8.1 Rules Engine

**Backend Tasks**
- [ ] Rule model (trigger, condition, action)
- [ ] Rule evaluation engine
- [ ] Built-in rule templates:
  - Task in progress > X days → notify
  - Blocker added → alert lead
  - Sprint capacity exceeded → warn
- [ ] Custom rule builder API

**Frontend Tasks**
- [ ] Rules management page
- [ ] Rule builder UI
- [ ] Rule templates gallery
- [ ] Notification preferences

### 8.2 Smart Assignment

**Backend Tasks**
- [ ] Skill/history tracking per user
- [ ] Availability calculation
- [ ] Assignment suggestion algorithm
- [ ] Workload balancing

**Frontend Tasks**
- [ ] Assignment suggestions in card detail
- [ ] Team capacity view
- [ ] Auto-assign toggle

---

## Phase 9: Predictive Features (Post-MVP)

### 9.1 Sprint Predictions

**Backend Tasks**
- [ ] Sprint spillover prediction model
- [ ] Historical data analysis
- [ ] Confidence scoring for estimates
- [ ] Burnout risk indicators

**Frontend Tasks**
- [ ] Prediction indicators on sprint view
- [ ] Risk alerts
- [ ] What-if scenario tool

### 9.2 AI Learning Loop

**Backend Tasks**
- [ ] Feedback collection (suggestion accept/reject)
- [ ] Model fine-tuning pipeline
- [ ] A/B testing framework for prompts
- [ ] Accuracy tracking over time

---

## Phase 10: Integrations (Post-MVP)

### 10.1 Developer Tools

- [ ] GitHub integration (commits, PRs → cards)
- [ ] GitLab integration
- [ ] Bitbucket integration

### 10.2 Communication

- [ ] Slack integration
- [ ] Discord integration
- [ ] Email notifications

### 10.3 Import/Export

- [ ] Jira import
- [ ] Trello import
- [ ] Asana import

---

## Real-Time Features (Cross-cutting)

**To implement alongside Phase 2+**

**Backend Tasks**
- [ ] WebSocket setup (Flask-SocketIO)
- [ ] Real-time event broadcasting
- [ ] Presence indicators
- [ ] Optimistic update handling

**Frontend Tasks**
- [ ] WebSocket client setup
- [ ] Real-time card updates
- [ ] Presence indicators (who's viewing)
- [ ] Conflict resolution UI

---

## API Structure Reference

```
/api
├── /auth
│   ├── POST /login
│   ├── POST /register
│   ├── POST /logout
│   └── GET  /me
├── /organizations
│   ├── GET, POST /
│   └── GET, PUT, DELETE /:id
├── /workspaces
│   ├── GET, POST /
│   └── GET, PUT, DELETE /:id
├── /projects
│   ├── GET, POST /
│   ├── GET, PUT, DELETE /:id
│   └── GET /:id/members
├── /boards
│   ├── GET, POST /
│   ├── GET, PUT, DELETE /:id
│   └── PUT /:id/columns/reorder
├── /columns
│   ├── GET, POST /
│   └── GET, PUT, DELETE /:id
├── /cards
│   ├── GET, POST /
│   ├── GET, PUT, DELETE /:id
│   ├── PUT /:id/move
│   ├── POST /:id/comments
│   └── POST /:id/attachments
├── /daily-logs
│   ├── GET, POST /
│   └── GET, PUT /:date
├── /import
│   ├── POST /upload
│   ├── GET  /preview/:id
│   └── POST /confirm/:id
├── /ai
│   ├── POST /suggest-tasks
│   ├── POST /groom-backlog
│   └── POST /summarize
└── /analytics
    ├── GET /sprint/:id
    ├── GET /velocity
    └── GET /time-tracking
```

---

## Database Schema (PostgreSQL)

```sql
-- Core Tables (Phase 0-2)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE organization_members (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(50) NOT NULL, -- admin, member, viewer
    UNIQUE(organization_id, user_id)
);

CREATE TABLE workspaces (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE boards (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE columns (
    id UUID PRIMARY KEY,
    board_id UUID REFERENCES boards(id),
    name VARCHAR(255) NOT NULL,
    position INTEGER NOT NULL,
    wip_limit INTEGER,
    color VARCHAR(50)
);

CREATE TABLE cards (
    id UUID PRIMARY KEY,
    column_id UUID REFERENCES columns(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(10), -- P0, P1, P2, P3, P4
    story_points INTEGER,
    time_estimate INTEGER, -- in minutes
    due_date DATE,
    position INTEGER NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE card_assignees (
    card_id UUID REFERENCES cards(id),
    user_id UUID REFERENCES users(id),
    PRIMARY KEY (card_id, user_id)
);

CREATE TABLE labels (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    name VARCHAR(100) NOT NULL,
    color VARCHAR(50)
);

CREATE TABLE card_labels (
    card_id UUID REFERENCES cards(id),
    label_id UUID REFERENCES labels(id),
    PRIMARY KEY (card_id, label_id)
);

CREATE TABLE comments (
    id UUID PRIMARY KEY,
    card_id UUID REFERENCES cards(id),
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE daily_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    log_date DATE NOT NULL,
    tasks_worked JSONB, -- [{card_id, time_spent, notes}]
    remaining_work TEXT,
    blockers TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, project_id, log_date)
);

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY,
    card_id UUID REFERENCES cards(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Domain Events (Phase 0.3 - Critical Foundation)
CREATE TABLE domain_events (
    id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id UUID NOT NULL,
    actor_id UUID REFERENCES users(id),
    payload JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_aggregate ON domain_events(aggregate_type, aggregate_id);
CREATE INDEX idx_events_type ON domain_events(event_type);
CREATE INDEX idx_events_created ON domain_events(created_at);

-- Sprints (Phase 3)
CREATE TABLE sprints (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    goal TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'planning', -- planning, active, completed
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE card_sprints (
    card_id UUID REFERENCES cards(id),
    sprint_id UUID REFERENCES sprints(id),
    PRIMARY KEY (card_id, sprint_id)
);

-- Sprint Retrospectives & Notes (Phase 3.3)
CREATE TABLE sprint_retrospectives (
    id UUID PRIMARY KEY,
    sprint_id UUID REFERENCES sprints(id) UNIQUE,
    what_went_well TEXT,
    what_went_wrong TEXT,
    action_items JSONB,
    team_mood INTEGER CHECK (team_mood BETWEEN 1 AND 5),
    ai_summary TEXT,
    ai_insights JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sprint_notes (
    id UUID PRIMARY KEY,
    sprint_id UUID REFERENCES sprints(id),
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    note_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sprint_notes_sprint ON sprint_notes(sprint_id);
```

---

## Tech Stack Details

### Frontend (Next.js 14+)
- **Framework**: Next.js with App Router
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand or TanStack Query
- **Drag & Drop**: dnd-kit
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts or Tremor
- **Real-time**: Socket.io-client

### Backend (Flask)
- **Framework**: Flask 3.0+
- **ORM**: SQLAlchemy 2.0
- **Migrations**: Flask-Migrate (Alembic)
- **Auth**: Flask-JWT-Extended
- **Validation**: Marshmallow or Pydantic
- **Real-time**: Flask-SocketIO
- **Tasks**: Celery + Redis
- **AI**: LangChain or direct API calls

### Infrastructure
- **Database**: PostgreSQL 15+
- **Cache/Queue**: Redis
- **File Storage**: S3 or local (dev)
- **Deployment**: Docker + Railway/Render/Vercel

---

## MVP Completion Checklist

- [x] Phase 0: Foundation & Setup ✅
- [x] Phase 1: Authentication & Core Structure ✅ (missing: password reset, OAuth, team UI, settings)
- [x] Phase 2: Kanban Board Core ✅
- [ ] Phase 3: Backlog Management
- [ ] Phase 4: Daily Time Tracking
- [ ] Phase 5: Document/Sheet Import
- [ ] Phase 6: AI Integration Layer
- [ ] Phase 7: Reporting & Analytics

**MVP Target**: Phases 0-7
**Current Progress**: ~45% of MVP complete

---

## Notes & Decisions

1. **Flask over FastAPI**: Using Flask as specified for backend (PRD suggested FastAPI but user requested Flask)

2. **AI Model Strategy**: Start with OpenAI GPT-4 for reliability, add OpenRouter for cost optimization later

3. **Real-time Priority**: WebSocket features should be added progressively starting Phase 2

4. **Mobile**: Not in initial scope - focus on responsive web first

5. **Multi-tenancy**: Data isolation via organization_id foreign keys throughout

6. **Domain Events over CRUD-only**: Implemented in Phase 0.3 as foundational architecture
   - `domain_events` table stores machine-readable facts
   - `activity_logs` remains for human-readable UI history
   - Events power: automation rules, AI context, real-time sync, audit trails
   - Start with sync in-process dispatcher, graduate to Redis pub/sub

7. **Sprint Retrospectives**: Added to Phase 3.3 for context capture
   - Answers "why did this sprint go wrong?" question
   - `sprint_retrospectives` for formal end-of-sprint analysis
   - `sprint_notes` for ongoing context during sprint
   - AI integration generates summaries from event history

8. **Event-First Activity Logs**: Activity logs are now *derived* from domain events
   - ActivityLogHandler subscribes to events and generates human-readable entries
   - Single source of truth (events), multiple representations

---

## Architecture Diagrams

### Domain Event Flow
```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────────────────┐
│   Service   │────▶│   Emit Event │────▶│         Event Dispatcher        │
│   Method    │     │              │     │                                 │
└─────────────┘     └──────────────┘     └─────────────────────────────────┘
                                                        │
                    ┌───────────────────────────────────┼───────────────────────────────────┐
                    │                   │               │               │                   │
                    ▼                   ▼               ▼               ▼                   ▼
            ┌───────────────┐   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
            │ Persist Event │   │ Activity Log  │ │  WebSocket    │ │  Automation   │ │  AI Context   │
            │  (DB Write)   │   │   Handler     │ │  Broadcast    │ │   Engine      │ │   Builder     │
            └───────────────┘   └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
```

### Sprint Context Assembly (for AI)
```
┌─────────────────────────────────────────────────────────────────────┐
│                        Sprint Context                                │
├─────────────────────────────────────────────────────────────────────┤
│  Events: card.moved, card.blocked, daily_log.submitted, ...         │
│  Daily Logs: blockers, time entries, notes                          │
│  Sprint Notes: observations, risks, decisions                       │
│  Cards: spillover, estimates vs actuals                             │
│  Comments: discussions, decisions                                    │
├─────────────────────────────────────────────────────────────────────┤
│                              ▼                                       │
│                     AI Retrospective Summary                         │
│           "Sprint failed due to scope creep (5 cards added          │
│            mid-sprint) and underestimated API integration"          │
└─────────────────────────────────────────────────────────────────────┘
```

---

*Last Updated: January 2026*
