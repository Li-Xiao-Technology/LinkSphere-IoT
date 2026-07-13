import { create } from 'zustand';
import { Device, DeviceType, Brand, DeviceState } from '../types';
import { getDevices, discoverDevices } from '../api';

interface DeviceStore {
  devices: Device[];
  activeTab: string;
  filterType: DeviceType | 'all';
  filterBrand: Brand | 'all';
  isDiscovering: boolean;
  setDevices: (devices: Device[]) => void;
  setActiveTab: (tab: string) => void;
  setFilters: (type: DeviceType | 'all', brand: Brand | 'all') => void;
  setIsDiscovering: (discovering: boolean) => void;
  updateDeviceState: (deviceId: string, state: DeviceState) => void;
  updateDeviceStatus: (deviceId: string, status: 'online' | 'offline') => void;
  loadDevices: () => Promise<void>;
  handleDiscover: () => Promise<void>;
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  devices: [],
  activeTab: 'devices',
  filterType: 'all',
  filterBrand: 'all',
  isDiscovering: false,

  setDevices: (devices) => set({ devices }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setFilters: (type, brand) => set({ filterType: type, filterBrand: brand }),
  setIsDiscovering: (discovering) => set({ isDiscovering: discovering }),

  updateDeviceState: (deviceId, state) => set((prev) => ({
    devices: prev.devices.map((d) =>
      d.id === deviceId ? { ...d, state } : d
    ),
  })),

  updateDeviceStatus: (deviceId, status) => set((prev) => ({
    devices: prev.devices.map((d) =>
      d.id === deviceId ? { ...d, status } : d
    ),
  })),

  loadDevices: async () => {
    try {
      const data = await getDevices();
      if (Array.isArray(data)) {
        set({ devices: data });
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  },

  handleDiscover: async () => {
    set({ isDiscovering: true });
    try {
      const data = await discoverDevices();
      if (Array.isArray(data)) {
        set({ devices: data });
      }
    } catch (error) {
      console.error('Failed to discover devices:', error);
    }
    set({ isDiscovering: false });
  },
}));
