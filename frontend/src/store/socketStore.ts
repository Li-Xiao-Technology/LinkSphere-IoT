import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { Device, DeviceState, AppNotification } from '../types';
import { useAuthStore } from './authStore';
import { useDeviceStore } from './deviceStore';
import { useNotificationStore } from './notificationStore';

interface SocketStore {
  socket: Socket | null;
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  sendSetDeviceState: (deviceId: string, state: Record<string, unknown>) => void;
  sendDiscoverDevices: () => void;
}

let socketInstance: Socket | null = null;

export const useSocketStore = create<SocketStore>((set, get) => ({
  socket: null,
  connected: false,

  connect: () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      console.warn('[Socket] No token available, skip connection');
      return;
    }

    if (socketInstance?.connected) {
      console.log('[Socket] Already connected');
      return;
    }

    console.log('[Socket] Connecting to server...');

    // 通过 REACT_APP_SOCKET_URL 注入，便于跨域/跨主机部署
    // 未设置时使用当前 origin（同源部署最简）
    const socketUrl =
      (typeof process !== 'undefined' && process.env?.REACT_APP_SOCKET_URL) ||
      (typeof window !== 'undefined' ? window.location.origin : '');

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketInstance = socket;
    set({ socket });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      set({ connected: true });
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      set({ connected: false });
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      set({ connected: false });
    });

    socket.on('devices', (devices: Device[]) => {
      console.log('[Socket] Received devices update, count:', devices.length);
      if (Array.isArray(devices)) {
        useDeviceStore.getState().setDevices(devices);
      }
    });

    socket.on('deviceStateChanged', ({ deviceId, state }: { deviceId: string; state: DeviceState }) => {
      console.log('[Socket] Device state changed:', deviceId);
      useDeviceStore.getState().updateDeviceState(deviceId, state);
      useDeviceStore.getState().updateDeviceStatus(deviceId, 'online');
    });

    socket.on('deviceStatusChanged', ({ deviceId, status }: { deviceId: string; status: 'online' | 'offline' }) => {
      console.log('[Socket] Device status changed:', deviceId, status);
      useDeviceStore.getState().updateDeviceStatus(deviceId, status);
    });

    socket.on('devicesDiscovered', (devices: Device[]) => {
      console.log('[Socket] Devices discovered:', devices.length);
      if (Array.isArray(devices)) {
        useDeviceStore.getState().setDevices(devices);
      }
      useDeviceStore.getState().setIsDiscovering(false);
    });

    socket.on('notification', (notification: AppNotification) => {
      console.log('[Socket] Received notification:', notification.type);
      const currentCount = useNotificationStore.getState().unreadCount;
      useNotificationStore.getState().setUnreadCount(currentCount + 1);
      
      const notifications = useNotificationStore.getState().notifications;
      useNotificationStore.getState().setNotifications([notification, ...notifications]);
    });
  },

  disconnect: () => {
    if (socketInstance) {
      console.log('[Socket] Disconnecting...');
      socketInstance.disconnect();
      socketInstance = null;
      set({ socket: null, connected: false });
    }
  },

  sendSetDeviceState: (deviceId: string, state: Record<string, unknown>) => {
    if (socketInstance?.connected) {
      socketInstance.emit('setDeviceState', { deviceId, state });
    }
  },

  sendDiscoverDevices: () => {
    if (socketInstance?.connected) {
      useDeviceStore.getState().setIsDiscovering(true);
      socketInstance.emit('discoverDevices');
    }
  },
}));
