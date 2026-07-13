import { create } from 'zustand';
import { AppNotification } from '../types';
import { getUnreadNotifications, getNotifications } from '../api';

interface NotificationStore {
  unreadCount: number;
  notifications: AppNotification[];
  setUnreadCount: (count: number) => void;
  setNotifications: (notifications: AppNotification[]) => void;
  loadUnreadCount: () => Promise<void>;
  loadNotifications: () => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  unreadCount: 0,
  notifications: [],

  setUnreadCount: (count) => set({ unreadCount: count }),
  setNotifications: (notifications) => set({ notifications }),

  loadUnreadCount: async () => {
    try {
      const data = await getUnreadNotifications();
      set({ unreadCount: data.length });
    } catch {
      // ignore
    }
  },

  loadNotifications: async () => {
    try {
      const data = await getNotifications();
      if (Array.isArray(data)) {
        set({ notifications: data });
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  },
}));
