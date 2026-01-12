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
    description: string;
    priority: string;
    story_points: number;
    due_date: string;
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
