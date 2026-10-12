import { apiClient } from './client';
import type {
  AuthResponse,
  Envelope,
  Incident,
  IncidentDetail,
  IncidentStatus,
  MetricSeries,
  RcaAnalysis,
  Server,
  Container,
  SystemHealth,
  User,
  Alert,
  AlertStatus,
} from '../types';

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    return response.data;
  },
  register: async (email: string, password: string, fullName?: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/register', {
      email,
      password,
      full_name: fullName,
    });
    return response.data;
  },
  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/verify-email', { token });
    return response.data;
  },
  resendVerification: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/resend-verification', { email });
    return response.data;
  },
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
    return response.data;
  },
  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/reset-password', {
      token,
      new_password: newPassword,
    });
    return response.data;
  },
  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },
};

export const systemApi = {
  getHealth: async (): Promise<SystemHealth> => {
    const response = await apiClient.get<SystemHealth>('/system/health');
    return response.data;
  },
};

export const metricsApi = {
  queryRange: async (metric: string, minutes: number = 15): Promise<MetricSeries> => {
    const response = await apiClient.get<MetricSeries>('/metrics/query-range', {
      params: { metric, minutes },
    });
    return response.data;
  },
};

export const incidentsApi = {
  list: async (params?: {
    status?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }): Promise<Envelope<Incident>> => {
    const response = await apiClient.get<Envelope<Incident>>('/incidents', { params });
    return response.data;
  },
  getById: async (id: number): Promise<IncidentDetail> => {
    const response = await apiClient.get<IncidentDetail>(`/incidents/${id}`);
    return response.data;
  },
  updateStatus: async (id: number, status: IncidentStatus): Promise<Incident> => {
    const response = await apiClient.patch<Incident>(`/incidents/${id}/status`, { status });
    return response.data;
  },
  analyzeWithAi: async (id: number): Promise<RcaAnalysis> => {
    const response = await apiClient.post<RcaAnalysis>(`/ai/incidents/${id}/analyze`);
    // Enrich with client-side timestamp for display
    return { ...response.data, analyzedAt: new Date().toISOString() };
  },
};

export const alertsApi = {
  list: async (params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Envelope<Alert>> => {
    const response = await apiClient.get<Envelope<Alert>>('/alerts', { params });
    return response.data;
  },
  updateStatus: async (id: number, status: AlertStatus): Promise<Alert> => {
    const response = await apiClient.patch<Alert>(`/alerts/${id}/status`, { status });
    return response.data;
  },
};

export interface ServerRegistrationPayload {
  hostname: string;
  ipAddress: string;
  osInfo?: string;
  environment?: string;
  capabilities?: string[];
}

export interface ServerRegistrationResult {
  server: Server;
  enrollmentToken: string;
  installCommand: string;
  instructions: string;
}

export interface ServerHealthResult {
  serverId: number;
  overallStatus: 'connected' | 'partially_reporting' | 'unreachable';
  pipelines: {
    metrics: string;
    logs: string;
    events: string;
  };
  lastChecked: string;
}

export const serversApi = {
  listServers: async (): Promise<Server[]> => {
    const response = await apiClient.get<Server[]>('/servers');
    return response.data;
  },
  getServer: async (serverId: number): Promise<Server> => {
    const response = await apiClient.get<Server>(`/servers/${serverId}`);
    return response.data;
  },
  getServerHealth: async (serverId: number): Promise<ServerHealthResult> => {
    const response = await apiClient.get<ServerHealthResult>(`/servers/${serverId}/health`);
    return response.data;
  },
  registerServer: async (payload: ServerRegistrationPayload): Promise<ServerRegistrationResult> => {
    const response = await apiClient.post<ServerRegistrationResult>('/servers', payload);
    return response.data;
  },
  listContainers: async (): Promise<Container[]> => {
    const response = await apiClient.get<Container[]>('/containers');
    return response.data;
  },
};

// ─── Settings API ─────────────────────────────────────────────────────────────

export interface UserDetail {
  id: number;
  email: string;
  fullName?: string | null;
  isAdmin: boolean;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export interface SystemConfigEntry {
  key: string;
  value: string;
  updatedAt?: string | null;
}

export const settingsApi = {
  // Profile
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<User>('/settings/profile');
    return response.data;
  },
  updateProfile: async (fullName: string): Promise<User> => {
    const response = await apiClient.patch<User>('/settings/profile', { full_name: fullName });
    return response.data;
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await apiClient.patch<{ message: string }>('/settings/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  // System config (admin)
  getSystemConfig: async (): Promise<SystemConfigEntry[]> => {
    const response = await apiClient.get<SystemConfigEntry[]>('/settings/system-config');
    return response.data;
  },
  updateSystemConfig: async (key: string, value: string): Promise<SystemConfigEntry> => {
    const response = await apiClient.patch<SystemConfigEntry>('/settings/system-config', { key, value });
    return response.data;
  },

  // Users (admin)
  listUsers: async (): Promise<UserDetail[]> => {
    const response = await apiClient.get<UserDetail[]>('/settings/users');
    return response.data;
  },
  updateUserRole: async (userId: number, isAdmin: boolean): Promise<UserDetail> => {
    const response = await apiClient.patch<UserDetail>(`/settings/users/${userId}/role`, { is_admin: isAdmin });
    return response.data;
  },
  updateUserActive: async (userId: number, isActive: boolean): Promise<UserDetail> => {
    const response = await apiClient.patch<UserDetail>(`/settings/users/${userId}/active`, { is_active: isActive });
    return response.data;
  },
};

// ─── Logs API ────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  container?: string | null;
  message: string;
}

export const logsApi = {
  listLogs: async (params?: {
    q?: string;
    level?: string;
    service?: string;
    minutes?: number;
    limit?: number;
  }): Promise<LogEntry[]> => {
    const response = await apiClient.get<LogEntry[]>('/logs', { params });
    return response.data;
  },
  checkHealth: async (): Promise<{ status: string; healthy: boolean }> => {
    const response = await apiClient.get<{ status: string; healthy: boolean }>('/logs/health');
    return response.data;
  },
};

// ─── Events API ──────────────────────────────────────────────────────────────

export interface EventEntry {
  id: string;
  timestamp: string;
  eventType: string;
  service: string;
  containerName?: string | null;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  metadata?: any;
}

export const eventsApi = {
  listEvents: async (params?: {
    type?: string;
    severity?: string;
    service?: string;
    q?: string;
    limit?: number;
  }): Promise<EventEntry[]> => {
    const response = await apiClient.get<EventEntry[]>('/events', { params });
    return response.data;
  },
};



