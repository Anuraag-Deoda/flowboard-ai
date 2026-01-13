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
  cards?: Card[];
}

// Sprint Retrospective types
export type NoteType = "observation" | "risk" | "decision" | "blocker";

export interface ActionItem {
  description: string;
  assignee_id?: string;
  status?: "pending" | "in_progress" | "completed";
  card_id?: string;
}

export interface SprintRetrospective {
  id: string;
  sprint_id: string;
  what_went_well: string | null;
  what_went_wrong: string | null;
  action_items: ActionItem[] | null;
  team_mood: number | null;
  ai_summary: string | null;
  ai_insights: AIInsight[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIInsight {
  category: "velocity" | "scope" | "blockers" | "collaboration" | "quality";
  finding: string;
  severity: "info" | "warning" | "critical";
}

export interface AIRetrospectiveSummary {
  summary: string;
  insights: AIInsight[];
  recommendations: Array<{
    action: string;
    priority: "high" | "medium" | "low";
    rationale: string;
  }>;
  health_score: number;
  key_wins: string[];
  areas_for_improvement: string[];
}

export interface SprintNote {
  id: string;
  sprint_id: string;
  user_id: string;
  user: User | null;
  content: string;
  note_type: NoteType | null;
  created_at: string;
}

export interface SprintMetrics {
  total_cards: number;
  completed_cards: number;
  total_story_points: number;
  completed_story_points: number;
  completion_percentage: number;
  days_remaining: number;
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

// Analytics types
export interface VelocityDataPoint {
  sprint_id: string;
  sprint_name: string;
  start_date: string;
  end_date: string;
  planned_points: number;
  completed_points: number;
  total_cards: number;
  completed_cards: number;
}

export interface VelocityResponse {
  velocity: VelocityDataPoint[];
  average_velocity: number;
  total_sprints: number;
}

export interface BurndownDataPoint {
  date: string;
  day: number;
  ideal_remaining: number;
  actual_remaining: number;
  ideal_completed: number;
}

export interface BurndownResponse {
  burndown: BurndownDataPoint[];
  sprint_name: string;
  total_points: number;
  total_cards: number;
  start_date: string;
  end_date: string;
  status: SprintStatus;
}

export interface WorkloadMember {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  total_cards: number;
  completed_cards: number;
  in_progress_cards: number;
  total_points: number;
  completed_points: number;
  total_time_spent: number;
  completion_rate: number;
}

export interface WorkloadResponse {
  workload: WorkloadMember[];
  total_members: number;
}

export interface PersonalProductivitySummary {
  total_time_spent: number;
  avg_daily_time: number;
  total_cards: number;
  completed_cards: number;
  total_points: number;
  completed_points: number;
  completion_rate: number;
  days_with_blockers: number;
  days_tracked: number;
}

export interface PersonalDailyData {
  date: string;
  time_spent: number;
  tasks_count: number;
  has_blockers: boolean;
}

export interface PersonalProductivityResponse {
  summary: PersonalProductivitySummary;
  daily_data: PersonalDailyData[];
  date_range: {
    start: string;
    end: string;
    days: number;
  };
}

export interface ProjectSummary {
  project_id: string;
  project_name: string;
  total_sprints: number;
  completed_sprints: number;
  active_sprint: {
    id: string;
    name: string;
    days_remaining: number;
  } | null;
  average_velocity: number;
  total_cards: number;
  completed_cards: number;
  completion_rate: number;
  recent_time_spent: number;
}

// Time Analytics types
export interface TimeVsEstimateItem {
  card_id: string;
  card_title: string;
  priority: string | null;
  column_name: string | null;
  estimated_minutes: number;
  actual_minutes: number;
  variance_minutes: number | null;
  variance_percent: number | null;
  status: "over" | "under" | "on_track" | "no_estimate";
}

export interface TimeVsEstimateSummary {
  total_estimated_minutes: number;
  total_actual_minutes: number;
  total_variance_minutes: number;
  total_variance_percent: number | null;
  over_estimate_count: number;
  under_estimate_count: number;
  cards_tracked: number;
  cards_with_estimates: number;
}

export interface TimeVsEstimateResponse {
  comparison: TimeVsEstimateItem[];
  summary: TimeVsEstimateSummary;
}

export interface MemberVelocity {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  sprints: Array<{
    sprint_id: string;
    sprint_name: string;
    points: number;
    cards: number;
  }>;
  average_velocity: number;
  total_points: number;
  total_cards: number;
}

export interface IndividualVelocityResponse {
  members: MemberVelocity[];
  sprints_analyzed: number;
}

export interface InvisibleWorkUser {
  user_id: string;
  user_name: string;
  total_time: number;
  card_time: number;
  orphan_time: number;
  orphan_percent: number;
  blocker_days: number;
}

export interface InvisibleWorkInsight {
  type: "info" | "warning" | "critical";
  message: string;
}

export interface InvisibleWorkResponse {
  summary: {
    total_time_tracked: number;
    time_on_cards: number;
    orphan_time: number;
    orphan_percent: number;
    logs_with_blockers: number;
    blocker_time: number;
    total_logs: number;
  };
  by_user: InvisibleWorkUser[];
  insights: InvisibleWorkInsight[];
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
