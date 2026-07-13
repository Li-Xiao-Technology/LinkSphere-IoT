import { Device, DeviceState, Scene, SceneTemplate, Schedule, Room, AppNotification, AutomationRule, EnergySummary, EnergyLog, UsageFrequencyPrediction, EnergyTrendPrediction, StateChangePattern, AnomalyWarning, PredictionReport, User } from '../types';
import { useAuthStore } from '../store/authStore';

const API_BASE = '/api';

function getAuthHeaders(formData?: boolean): HeadersInit {
  const token = useAuthStore.getState().token;
  if (formData) {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function refreshAndRetry(originalRequest: () => Promise<Response>): Promise<Response | null> {
  const refreshed = await useAuthStore.getState().refreshAccessToken();
  if (refreshed) {
    return originalRequest();
  }
  return null;
}

async function handleResponse<T>(response: Response, retryFn?: () => Promise<Response>): Promise<T | null> {
  // 处理401认证失败
  if (response.status === 401) {
    // 如果有重试函数，尝试刷新token后重试
    if (retryFn) {
      const retried = await refreshAndRetry(retryFn);
      if (retried) {
        try {
          const data = await retried.json();
          return data as T;
        } catch {
          console.error('[API] Failed to parse retried response JSON');
          return null;
        }
      }
    }
    // 刷新失败或无重试函数，执行logout
    useAuthStore.getState().logout();
    return null;
  }

  // 处理其他非成功响应
  if (!response.ok) {
    console.error(`[API] Request failed with status ${response.status}: ${response.statusText}`);
    return null;
  }

  // 解析JSON响应
  try {
    return await response.json();
  } catch (error) {
    console.error('[API] Failed to parse response JSON:', error);
    return null;
  }
}

export async function getDevices(): Promise<Device[]> {
  const fetchFn = () => fetch(`${API_BASE}/devices`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<Device[]>(response, fetchFn);
  return data || [];
}

export async function getDeviceById(id: string): Promise<Device | null> {
  const fetchFn = () => fetch(`${API_BASE}/devices/${id}`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<Device>(response, fetchFn);
}

export async function getDeviceState(id: string): Promise<DeviceState | null> {
  const fetchFn = () => fetch(`${API_BASE}/devices/${id}/state`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<DeviceState>(response, fetchFn);
}

export async function setDeviceState(id: string, state: Partial<DeviceState>): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/devices/${id}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(state),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function discoverDevices(): Promise<Device[]> {
  const fetchFn = () =>
    fetch(`${API_BASE}/devices/discover`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<Device[]>(response, fetchFn);
  return data || [];
}

export async function deleteDevice(id: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/devices/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function renameDevice(id: string, name: string): Promise<{ success: boolean; device?: Device }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/devices/${id}/name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name }),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean; device?: Device }>(response, fetchFn);
  return data || { success: false };
}

export async function pairYeelightBLE(id: string): Promise<{ success: boolean; message?: string }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/yeelight-ble/devices/${id}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean; message?: string }>(response, fetchFn);
  return data || { success: false };
}

export async function updateFirmware(id: string, version: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/devices/${id}/firmware/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ version }),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function getScenes(): Promise<Scene[]> {
  const fetchFn = () => fetch(`${API_BASE}/scenes`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<Scene[]>(response, fetchFn);
  return data || [];
}

export async function createScene(scene: Omit<Scene, 'id' | 'createdAt' | 'updatedAt'>): Promise<Scene | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(scene),
    });
  const response = await fetchFn();
  return handleResponse<Scene>(response, fetchFn);
}

export async function activateScene(id: string): Promise<{ success: boolean; results: { deviceId: string; success: boolean }[] }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/scenes/${id}/activate`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean; results: { deviceId: string; success: boolean }[] }>(response, fetchFn);
  return data || { success: false, results: [] };
}

export async function getSceneTemplates(): Promise<SceneTemplate[]> {
  const fetchFn = () => fetch(`${API_BASE}/scenes/templates`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<SceneTemplate[]>(response, fetchFn);
  return data || [];
}

export async function createSceneFromTemplate(templateId: string, customizations?: { name?: string; description?: string; deviceMappings?: Record<string, string> }): Promise<Scene | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/scenes/from-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ templateId, customizations }),
    });
  const response = await fetchFn();
  return handleResponse<Scene>(response, fetchFn);
}

export async function getSchedules(deviceId?: string): Promise<Schedule[]> {
  const url = new URL(`${API_BASE}/schedules`, window.location.origin);
  if (deviceId) url.searchParams.set('deviceId', deviceId);
  const fetchFn = () => fetch(url.pathname + url.search, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<Schedule[]>(response, fetchFn);
  return data || [];
}

export async function createSchedule(schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Schedule | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(schedule),
    });
  const response = await fetchFn();
  return handleResponse<Schedule>(response, fetchFn);
}

export async function toggleSchedule(id: string): Promise<{ success: boolean; enabled: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/schedules/${id}/toggle`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean; enabled: boolean }>(response, fetchFn);
  return data || { success: false, enabled: false };
}

export async function deleteSchedule(id: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/schedules/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function getRooms(): Promise<Room[]> {
  const fetchFn = () => fetch(`${API_BASE}/rooms`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<Room[]>(response, fetchFn);
  return data || [];
}

export async function createRoom(room: Omit<Room, 'id' | 'createdAt'>): Promise<Room | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(room),
    });
  const response = await fetchFn();
  return handleResponse<Room>(response, fetchFn);
}

export async function updateRoom(id: string, room: Partial<Omit<Room, 'id' | 'createdAt'>>): Promise<Room | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/rooms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(room),
    });
  const response = await fetchFn();
  return handleResponse<Room>(response, fetchFn);
}

export async function deleteRoom(id: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/rooms/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function assignDevicesToRoom(roomId: string, deviceIds: string[]): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/rooms/${roomId}/devices`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ deviceIds }),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function getRoomDevices(roomId: string): Promise<Device[]> {
  const fetchFn = () => fetch(`${API_BASE}/rooms/${roomId}/devices`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<Device[]>(response, fetchFn);
  return data || [];
}

export async function getNotifications(): Promise<AppNotification[]> {
  const fetchFn = () => fetch(`${API_BASE}/notifications`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<AppNotification[]>(response, fetchFn);
  return data || [];
}

export async function getUnreadNotifications(): Promise<AppNotification[]> {
  const fetchFn = () => fetch(`${API_BASE}/notifications/unread`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<AppNotification[]>(response, fetchFn);
  return data || [];
}

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/notifications/read-all`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function deleteNotification(id: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/notifications/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function getRules(): Promise<AutomationRule[]> {
  const fetchFn = () => fetch(`${API_BASE}/rules`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<AutomationRule[]>(response, fetchFn);
  return data || [];
}

export async function createRule(rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AutomationRule | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(rule),
    });
  const response = await fetchFn();
  return handleResponse<AutomationRule>(response, fetchFn);
}

export async function updateRule(id: string, rule: Partial<Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AutomationRule | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(rule),
    });
  const response = await fetchFn();
  return handleResponse<AutomationRule>(response, fetchFn);
}

export async function deleteRule(id: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/rules/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function toggleRule(id: string): Promise<{ success: boolean; enabled: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/rules/${id}/toggle`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean; enabled: boolean }>(response, fetchFn);
  return data || { success: false, enabled: false };
}

export async function testRule(id: string): Promise<{ success: boolean; results: { deviceId: string; success: boolean }[] }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/rules/${id}/test`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean; results: { deviceId: string; success: boolean }[] }>(response, fetchFn);
  return data || { success: false, results: [] };
}

export async function getEnergySummary(range?: 'today' | 'week' | 'month'): Promise<EnergySummary[]> {
  const url = new URL(`${API_BASE}/energy/summary`, window.location.origin);
  if (range) url.searchParams.set('range', range);
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<EnergySummary[]>(response, fetchFn);
  return data || [];
}

export async function getTotalEnergy(range?: 'today' | 'week' | 'month'): Promise<{ totalEnergy: number; totalPower: number; avgPower: number; deviceCount: number }> {
  const url = new URL(`${API_BASE}/energy/total`, window.location.origin);
  if (range) url.searchParams.set('range', range);
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<{ totalEnergy: number; totalPower: number; avgPower: number; deviceCount: number }>(response, fetchFn);
  return data || { totalEnergy: 0, totalPower: 0, avgPower: 0, deviceCount: 0 };
}

export async function getDeviceEnergy(deviceId: string, range?: 'today' | 'week' | 'month'): Promise<EnergyLog[]> {
  const url = new URL(`${API_BASE}/energy/devices/${deviceId}`, window.location.origin);
  if (range) url.searchParams.set('range', range);
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<EnergyLog[]>(response, fetchFn);
  return data || [];
}

export function exportEnergyCSV(range?: 'today' | 'week' | 'month'): void {
  const token = useAuthStore.getState().token;
  const url = new URL(`${API_BASE}/energy/export/csv`, window.location.origin);
  if (range) url.searchParams.set('range', range);

  const link = document.createElement('a');
  link.href = url.toString();
  link.style.display = 'none';
  if (token) {
    fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `能耗报告_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      });
    return;
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportDeviceEnergyCSV(deviceId: string, range?: 'today' | 'week' | 'month'): void {
  const token = useAuthStore.getState().token;
  const url = new URL(`${API_BASE}/energy/devices/${deviceId}/export/csv`, window.location.origin);
  if (range) url.searchParams.set('range', range);

  if (token) {
    fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `设备能耗_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      });
  }
}

export async function getEnergyTrend(range: 'today' | 'week' | 'month'): Promise<{ time: string; power: number; energy: number }[]> {
  const url = new URL(`${API_BASE}/energy/trend`, window.location.origin);
  url.searchParams.set('range', range);
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<{ time: string; power: number; energy: number }[]>(response, fetchFn);
  return data || [];
}

export async function getEnergyDistribution(range: 'today' | 'week' | 'month'): Promise<{ deviceId: string; deviceName: string; energy: number; percentage: number }[]> {
  const url = new URL(`${API_BASE}/energy/distribution`, window.location.origin);
  url.searchParams.set('range', range);
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<{ deviceId: string; deviceName: string; energy: number; percentage: number }[]>(response, fetchFn);
  return data || [];
}

export async function getEnergyBarChart(type: 'daily' | 'weekly' | 'monthly'): Promise<{ label: string; energy: number; date: string }[]> {
  const url = new URL(`${API_BASE}/energy/bar-chart`, window.location.origin);
  url.searchParams.set('type', type);
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<{ label: string; energy: number; date: string }[]>(response, fetchFn);
  return data || [];
}

export async function getEnergyComparison(): Promise<{
  current: { energy: number; period: string };
  lastPeriod: { energy: number; period: string };
  lastYear: { energy: number; period: string };
  periodChange: number;
  yearChange: number;
}> {
  const url = new URL(`${API_BASE}/energy/comparison`, window.location.origin);
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<{
    current: { energy: number; period: string };
    lastPeriod: { energy: number; period: string };
    lastYear: { energy: number; period: string };
    periodChange: number;
    yearChange: number;
  }>(response, fetchFn);
  return data || {
    current: { energy: 0, period: '' },
    lastPeriod: { energy: 0, period: '' },
    lastYear: { energy: 0, period: '' },
    periodChange: 0,
    yearChange: 0
  };
}

export async function getEnergyAnomalies(): Promise<{
  deviceId: string;
  deviceName: string;
  type: 'high' | 'low' | 'spike';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}[]> {
  const url = new URL(`${API_BASE}/energy/anomalies`, window.location.origin);
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<{
    deviceId: string;
    deviceName: string;
    type: 'high' | 'low' | 'spike';
    message: string;
    value: number;
    threshold: number;
    timestamp: string;
  }[]>(response, fetchFn);
  return data || [];
}

export async function getMe(): Promise<{ id: string; username: string; email?: string; role: string; createdAt: string; households: { id: string; name: string; role: string }[] } | null> {
  const fetchFn = () => fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse(response, fetchFn);
}

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  role: string;
  createdAt: string;
  households: { id: string; name: string; role: string }[];
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const fetchFn = () => fetch(`${API_BASE}/user/profile`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<UserProfile>(response, fetchFn);
}

export async function uploadAvatar(file: File): Promise<{ success: boolean; message: string; data?: { avatarUrl: string } }> {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch(`${API_BASE}/avatar`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || '上传失败');
  }

  return response.json();
}

export async function getAvatarUrl(): Promise<{ avatarUrl: string | null }> {
  const response = await fetch(`${API_BASE}/avatar`, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('获取头像失败');
  }
  return response.json();
}

export async function deleteAvatar(): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/avatar`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('删除头像失败');
  }
  return response.json();
}

export async function updateUserProfile(data: { email?: string; username?: string }): Promise<UserProfile> {
  const fetchFn = () =>
    fetch(`${API_BASE}/user/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();

  if (response.status === 401) {
    const retried = await refreshAndRetry(fetchFn);
    if (retried) {
      try {
        const data = await retried.json();
        return data as UserProfile;
      } catch {
        throw new Error('解析响应失败');
      }
    }
    useAuthStore.getState().logout();
    throw new Error('认证失败，请重新登录');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.message || `更新失败 (${response.status})`);
  }

  return response.json();
}

export async function updatePassword(data: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string } | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/user/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();
  return handleResponse<{ success: boolean; message: string }>(response, fetchFn);
}

export interface NotificationPreferences {
  userId: string;
  deviceOffline: boolean;
  deviceOnline: boolean;
  warning: boolean;
  info: boolean;
  ruleTriggered: boolean;
  firmwareUpdate: boolean;
  scheduleExecuted: boolean;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const fetchFn = () => fetch(`${API_BASE}/user/notifications/preferences`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<NotificationPreferences>(response, fetchFn);
}

export async function updateNotificationPreferences(data: Partial<NotificationPreferences>): Promise<NotificationPreferences | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/user/notifications/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();
  return handleResponse<NotificationPreferences>(response, fetchFn);
}

export interface DeviceStateHistoryItem {
  id: string;
  deviceId: string;
  status: string;
  state: DeviceState | null;
  changedAt: string;
}

export async function getDeviceStateHistory(deviceId: string, params?: { startDate?: string; endDate?: string; limit?: number }): Promise<DeviceStateHistoryItem[]> {
  const url = new URL(`${API_BASE}/devices/${deviceId}/history`, window.location.origin);
  if (params?.startDate) url.searchParams.set('startDate', params.startDate);
  if (params?.endDate) url.searchParams.set('endDate', params.endDate);
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<DeviceStateHistoryItem[]>(response, fetchFn);
  return data || [];
}

export interface RuleExecutionHistoryItem {
  id: string;
  ruleId: string;
  status: string;
  message: string | null;
  executedAt: string;
  rule?: { id: string; name: string };
}

export async function getRuleExecutionHistory(params?: { ruleId?: string; startDate?: string; endDate?: string; limit?: number }): Promise<RuleExecutionHistoryItem[]> {
  const url = new URL(`${API_BASE}/rules/history`, window.location.origin);
  if (params?.ruleId) url.searchParams.set('ruleId', params.ruleId);
  if (params?.startDate) url.searchParams.set('startDate', params.startDate);
  if (params?.endDate) url.searchParams.set('endDate', params.endDate);
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<RuleExecutionHistoryItem[]>(response, fetchFn);
  return data || [];
}

export async function getRuleHistory(ruleId: string, params?: { startDate?: string; endDate?: string; limit?: number }): Promise<RuleExecutionHistoryItem[]> {
  const url = new URL(`${API_BASE}/rules/${ruleId}/history`, window.location.origin);
  if (params?.startDate) url.searchParams.set('startDate', params.startDate);
  if (params?.endDate) url.searchParams.set('endDate', params.endDate);
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<RuleExecutionHistoryItem[]>(response, fetchFn);
  return data || [];
}

export interface SearchResult {
  type: 'device' | 'scene' | 'rule' | 'room';
  id: string;
  name: string;
  description?: string;
  status?: string;
  icon?: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const url = new URL(`${API_BASE}/search`, window.location.origin);
  url.searchParams.set('q', query);
  const fetchFn = () => fetch(url.pathname + url.search, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<SearchResult[]>(response, fetchFn);
  return data || [];
}

// 预测分析 API
export async function getUsageFrequencyPredictions(days?: number): Promise<UsageFrequencyPrediction[]> {
  const url = new URL(`${API_BASE}/predictions/usage-frequency`, window.location.origin);
  if (days) url.searchParams.set('days', String(days));
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<UsageFrequencyPrediction[]>(response, fetchFn);
  return data || [];
}

export async function getEnergyTrendPredictions(days?: number): Promise<EnergyTrendPrediction[]> {
  const url = new URL(`${API_BASE}/predictions/energy-trend`, window.location.origin);
  if (days) url.searchParams.set('days', String(days));
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<EnergyTrendPrediction[]>(response, fetchFn);
  return data || [];
}

export async function getStatePatterns(days?: number): Promise<StateChangePattern[]> {
  const url = new URL(`${API_BASE}/predictions/state-patterns`, window.location.origin);
  if (days) url.searchParams.set('days', String(days));
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<StateChangePattern[]>(response, fetchFn);
  return data || [];
}

export async function getAnomalyWarnings(): Promise<AnomalyWarning[]> {
  const fetchFn = () => fetch(`${API_BASE}/predictions/anomalies`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<AnomalyWarning[]>(response, fetchFn);
  return data || [];
}

export async function getPredictionReport(days?: number): Promise<PredictionReport | null> {
  const url = new URL(`${API_BASE}/predictions/report`, window.location.origin);
  if (days) url.searchParams.set('days', String(days));
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<PredictionReport>(response, fetchFn);
}

export async function getDeviceShares(): Promise<{ id: string; deviceId: string; ownerId: string; sharedWithId: string; permission: string; device?: Device; sharedWith?: User }[]> {
  const fetchFn = () => fetch(`${API_BASE}/device-shares`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<{ id: string; deviceId: string; ownerId: string; sharedWithId: string; permission: string; device?: Device; sharedWith?: User }[]>(response, fetchFn);
  return data || [];
}

export async function getDeviceSharesForDevice(deviceId: string): Promise<{ id: string; deviceId: string; ownerId: string; sharedWithId: string; permission: string; sharedWith?: User }[]> {
  const fetchFn = () => fetch(`${API_BASE}/device-shares/device/${deviceId}`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<{ id: string; deviceId: string; ownerId: string; sharedWithId: string; permission: string; sharedWith?: User }[]>(response, fetchFn);
  return data || [];
}

export async function createDeviceShare(data: { deviceId: string; sharedWithId: string; permission: 'read' | 'control' }): Promise<{ id: string; deviceId: string; permission: string; device?: Device; sharedWith?: User } | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/device-shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();
  return handleResponse(response, fetchFn);
}

export async function updateDeviceShare(id: string, permission: 'read' | 'control'): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/device-shares/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ permission }),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function deleteDeviceShare(id: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/device-shares/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export async function getChatHistory(): Promise<{ messages: ChatMessage[] } | null> {
  const fetchFn = () => fetch(`${API_BASE}/chat/history`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<{ messages: ChatMessage[] }>(response, fetchFn);
}

export async function sendChatMessage(message: string): Promise<{ messages: ChatMessage[] } | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ message }),
    });
  const response = await fetchFn();
  return handleResponse<{ messages: ChatMessage[] }>(response, fetchFn);
}

export async function clearChatHistory(): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/chat/clear`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

// ========== Modbus TCP API ==========

export interface ModbusNetworkInfo {
  networks: Array<{ interface: string; ip: string; netmask: string; baseIp: string }>;
  defaultBaseIp: string;
}

export interface ModbusScanResult {
  devices: Array<{ host: string; port: number; slaveId: number }>;
  baseIp?: string;
}

export interface ModbusRegisterMapping {
  property: string;
  type: 'coil' | 'discrete' | 'holding' | 'input';
  address: number;
  quantity: number;
  dataType: 'bool' | 'int16' | 'uint16' | 'float32' | 'string';
  writable: boolean;
  scale?: number;
  unit?: string;
}

export async function addModbusDevice(data: { name?: string; host: string; port?: number; slaveId?: number; model?: string; registerMap?: ModbusRegisterMapping[] }): Promise<Device | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/modbus/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();
  return handleResponse<Device>(response, fetchFn);
}

export async function getModbusNetworkInfo(): Promise<ModbusNetworkInfo | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/modbus/network-info`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<ModbusNetworkInfo>(response, fetchFn);
}

export async function scanModbusNetwork(baseIp?: string, port?: number, slaveId?: number): Promise<ModbusScanResult | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/modbus/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ baseIp, port, slaveId }),
    });
  const response = await fetchFn();
  return handleResponse<ModbusScanResult>(response, fetchFn);
}

export async function testModbusConnection(host: string, port?: number, slaveId?: number): Promise<{ connected: boolean; host: string; port: number; slaveId: number } | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/modbus/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ host, port, slaveId }),
    });
  const response = await fetchFn();
  return handleResponse<{ connected: boolean; host: string; port: number; slaveId: number }>(response, fetchFn);
}

export async function getModbusRegisters(deviceId: string): Promise<{ registers: ModbusRegisterMapping[] } | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/modbus/devices/${deviceId}/registers`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<{ registers: ModbusRegisterMapping[] }>(response, fetchFn);
}

export async function updateModbusRegisters(deviceId: string, registerMap: ModbusRegisterMapping[]): Promise<{ success: boolean } | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/modbus/devices/${deviceId}/registers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ registerMap }),
    });
  const response = await fetchFn();
  return handleResponse<{ success: boolean }>(response, fetchFn);
}

export async function getS7SmartTemplate(): Promise<{ name: string; model: string; defaultPort: number; defaultSlaveId: number; registerMap: ModbusRegisterMapping[] } | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/modbus/templates/s7-200-smart`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<{ name: string; model: string; defaultPort: number; defaultSlaveId: number; registerMap: ModbusRegisterMapping[] }>(response, fetchFn);
}

export async function readModbusRawRegister(deviceId: string, type: string, address: number, quantity?: number): Promise<{ deviceId: string; type: string; address: number; quantity: number; value: unknown } | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/modbus/devices/${deviceId}/read-raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ type, address, quantity }),
    });
  const response = await fetchFn();
  return handleResponse<{ deviceId: string; type: string; address: number; quantity: number; value: unknown }>(response, fetchFn);
}

export async function writeModbusRawRegister(deviceId: string, type: string, address: number, value: unknown): Promise<{ deviceId: string; type: string; address: number; value: unknown; success: boolean } | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/modbus/devices/${deviceId}/write-raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ type, address, value }),
    });
  const response = await fetchFn();
  return handleResponse<{ deviceId: string; type: string; address: number; value: unknown; success: boolean }>(response, fetchFn);
}

// ========== Audit Log API ==========

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ip?: string;
  userAgent?: string;
  status: string;
  createdAt: string;
}

export interface AuditLogListResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getAuditLogs(params?: {
  page?: number;
  pageSize?: number;
  userId?: string;
  resource?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AuditLogListResponse> {
  const url = new URL(`${API_BASE}/audit-logs`, window.location.origin);
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  if (params?.userId) url.searchParams.set('userId', params.userId);
  if (params?.resource) url.searchParams.set('resource', params.resource);
  if (params?.action) url.searchParams.set('action', params.action);
  if (params?.startDate) url.searchParams.set('startDate', params.startDate);
  if (params?.endDate) url.searchParams.set('endDate', params.endDate);
  const fetchFn = () => fetch(url.pathname + url.search, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<AuditLogListResponse>(response, fetchFn);
  return data || { data: [], total: 0, page: 1, pageSize: 20 };
}

export async function exportAuditLogsCSV(params?: {
  userId?: string;
  resource?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}): Promise<void> {
  const url = new URL(`${API_BASE}/audit-logs/export`, window.location.origin);
  if (params?.userId) url.searchParams.set('userId', params.userId);
  if (params?.resource) url.searchParams.set('resource', params.resource);
  if (params?.action) url.searchParams.set('action', params.action);
  if (params?.startDate) url.searchParams.set('startDate', params.startDate);
  if (params?.endDate) url.searchParams.set('endDate', params.endDate);
  const token = useAuthStore.getState().token;
  const res = await fetch(url.pathname + url.search, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`导出失败 (${res.status})`);
  }
  const blob = await res.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `审计日志_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

// ========== Webhook API ==========

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: string;
  headers?: string | null;
  events: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: string;
  statusCode?: number | null;
  response?: string | null;
  success: boolean;
  deliveredAt: string;
}

export interface WebhookDeliveryListResponse {
  data: WebhookDelivery[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getWebhooks(): Promise<WebhookConfig[]> {
  const fetchFn = () => fetch(`${API_BASE}/webhooks`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<WebhookConfig[]>(response, fetchFn);
  return data || [];
}

export async function createWebhook(data: {
  name: string;
  url: string;
  method?: string;
  headers?: Record<string, string> | null;
  events?: string[];
}): Promise<WebhookConfig | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();
  return handleResponse<WebhookConfig>(response, fetchFn);
}

export async function updateWebhook(id: string, data: {
  name?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string> | null;
  events?: string[];
  enabled?: boolean;
}): Promise<WebhookConfig | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/webhooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();
  return handleResponse<WebhookConfig>(response, fetchFn);
}

export async function deleteWebhook(id: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/webhooks/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function testWebhook(id: string): Promise<{ success: boolean; statusCode?: number | null; durationMs?: number; deliveryId?: string } | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/webhooks/${id}/test`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  return handleResponse<{ success: boolean; statusCode?: number | null; durationMs?: number; deliveryId?: string }>(response, fetchFn);
}

export async function getWebhookDeliveries(id: string, params?: { page?: number; pageSize?: number }): Promise<WebhookDeliveryListResponse> {
  const url = new URL(`${API_BASE}/webhooks/${id}/deliveries`, window.location.origin);
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  const fetchFn = () => fetch(url.pathname + url.search, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<WebhookDeliveryListResponse>(response, fetchFn);
  return data || { data: [], total: 0, page: 1, pageSize: 20 };
}

// ========== Device Tag API ==========

export interface DeviceTag {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
  _count?: { devices: number };
}

export async function getDeviceTags(): Promise<DeviceTag[]> {
  const fetchFn = () => fetch(`${API_BASE}/device-tags`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<DeviceTag[]>(response, fetchFn);
  return data || [];
}

export async function createDeviceTag(data: { name: string; color?: string }): Promise<DeviceTag | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/device-tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();
  return handleResponse<DeviceTag>(response, fetchFn);
}

export async function updateDeviceTag(id: string, data: { name?: string; color?: string }): Promise<DeviceTag | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/device-tags/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();
  return handleResponse<DeviceTag>(response, fetchFn);
}

export async function deleteDeviceTag(id: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/device-tags/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function getDeviceTagsByDevice(deviceId: string): Promise<DeviceTag[]> {
  const fetchFn = () => fetch(`${API_BASE}/device-tags/devices/${deviceId}`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<DeviceTag[]>(response, fetchFn);
  return data || [];
}

export async function assignDeviceTags(deviceId: string, tagIds: string[]): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/device-tags/devices/${deviceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ tagIds }),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function removeDeviceTag(deviceId: string, tagId: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/device-tags/devices/${deviceId}/${tagId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

// ========== Alert Threshold API ==========

export interface AlertThreshold {
  id: string;
  deviceId: string;
  property: string;
  minValue?: number | null;
  maxValue?: number | null;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function getThresholds(deviceId?: string): Promise<AlertThreshold[]> {
  const url = new URL(`${API_BASE}/thresholds`, window.location.origin);
  if (deviceId) url.searchParams.set('deviceId', deviceId);
  const fetchFn = () => fetch(url.pathname + url.search, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<AlertThreshold[]>(response, fetchFn);
  return data || [];
}

export async function createThreshold(data: {
  deviceId: string;
  property: string;
  minValue?: number | null;
  maxValue?: number | null;
  enabled?: boolean;
}): Promise<AlertThreshold | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/thresholds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();
  return handleResponse<AlertThreshold>(response, fetchFn);
}

export async function updateThreshold(id: string, data: {
  property?: string;
  minValue?: number | null;
  maxValue?: number | null;
  enabled?: boolean;
}): Promise<AlertThreshold | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/thresholds/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();
  return handleResponse<AlertThreshold>(response, fetchFn);
}

export async function deleteThreshold(id: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/thresholds/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

// ========== System Status API ==========

export interface SystemStatus {
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
    total: number;
    free: number;
    percent: number;
  };
  cpu: {
    percent: number;
    cores: number;
    model: string;
  };
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
  timestamp: string;
}

export interface DeviceSummary {
  total: number;
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number }[];
  byBrand: { brand: string; count: number }[];
}

export interface DatabaseStatus {
  status: string;
  type: string;
  name?: string;
  error?: string;
  timestamp: string;
}

export async function getSystemStatus(): Promise<SystemStatus | null> {
  const fetchFn = () => fetch(`${API_BASE}/system/status`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<SystemStatus>(response, fetchFn);
}

export async function getDeviceSummary(): Promise<DeviceSummary | null> {
  const fetchFn = () => fetch(`${API_BASE}/system/devices/summary`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<DeviceSummary>(response, fetchFn);
}

export async function getRecentSystemNotifications(): Promise<AppNotification[]> {
  const fetchFn = () => fetch(`${API_BASE}/system/notifications/recent`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<AppNotification[]>(response, fetchFn);
  return data || [];
}

export async function getDatabaseStatus(): Promise<DatabaseStatus | null> {
  const fetchFn = () => fetch(`${API_BASE}/system/database/status`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<DatabaseStatus>(response, fetchFn);
}

// ========== 配置导入导出 API ==========

export interface ExportedConfig {
  devices?: unknown[];
  rules?: unknown[];
  scenes?: unknown[];
  schedules?: unknown[];
  rooms?: unknown[];
  webhooks?: unknown[];
  thresholds?: unknown[];
  [key: string]: unknown;
}

export interface ImportResult {
  devices: number;
  rules: number;
  scenes: number;
  schedules: number;
  rooms: number;
  webhooks: number;
  thresholds: number;
}

export async function exportConfig(): Promise<ExportedConfig | null> {
  const fetchFn = () => fetch(`${API_BASE}/config/export`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  return handleResponse<ExportedConfig>(response, fetchFn);
}

export async function importConfig(config: ExportedConfig): Promise<{ success: boolean; imported: ImportResult } | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/config/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(config),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean; imported: ImportResult }>(response, fetchFn);
  return data || { success: false, imported: { devices: 0, rules: 0, scenes: 0, schedules: 0, rooms: 0, webhooks: 0, thresholds: 0 } };
}

// ========== 数据分析 API ==========

export interface AnalyticsSummary {
  totalUsers: number;
  totalDevices: number;
  totalRules: number;
  totalScenes: number;
  activeRules: number;
}

export interface DeviceUsageItem {
  deviceId: string;
  count: number;
}

export interface UserActivityItem {
  userId: string;
  count: number;
}

export interface TimelineItem {
  date: string;
  count: number;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary | null> {
  const fetchFn = () => fetch(`${API_BASE}/analytics/summary`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<AnalyticsSummary>(response, fetchFn);
  return data || { totalUsers: 0, totalDevices: 0, totalRules: 0, totalScenes: 0, activeRules: 0 };
}

export async function getDeviceUsage(): Promise<DeviceUsageItem[]> {
  const fetchFn = () => fetch(`${API_BASE}/analytics/devices/usage`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<DeviceUsageItem[]>(response, fetchFn);
  return data || [];
}

export async function getUserActivity(): Promise<UserActivityItem[]> {
  const fetchFn = () => fetch(`${API_BASE}/analytics/users/activity`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<UserActivityItem[]>(response, fetchFn);
  return data || [];
}

export async function getActivityTimeline(): Promise<TimelineItem[]> {
  const fetchFn = () => fetch(`${API_BASE}/analytics/timeline`, { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<TimelineItem[]>(response, fetchFn);
  return data || [];
}

// ========== 固件版本管理 API ==========

export interface FirmwareVersion {
  id: string;
  deviceId: string;
  version: string;
  filePath?: string | null;
  changelog?: string | null;
  status: string;
  fileSize?: number | null;
  createdAt: string;
  updatedAt: string;
}

export async function getFirmwareVersions(deviceId?: string): Promise<FirmwareVersion[]> {
  const url = new URL(`${API_BASE}/firmware`, window.location.origin);
  if (deviceId) url.searchParams.set('deviceId', deviceId);
  const fetchFn = () => fetch(url.toString(), { headers: getAuthHeaders() });
  const response = await fetchFn();
  const data = await handleResponse<FirmwareVersion[]>(response, fetchFn);
  return data || [];
}

export async function createFirmwareVersion(data: { deviceId: string; version: string; changelog?: string; fileSize?: number; filePath?: string }): Promise<FirmwareVersion | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/firmware`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();
  return handleResponse<FirmwareVersion>(response, fetchFn);
}

export async function updateFirmwareVersion(id: string, data: { version?: string; changelog?: string; status?: string; filePath?: string }): Promise<FirmwareVersion | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/firmware/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
  const response = await fetchFn();
  return handleResponse<FirmwareVersion>(response, fetchFn);
}

export async function deleteFirmwareVersion(id: string): Promise<{ success: boolean }> {
  const fetchFn = () =>
    fetch(`${API_BASE}/firmware/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean }>(response, fetchFn);
  return data || { success: false };
}

export async function installFirmware(id: string): Promise<{ success: boolean; firmware?: FirmwareVersion } | null> {
  const fetchFn = () =>
    fetch(`${API_BASE}/firmware/${id}/install`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  const response = await fetchFn();
  const data = await handleResponse<{ success: boolean; firmware?: FirmwareVersion }>(response, fetchFn);
  return data || { success: false };
}

// ========== 数据导出 API (CSV 下载) ==========

function downloadBlob(blob: Blob, filename: string): void {
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

async function fetchCSV(url: string): Promise<Blob | null> {
  const fetchFn = () => fetch(url, { headers: getAuthHeaders() });
  const response = await fetchFn();
  if (response.status === 401) {
    const retried = await refreshAndRetry(fetchFn);
    if (retried && retried.ok) {
      return retried.blob();
    }
    useAuthStore.getState().logout();
    return null;
  }
  if (!response.ok) {
    console.error(`[API] CSV export failed with status ${response.status}: ${response.statusText}`);
    return null;
  }
  return response.blob();
}

export async function exportEnergyData(params: { deviceId?: string; startDate?: string; endDate?: string }): Promise<Blob | null> {
  const url = new URL(`${API_BASE}/export/energy`, window.location.origin);
  if (params.deviceId) url.searchParams.set('deviceId', params.deviceId);
  if (params.startDate) url.searchParams.set('startDate', params.startDate);
  if (params.endDate) url.searchParams.set('endDate', params.endDate);
  return fetchCSV(url.toString());
}

export async function exportDeviceHistory(deviceId: string, params: { startDate?: string; endDate?: string }): Promise<Blob | null> {
  const url = new URL(`${API_BASE}/export/devices/${deviceId}/history`, window.location.origin);
  if (params.startDate) url.searchParams.set('startDate', params.startDate);
  if (params.endDate) url.searchParams.set('endDate', params.endDate);
  return fetchCSV(url.toString());
}

export async function exportAuditLogs(params: { startDate?: string; endDate?: string }): Promise<Blob | null> {
  const url = new URL(`${API_BASE}/export/audit-logs`, window.location.origin);
  if (params.startDate) url.searchParams.set('startDate', params.startDate);
  if (params.endDate) url.searchParams.set('endDate', params.endDate);
  return fetchCSV(url.toString());
}

export { downloadBlob };
