import { create } from 'zustand';
import { User } from '../types';

interface AuthStore {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  avatarUrl: string | null;
  isAuthenticated: boolean;
  initialized: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setAvatarUrl: (avatarUrl: string | null) => void;
  initAuth: () => void;
  refreshAccessToken: () => Promise<boolean>;
}

const TOKEN_KEY = 'linksphere-auth-token';
const REFRESH_TOKEN_KEY = 'linksphere-refresh-token';

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRefresh(refreshFn: () => Promise<boolean>, accessToken: string): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    const expiresIn = payload.exp * 1000 - Date.now();
    const refreshDelay = Math.max(expiresIn - 60000, 30000);
    refreshTimer = setTimeout(() => {
      refreshFn();
    }, refreshDelay);
  } catch {
    // ignore
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  avatarUrl: null,
  isAuthenticated: false,
  initialized: false,

  initAuth: () => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (savedToken) {
        set({ token: savedToken, refreshToken: savedRefresh, isAuthenticated: true });
        get().refreshAccessToken();
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
    }
    set({ initialized: true });
  },

  login: async (username: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      if (data.accessToken) {
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        }
        set({
          token: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
          user: data.user || null,
        });
        scheduleRefresh(() => get().refreshAccessToken(), data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  logout: async () => {
    try {
      const token = get().token;
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch {
      // ignore
    }
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  },

  setToken: (token) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, isAuthenticated: true });
  },

  setUser: (user) => {
    set({ user });
  },

  setAvatarUrl: (avatarUrl) => {
    set({ avatarUrl });
  },

  refreshAccessToken: async () => {
    const currentRefresh = get().refreshToken;
    if (!currentRefresh) return false;

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefresh })
      });

      if (!response.ok) {
        get().logout();
        return false;
      }

      const data = await response.json();
      if (data.accessToken) {
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        }
        set({
          token: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user || get().user,
        });
        scheduleRefresh(() => get().refreshAccessToken(), data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
