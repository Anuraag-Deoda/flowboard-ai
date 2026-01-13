import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, null, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });

          const { access_token } = response.data;
          localStorage.setItem("access_token", access_token);

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post("/auth/login", { email, password });
    return response.data;
  },

  register: async (email: string, password: string, fullName?: string) => {
    const response = await api.post("/auth/register", {
      email,
      password,
      full_name: fullName,
    });
    return response.data;
  },

  logout: async () => {
    await api.post("/auth/logout");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  },

  me: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },
};

// Organizations API
export const organizationsApi = {
  list: async () => {
    const response = await api.get("/organizations/");
    return response.data;
  },

  create: async (name: string) => {
    const response = await api.post("/organizations/", { name });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/organizations/${id}`);
    return response.data;
  },
};

// Workspaces API
export const workspacesApi = {
  list: async (organizationId: string) => {
    const response = await api.get("/workspaces/", {
      params: { organization_id: organizationId },
    });
    return response.data;
  },

  create: async (organizationId: string, name: string) => {
    const response = await api.post("/workspaces/", {
      organization_id: organizationId,
      name,
    });
    return response.data;
  },
};

// Projects API
export const projectsApi = {
  list: async (workspaceId: string) => {
    const response = await api.get("/projects/", {
      params: { workspace_id: workspaceId },
    });
    return response.data;
  },

  create: async (workspaceId: string, name: string, description?: string) => {
    const response = await api.post("/projects/", {
      workspace_id: workspaceId,
      name,
      description,
    });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },
};

// Boards API
export const boardsApi = {
  list: async (projectId: string) => {
    const response = await api.get("/boards/", {
      params: { project_id: projectId },
    });
    return response.data;
  },

  create: async (projectId: string, name: string) => {
    const response = await api.post("/boards/", {
      project_id: projectId,
      name,
    });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/boards/${id}`);
    return response.data;
  },

  exportCsv: async (boardId: string) => {
    const response = await api.get(`/boards/${boardId}/export`, {
      params: { format: "csv" },
      responseType: "blob",
    });
    return response.data;
  },

  exportJson: async (boardId: string) => {
    const response = await api.get(`/boards/${boardId}/export`, {
      params: { format: "json" },
    });
    return response.data;
  },

  getExportSummary: async (boardId: string) => {
    const response = await api.get(`/boards/${boardId}/export/summary`);
    return response.data;
  },
};

// Cards API
export const cardsApi = {
  list: async (columnId?: string, boardId?: string) => {
    const response = await api.get("/cards/", {
      params: { column_id: columnId, board_id: boardId },
    });
    return response.data;
  },

  create: async (data: {
    column_id: string;
    title: string;
    description?: string;
    priority?: string;
    story_points?: number;
  }) => {
    const response = await api.post("/cards/", data);
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/cards/${id}`);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    title: string;
    description: string | null;
    priority: string | null;
    story_points: number | null;
    due_date: string | null;
  }>) => {
    const response = await api.put(`/cards/${id}`, data);
    return response.data;
  },

  move: async (id: string, columnId: string, position: number) => {
    const response = await api.put(`/cards/${id}/move`, {
      column_id: columnId,
      position,
    });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/cards/${id}`);
    return response.data;
  },

  addComment: async (id: string, content: string) => {
    const response = await api.post(`/cards/${id}/comments`, { content });
    return response.data;
  },
};

// Columns API
export const columnsApi = {
  create: async (boardId: string, name: string) => {
    const response = await api.post("/columns/", {
      board_id: boardId,
      name,
    });
    return response.data;
  },

  update: async (id: string, data: { name?: string; wip_limit?: number | null }) => {
    const response = await api.put(`/columns/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/columns/${id}`);
    return response.data;
  },

  reorder: async (columnIds: string[]) => {
    const response = await api.put("/columns/reorder", {
      column_ids: columnIds,
    });
    return response.data;
  },
};

// Organization Members API
export const membersApi = {
  list: async (organizationId: string) => {
    const response = await api.get(`/organizations/${organizationId}/members`);
    return response.data;
  },
};

// Card Assignees API
export const assigneesApi = {
  assign: async (cardId: string, userId: string) => {
    const response = await api.post(`/cards/${cardId}/assignees`, { user_id: userId });
    return response.data;
  },

  unassign: async (cardId: string, userId: string) => {
    const response = await api.delete(`/cards/${cardId}/assignees/${userId}`);
    return response.data;
  },
};

// Activity Logs API
export const activityApi = {
  getCardActivity: async (cardId: string) => {
    const response = await api.get(`/cards/${cardId}/activity`);
    return response.data;
  },
};

// Subtasks API
export const subtasksApi = {
  list: async (cardId: string) => {
    const response = await api.get(`/cards/${cardId}/subtasks`);
    return response.data;
  },

  create: async (cardId: string, title: string) => {
    const response = await api.post(`/cards/${cardId}/subtasks`, { title });
    return response.data;
  },

  update: async (cardId: string, subtaskId: string, data: { title?: string; is_completed?: boolean; position?: number }) => {
    const response = await api.put(`/cards/${cardId}/subtasks/${subtaskId}`, data);
    return response.data;
  },

  delete: async (cardId: string, subtaskId: string) => {
    const response = await api.delete(`/cards/${cardId}/subtasks/${subtaskId}`);
    return response.data;
  },
};

// Card Links API
export const cardLinksApi = {
  list: async (cardId: string) => {
    const response = await api.get(`/cards/${cardId}/links`);
    return response.data;
  },

  create: async (cardId: string, targetCardId: string, linkType: string) => {
    const response = await api.post(`/cards/${cardId}/links`, {
      target_card_id: targetCardId,
      link_type: linkType,
    });
    return response.data;
  },

  delete: async (cardId: string, linkId: string) => {
    const response = await api.delete(`/cards/${cardId}/links/${linkId}`);
    return response.data;
  },
};

// Attachments API
export const attachmentsApi = {
  list: async (cardId: string) => {
    const response = await api.get(`/cards/${cardId}/attachments`);
    return response.data;
  },

  upload: async (cardId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(`/cards/${cardId}/attachments`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  delete: async (cardId: string, attachmentId: string) => {
    const response = await api.delete(`/cards/${cardId}/attachments/${attachmentId}`);
    return response.data;
  },

  getDownloadUrl: (cardId: string, attachmentId: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    return `${baseUrl}/cards/${cardId}/attachments/${attachmentId}/download`;
  },
};

// Labels API
export const labelsApi = {
  list: async (boardId: string) => {
    const response = await api.get("/labels/", {
      params: { board_id: boardId },
    });
    return response.data;
  },

  create: async (boardId: string, name: string, color: string) => {
    const response = await api.post("/labels/", {
      board_id: boardId,
      name,
      color,
    });
    return response.data;
  },

  update: async (id: string, data: { name?: string; color?: string }) => {
    const response = await api.put(`/labels/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/labels/${id}`);
    return response.data;
  },

  addToCard: async (cardId: string, labelId: string) => {
    const response = await api.post(`/cards/${cardId}/labels`, { label_id: labelId });
    return response.data;
  },

  removeFromCard: async (cardId: string, labelId: string) => {
    const response = await api.delete(`/cards/${cardId}/labels/${labelId}`);
    return response.data;
  },
};

// Sprints API
export const sprintsApi = {
  list: async (projectId: string, status?: string) => {
    const response = await api.get("/sprints/", {
      params: { project_id: projectId, status },
    });
    return response.data;
  },

  create: async (data: {
    project_id: string;
    name: string;
    goal?: string;
    start_date: string;
    end_date: string;
  }) => {
    const response = await api.post("/sprints/", data);
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/sprints/${id}`);
    return response.data;
  },

  update: async (id: string, data: {
    name?: string;
    goal?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  }) => {
    const response = await api.put(`/sprints/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/sprints/${id}`);
    return response.data;
  },

  start: async (id: string) => {
    const response = await api.post(`/sprints/${id}/start`);
    return response.data;
  },

  complete: async (id: string) => {
    const response = await api.post(`/sprints/${id}/complete`);
    return response.data;
  },

  addCard: async (sprintId: string, cardId: string) => {
    const response = await api.post(`/sprints/${sprintId}/cards`, { card_id: cardId });
    return response.data;
  },

  removeCard: async (sprintId: string, cardId: string) => {
    const response = await api.delete(`/sprints/${sprintId}/cards/${cardId}`);
    return response.data;
  },

  getMetrics: async (id: string) => {
    const response = await api.get(`/sprints/${id}/metrics`);
    return response.data;
  },

  // Retrospective endpoints
  getRetrospective: async (sprintId: string) => {
    const response = await api.get(`/sprints/${sprintId}/retrospective`);
    return response.data;
  },

  createRetrospective: async (sprintId: string, data: {
    what_went_well?: string;
    what_went_wrong?: string;
    action_items?: Array<{ description: string; assignee_id?: string; status?: string }>;
    team_mood?: number;
  }) => {
    const response = await api.post(`/sprints/${sprintId}/retrospective`, data);
    return response.data;
  },

  updateRetrospective: async (sprintId: string, data: {
    what_went_well?: string;
    what_went_wrong?: string;
    action_items?: Array<{ description: string; assignee_id?: string; status?: string }>;
    team_mood?: number;
  }) => {
    const response = await api.put(`/sprints/${sprintId}/retrospective`, data);
    return response.data;
  },

  deleteRetrospective: async (sprintId: string) => {
    const response = await api.delete(`/sprints/${sprintId}/retrospective`);
    return response.data;
  },

  generateRetrospectiveSummary: async (sprintId: string) => {
    const response = await api.post(`/sprints/${sprintId}/retrospective/generate-summary`);
    return response.data;
  },

  // Sprint Notes endpoints
  listNotes: async (sprintId: string, noteType?: string) => {
    const response = await api.get(`/sprints/${sprintId}/notes`, {
      params: noteType ? { note_type: noteType } : undefined,
    });
    return response.data;
  },

  createNote: async (sprintId: string, data: {
    content: string;
    note_type?: "observation" | "risk" | "decision" | "blocker";
  }) => {
    const response = await api.post(`/sprints/${sprintId}/notes`, data);
    return response.data;
  },

  updateNote: async (sprintId: string, noteId: string, data: {
    content: string;
    note_type?: "observation" | "risk" | "decision" | "blocker";
  }) => {
    const response = await api.put(`/sprints/${sprintId}/notes/${noteId}`, data);
    return response.data;
  },

  deleteNote: async (sprintId: string, noteId: string) => {
    const response = await api.delete(`/sprints/${sprintId}/notes/${noteId}`);
    return response.data;
  },
};

// Daily Logs API
export const dailyLogsApi = {
  list: async (projectId: string, params?: {
    start_date?: string;
    end_date?: string;
    user_id?: string;
  }) => {
    const response = await api.get("/daily-logs/", {
      params: { project_id: projectId, ...params },
    });
    return response.data;
  },

  getToday: async (projectId: string) => {
    const response = await api.get("/daily-logs/today", {
      params: { project_id: projectId },
    });
    return response.data;
  },

  createOrUpdate: async (data: {
    project_id: string;
    log_date?: string;
    tasks_worked?: Array<{ card_id: string; time_spent: number; notes?: string }>;
    remaining_work?: string;
    blockers?: string;
    notes?: string;
  }) => {
    const response = await api.post("/daily-logs/", data);
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/daily-logs/${id}`);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/daily-logs/${id}`);
    return response.data;
  },

  getSuggestions: async (projectId: string) => {
    const response = await api.get("/daily-logs/suggestions", {
      params: { project_id: projectId },
    });
    return response.data;
  },

  getSummary: async (projectId: string, days?: number) => {
    const response = await api.get("/daily-logs/summary", {
      params: { project_id: projectId, days },
    });
    return response.data;
  },
};

// AI API
export const aiApi = {
  getStatus: async () => {
    const response = await api.get("/ai/status");
    return response.data;
  },

  getCardSuggestions: async (cardId: string) => {
    const response = await api.get(`/ai/card/${cardId}/suggestions`);
    return response.data;
  },

  groomBacklog: async (projectId: string) => {
    const response = await api.post("/ai/backlog/groom", { project_id: projectId });
    return response.data;
  },

  generateSprintGoal: async (cardIds: string[], projectContext?: string) => {
    const response = await api.post("/ai/sprint/goal", {
      card_ids: cardIds,
      project_context: projectContext,
    });
    return response.data;
  },

  generateDailySummary: async (tasksWorked: Array<{ title?: string; time_spent: number; notes?: string }>, blockers?: string) => {
    const response = await api.post("/ai/daily-log/summary", {
      tasks_worked: tasksWorked,
      blockers,
    });
    return response.data;
  },
};

// Analytics API
export const analyticsApi = {
  getVelocity: async (projectId: string, limit?: number) => {
    const response = await api.get("/analytics/velocity", {
      params: { project_id: projectId, limit },
    });
    return response.data;
  },

  getBurndown: async (sprintId: string) => {
    const response = await api.get(`/analytics/sprint/${sprintId}/burndown`);
    return response.data;
  },

  getWorkload: async (projectId: string, sprintId?: string) => {
    const response = await api.get("/analytics/workload", {
      params: { project_id: projectId, sprint_id: sprintId },
    });
    return response.data;
  },

  getPersonalProductivity: async (projectId: string, days?: number) => {
    const response = await api.get("/analytics/personal", {
      params: { project_id: projectId, days },
    });
    return response.data;
  },

  getProjectSummary: async (projectId: string) => {
    const response = await api.get("/analytics/summary", {
      params: { project_id: projectId },
    });
    return response.data;
  },

  getTimeVsEstimate: async (projectId: string, sprintId?: string) => {
    const response = await api.get("/analytics/time-vs-estimate", {
      params: { project_id: projectId, sprint_id: sprintId },
    });
    return response.data;
  },

  getIndividualVelocity: async (projectId: string, sprints?: number) => {
    const response = await api.get("/analytics/individual-velocity", {
      params: { project_id: projectId, sprints },
    });
    return response.data;
  },

  getInvisibleWork: async (projectId: string, days?: number) => {
    const response = await api.get("/analytics/invisible-work", {
      params: { project_id: projectId, days },
    });
    return response.data;
  },
};

// Import API
export const importApi = {
  upload: async (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_id", projectId);
    const response = await api.post("/import/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  getPreview: async (importId: string) => {
    const response = await api.get(`/import/${importId}/preview`);
    return response.data;
  },

  process: async (importId: string, config: {
    column_mapping?: Record<string, string | null>;
    use_ai?: boolean;
    use_smart_titles?: boolean;
  }) => {
    const response = await api.post(`/import/${importId}/process`, config);
    return response.data;
  },

  confirm: async (importId: string, data: {
    tasks: Array<{ title: string; description?: string | null; priority?: string | null; story_points?: number | null }>;
    board_id?: string;
    column_id?: string;
  }) => {
    const response = await api.post(`/import/${importId}/confirm`, data);
    return response.data;
  },

  cancel: async (importId: string) => {
    const response = await api.delete(`/import/${importId}`);
    return response.data;
  },

  // AI-powered analysis of import structure
  aiAnalyze: async (importId: string) => {
    const response = await api.post(`/import/${importId}/ai-analyze`);
    return response.data;
  },

  // Re-detect headers from a specific row
  redetectHeaders: async (importId: string, headerRow: number) => {
    const response = await api.post(`/import/${importId}/redetect-headers`, {
      header_row: headerRow,
    });
    return response.data;
  },
};

// Notifications API
export const notificationsApi = {
  list: async (params?: { unread_only?: boolean; limit?: number; offset?: number }) => {
    const response = await api.get("/notifications", { params });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get("/notifications/unread-count");
    return response.data;
  },

  markAsRead: async (notificationId: string) => {
    const response = await api.post(`/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.post("/notifications/read-all");
    return response.data;
  },

  delete: async (notificationId: string) => {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  clearAll: async () => {
    const response = await api.delete("/notifications/clear-all");
    return response.data;
  },
};

// Templates API
export const templatesApi = {
  list: async () => {
    const response = await api.get("/templates");
    return response.data;
  },

  get: async (templateId: string) => {
    const response = await api.get(`/templates/${templateId}`);
    return response.data;
  },

  apply: async (templateId: string, projectId: string, name?: string) => {
    const response = await api.post(`/templates/${templateId}/apply`, {
      project_id: projectId,
      name,
    });
    return response.data;
  },
};
