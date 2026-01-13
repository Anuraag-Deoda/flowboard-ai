// User types
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: "admin" | "member" | "viewer";
  user: User;
}

// Workspace types
export interface Workspace {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
}

// Project types
export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

// Board types
export interface Board {
  id: string;
  project_id: string;
  organization_id?: string;
  name: string;
  created_at: string;
  columns?: Column[];
}

// Column types
export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: number;
  wip_limit: number | null;
  color: string | null;
  card_count: number;
  is_over_wip_limit: boolean;
  cards?: Card[];
}

// Card types
export type Priority = "P0" | "P1" | "P2" | "P3" | "P4";

export interface Card {
  id: string;
  column_id: string;
  title: string;
  description?: string;
  priority: Priority | null;
  story_points: number | null;
  time_estimate: number | null;
  due_date: string | null;
  position: number;
  assignees: CardAssignee[];
  labels: CardLabel[];
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_user?: User;
  comments?: Comment[];
  subtasks?: Subtask[];
  attachments?: Attachment[];
}

export interface CardAssignee {
  user_id: string;
  user: User;
}

export interface CardLabel {
  label_id: string;
  label: Label;
}

// Label types
export interface Label {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
}

// Comment types
export interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  user: User;
  content: string;
  created_at: string;
}

// Subtask types
export interface Subtask {
  id: string;
  card_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
  updated_at: string | null;
}

// Card Link types
export type LinkType = "blocks" | "blocked_by" | "relates_to" | "duplicates" | "duplicated_by";

export interface CardLink {
  id: string;
  source_card_id: string;
  target_card_id: string;
  link_type: LinkType;
  source_card: { id: string; title: string } | null;
  target_card: { id: string; title: string } | null;
  created_at: string;
}

export interface CardLinks {
  outgoing: CardLink[];
  incoming: CardLink[];
}

// Attachment types
export interface Attachment {
  id: string;
  card_id: string;
  filename: string;
  file_size: number;
  mime_type: string | null;
  uploaded_by: string | null;
  uploaded_by_user: User | null;
  created_at: string;
}

// Sprint types
export type SprintStatus = "planning" | "active" | "completed";

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  created_at: string;
}

// Daily log types
export interface DailyLog {
  id: string;
  user_id: string;
  project_id: string;
  log_date: string;
  tasks_worked: TaskWorked[];
  total_time_spent: number;
  remaining_work: string | null;
  blockers: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWorked {
  card_id: string;
  time_spent: number; // minutes
  notes: string | null;
}

// Activity log types
export interface ActivityLog {
  id: string;
  card_id: string | null;
  user_id: string;
  user: User;
  action: string;
  details: Record<string, any>;
  created_at: string;
}

// Domain event types
export interface DomainEvent {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  actor_id: string | null;
  payload: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
}
