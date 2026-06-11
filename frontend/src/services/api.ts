import axios from 'axios';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Workflow,
  WorkflowDefinition,
  WorkflowRun,
  Webhook,
  Schedule,
  WorkflowStartResponse
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token + tenant ID header to every request
api.interceptors.request.use((config) => {
  // Read token from Zustand persisted storage
  const authRaw = localStorage.getItem('auth-storage');
  if (authRaw) {
    try {
      const auth = JSON.parse(authRaw);
      const token = auth?.state?.token;
      const user  = auth?.state?.user;

      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      if (user?.tenant_id) {
        config.headers['X-Tenant-ID'] = user.tenant_id;
      }
    } catch {
      // ignore malformed JSON
    }
  }

  // Fallback: legacy keys written by older code
  const legacyTenant = localStorage.getItem('tenant_id');
  if (legacyTenant && !config.headers['X-Tenant-ID']) {
    config.headers['X-Tenant-ID'] = legacyTenant;
  }

  return config;
});

// Response interceptor to handle Laravel Resource formats
api.interceptors.response.use(
  (response) => {
    // Handle Laravel Resource Collection format for list endpoints
    if (response.data && typeof response.data === 'object') {
      // Laravel Resources return { data: [], meta: {}, links: {} }
      if ('data' in response.data && ('meta' in response.data || 'links' in response.data)) {
        // Transform to frontend-expected pagination format
        const laravelData = response.data;
        return {
          ...response,
          data: {
            data: laravelData.data || [],
            current_page: laravelData.meta?.current_page || 1,
            per_page: laravelData.meta?.per_page || (laravelData.meta?.per_page ?? 15),
            total: laravelData.meta?.total || 0,
            last_page: laravelData.meta?.last_page || 1,
          },
        };
      }
      // Handle single Laravel Resource format { data: {} }
      else if ('data' in response.data && !('meta' in response.data)) {
        return {
          ...response,
          data: response.data.data,
        };
      }
    }
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/register', data);
    return response.data;
  },

  logout: async () => {
    await api.post('/logout');
  },

  me: async () => {
    const response = await api.get('/me');
    return response.data;
  },
};

// Workflow API
export const workflowApi = {
  list: async (params?: { page?: number; per_page?: number }) => {
    const response = await api.get('/workflows', { params });
    return response.data; // Now normalized by interceptor
  },

  get: async (id: string): Promise<Workflow> => {
    const response = await api.get(`/workflows/${id}`);
    return response.data; // Now normalized by interceptor
  },

  create: async (data: Partial<Workflow>): Promise<Workflow> => {
    const response = await api.post<Workflow>('/workflows', data);
    return response.data; // Now normalized by interceptor
  },

  update: async (id: string, data: Partial<Workflow>): Promise<Workflow> => {
    const response = await api.put<Workflow>(`/workflows/${id}`, data);
    return response.data; // Now normalized by interceptor
  },

  delete: async (id: string) => {
    await api.delete(`/workflows/${id}`);
  },

  archive: async (id: string) => {
    await api.post(`/workflows/${id}/archive`);
  },

  activate: async (id: string) => {
    await api.post(`/workflows/${id}/activate`);
  },

  duplicate: async (id: string): Promise<Workflow> => {
    const response = await api.post<Workflow>(`/workflows/${id}/duplicate`);
    return response.data;
  },

  run: async (id: string): Promise<WorkflowStartResponse> => {
    const response = await api.post<WorkflowStartResponse>(`/workflows/${id}/run`);
    return response.data;
  },

  versions: async (workflowId: string) => {
    const response = await api.get(`/workflows/${workflowId}/versions`);
    return response.data;
  },

  createVersion: async (workflowId: string, data: { definition: string }) => {
    const response = await api.post(`/workflows/${workflowId}/versions`, data);
    return response.data;
  },

  rollback: async (workflowId: string, versionId: string) => {
    await api.post(`/workflows/${workflowId}/versions/${versionId}/rollback`);
  },
};

// Workflow Runs API
export const runsApi = {
  list: async (params?: {
    status?: string;
    workflow_id?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
  }) => {
    const response = await api.get('/runs', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<{ data: WorkflowRun }>(`/runs/${id}`);
    return response.data.data || response.data;
  },

  cancel: async (id: string) => {
    await api.post(`/runs/${id}/cancel`);
  },
};

// Webhook API
export const webhookApi = {
  list: async () => {
    const response = await api.get('/webhooks');
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/webhooks/${id}`);
    return response.data as Webhook;
  },

  create: async (data: Partial<Webhook>) => {
    const response = await api.post<Webhook>('/webhooks', data);
    return response.data as Webhook;
  },

  update: async (id: string, data: Partial<Webhook>) => {
    const response = await api.put<Webhook>(`/webhooks/${id}`, data);
    return response.data as Webhook;
  },

  delete: async (id: string) => {
    await api.delete(`/webhooks/${id}`);
  },

  regenerateToken: async (id: string) => {
    const response = await api.post(`/webhooks/${id}/regenerate-token`);
    return response.data as Webhook;
  },

  getUrl: async (id: string) => {
    const response = await api.get(`/webhooks/${id}/url`);
    return response.data as { url: string; token: string };
  },
};

// Schedule API
export const scheduleApi = {
  list: async () => {
    const response = await api.get('/schedules');
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/schedules/${id}`);
    return response.data as Schedule;
  },

  create: async (data: Partial<Schedule>) => {
    const response = await api.post<Schedule>('/schedules', data);
    return response.data as Schedule;
  },

  update: async (id: string, data: Partial<Schedule>) => {
    const response = await api.put<Schedule>(`/schedules/${id}`, data);
    return response.data as Schedule;
  },

  delete: async (id: string) => {
    await api.delete(`/schedules/${id}`);
  },

  trigger: async (id: string) => {
    const response = await api.post(`/schedules/${id}/trigger`);
    return response.data as WorkflowRun;
  },

  toggle: async (id: string) => {
    const response = await api.post(`/schedules/${id}/toggle`);
    return response.data as Schedule;
  },
};

// User Management API (Admin only)
export const userApi = {
  list: async (params?: { search?: string; role?: string; page?: number; per_page?: number }) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: 'admin' | 'editor' | 'viewer';
  }) => {
    const response = await api.post('/users', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    name: string;
    email: string;
    role: 'admin' | 'editor' | 'viewer';
    is_active: boolean;
    password: string;
    password_confirmation: string;
  }>) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/users/${id}`);
  },

  assignRole: async (id: string, role: 'admin' | 'editor' | 'viewer') => {
    const response = await api.post(`/users/${id}/role`, { role });
    return response.data;
  },
};

export default api;
