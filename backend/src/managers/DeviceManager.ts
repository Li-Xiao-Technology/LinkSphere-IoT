import { EventEmitter } from 'events';
import { Device, DeviceState } from '../types';
import { ProtocolManager } from '../protocols/ProtocolManager';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';
import { webhookEvents } from '../services/webhookService';

export class DeviceManager extends EventEmitter {
  private static instance: DeviceManager;
  private devices: Map<string, Device> = new Map();
  private deviceStates: Map<string, DeviceState> = new Map();
  private stateHashes: Map<string, string> = new Map();
  private syncInterval: number | undefined;

  private constructor() {
    super();
  }

  public static getInstance(): DeviceManager {
    if (!DeviceManager.instance) {
      DeviceManager.instance = new DeviceManager();
    }
    return DeviceManager.instance;
  }

  public async startDiscovery(): Promise<void> {
    await this.loadDevicesFromDB();
    await this.discoverDevices();
    this.startSyncLoop();
  }

  private async loadDevicesFromDB(): Promise<void> {
    try {
      const dbDevices = await prisma.device.findMany();
      const protocolManager = ProtocolManager.getInstance();

      for (const dbDevice of dbDevices) {
        const device: Device = {
          id: dbDevice.id,
          name: dbDevice.name,
          brand: dbDevice.brand,
          type: dbDevice.type as Device['type'],
          model: dbDevice.model ?? undefined,
          sn: dbDevice.sn ?? undefined,
          status: dbDevice.status as Device['status'],
          connectionType: dbDevice.connectionType as Device['connectionType'],
          networkName: dbDevice.networkName ?? undefined,
          networkStrength: dbDevice.networkStrength ?? undefined,
          ipAddress: dbDevice.ipAddress ?? undefined,
          macAddress: dbDevice.macAddress ?? undefined,
          firmwareVersion: dbDevice.firmwareVersion ?? undefined,
          config: dbDevice.config ?? undefined,
          roomId: dbDevice.roomId ?? undefined,
          powerConsumption: dbDevice.powerConsumption,
          lastSyncTime: dbDevice.updatedAt?.toISOString(),
        };

        this.devices.set(device.id, device);

        // Modbus 设备需要建立连接
        if (device.brand === 'ModbusTCP') {
          const modbusAdapter = protocolManager.getModbusAdapter();
          try {
            if (device.config) {
              let config;
              try {
                config = JSON.parse(device.config);
              } catch (parseError) {
                logger.error(`Failed to parse config for Modbus device ${device.id}`, parseError as Error);
                device.status = 'offline';
                this.devices.set(device.id, device);
                continue;
              }
              await modbusAdapter.addDevice(device.id, config);
              // 更新连接状态
              const connected = modbusAdapter.isDeviceConnected(device.id);
              device.status = connected ? 'online' : 'offline';
              this.devices.set(device.id, device);
            }
          } catch (error) {
            logger.error(`Failed to restore Modbus device ${device.id}`, error as Error);
            device.status = 'offline';
            this.devices.set(device.id, device);
          }
        }
      }

      logger.info(`Loaded ${dbDevices.length} devices from database`);
    } catch (error) {
      logger.error('Failed to load devices from database', error as Error);
    }
  }

  public async discoverDevices(): Promise<Device[]> {
    const protocolManager = ProtocolManager.getInstance();
    const adapters = protocolManager.getAllAdapters();
    const allDevices: Device[] = [];

    const promises = adapters.map(async (adapter) => {
      try {
        const devices = await adapter.discoverDevices();
        devices.forEach(device => {
          this.devices.set(device.id, device);
          allDevices.push(device);
        });
      } catch (error) {
        logger.error(`Failed to discover devices for ${adapter.brand}`, error as Error);
      }
    });

    await Promise.all(promises);
    await this.saveDevicesToDB(allDevices);
    return allDevices;
  }

  private hashState(state: DeviceState): string {
    return JSON.stringify(state);
  }

  private async saveStateHistory(deviceId: string, status: string, state: DeviceState | null): Promise<void> {
    try {
      await prisma.deviceStateHistory.create({
        data: {
          id: `${deviceId}-${Date.now()}`,
          deviceId,
          status,
          state: state ? JSON.stringify(state) : null
        }
      });
    } catch (error) {
      logger.error(`Failed to save state history for ${deviceId}`, error as Error);
    }
  }

  private async savePlcRegisterHistory(deviceId: string, state: DeviceState): Promise<void> {
    try {
      const device = this.devices.get(deviceId);
      if (!device || device.type !== 'plc') return;

      const numericProps: string[] = ['temperature', 'humidity', 'pressure', 'value', 'analogInput0', 'analogInput1'];
      
      for (const prop of numericProps) {
        const val = state[prop];
        if (typeof val === 'number') {
          await prisma.plcRegisterHistory.create({
            data: {
              id: `${deviceId}-${prop}-${Date.now()}`,
              deviceId,
              property: prop,
              address: 0,
              value: val,
              rawValue: val,
              unit: prop === 'temperature' ? '°C' : prop === 'humidity' ? '%' : prop === 'pressure' ? 'kPa' : '',
              timestamp: new Date(),
            },
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to save PLC register history for ${deviceId}`, error as Error);
    }
  }

  public async getDeviceState(deviceId: string): Promise<DeviceState | null> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return null;
    }

    const protocolManager = ProtocolManager.getInstance();
    const adapter = protocolManager.getAdapter(device.brand);
    if (!adapter) {
      return null;
    }

    try {
      const state = await adapter.getDeviceState(deviceId);

      // 如果返回null，说明设备离线
      if (state === null) {
        if (device.status !== 'offline') {
          device.status = 'offline';
          this.devices.set(deviceId, device);
          await this.saveDeviceStatusToDB(deviceId, 'offline');
          logger.info(`Device ${deviceId} marked as offline`);
          this.emit('deviceStatusChanged', { deviceId, status: 'offline' });
          webhookEvents.deviceOffline(deviceId, device.name).catch((e) => logger.error('webhook deviceOffline failed', e as Error));
        }
        return null;
      }

      // 设备在线，更新状态为online（如果之前是offline）
      if (device.status !== 'online') {
        device.status = 'online';
        this.devices.set(deviceId, device);
        await this.saveDeviceStatusToDB(deviceId, 'online');
        logger.info(`Device ${deviceId} marked as online`);
        this.emit('deviceStatusChanged', { deviceId, status: 'online' });
        webhookEvents.deviceOnline(deviceId, device.name).catch((e) => logger.error('webhook deviceOnline failed', e as Error));
      }

      const prevHash = this.stateHashes.get(deviceId);
      const newHash = this.hashState(state);

      this.deviceStates.set(deviceId, state);
      this.stateHashes.set(deviceId, newHash);

      if (prevHash && prevHash !== newHash) {
        logger.debug(`Device state changed: ${deviceId}`, { previousHash: prevHash, newHash: newHash });
        await this.saveStateHistory(deviceId, device.status, state);
        await this.savePlcRegisterHistory(deviceId, state);
        this.emit('deviceStateChanged', { deviceId, state });
      }
      return state;
    } catch (error) {
      logger.error(`Failed to get state for ${deviceId}`, error as Error);
      // 发生异常也标记为离线
      if (device.status !== 'offline') {
        device.status = 'offline';
        this.devices.set(deviceId, device);
        await this.saveDeviceStatusToDB(deviceId, 'offline');
        this.emit('deviceStatusChanged', { deviceId, status: 'offline' });
        webhookEvents.deviceOffline(deviceId, device.name).catch((e) => logger.error('webhook deviceOffline failed', e as Error));
      }
      return null;
    }
  }

  public async setDeviceState(deviceId: string, state: Partial<DeviceState>): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }

    const protocolManager = ProtocolManager.getInstance();
    const adapter = protocolManager.getAdapter(device.brand);
    if (!adapter) {
      return false;
    }

    try {
      const success = await adapter.setDeviceState(deviceId, state);
      if (success) {
        const currentState = this.deviceStates.get(deviceId);
        const newState = currentState ? { ...currentState, ...state } : { deviceId, ...state } as DeviceState;
        this.deviceStates.set(deviceId, newState);
        await this.saveStateHistory(deviceId, device.status, newState);
        this.emit('deviceStateChanged', { deviceId, state: newState });
        webhookEvents.deviceControlled(deviceId, device.name, JSON.stringify(state).slice(0, 100)).catch((e) => logger.error('webhook deviceControlled failed', e as Error));
      }
      return success;
    } catch (error) {
      logger.error(`Failed to set state for ${deviceId}`, error as Error);
      return false;
    }
  }

  public getAllDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  public getDeviceById(deviceId: string): Device | undefined {
    return this.devices.get(deviceId);
  }

  public getDevicesByType(type: string): Device[] {
    return Array.from(this.devices.values()).filter(d => d.type === type);
  }

  public getDevicesByBrand(brand: string): Device[] {
    return Array.from(this.devices.values()).filter(d => d.brand === brand);
  }

  public addDevice(device: Device): void {
    this.devices.set(device.id, device);
    this.emit('deviceAdded', device);
  }

  public async removeDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }

    // 断开协议连接
    const protocolManager = ProtocolManager.getInstance();
    if (device.brand === 'ModbusTCP') {
      protocolManager.getModbusAdapter().disconnectDevice(deviceId);
    } else if (device.brand === 'mqtt') {
      protocolManager.getMqttAdapter().disconnectDevice(deviceId);
    } else if (device.brand === 'yeelight') {
      protocolManager.getYeelightAdapter().disconnectDevice(deviceId);
    } else if (device.brand === 'yeelight-ble') {
      protocolManager.getYeelightBLEAdapter().disconnectDevice(deviceId);
    }

    // 清理内存
    this.devices.delete(deviceId);
    this.deviceStates.delete(deviceId);
    this.stateHashes.delete(deviceId);

    // 从数据库删除
    try {
      await prisma.device.delete({
        where: { id: deviceId },
      });
    } catch (error) {
      logger.error(`Failed to delete device ${deviceId} from database`, error as Error);
    }

    this.emit('deviceRemoved', deviceId);
    logger.info(`Device removed: ${deviceId}`);
    return true;
  }

  public async updateFirmware(deviceId: string, version: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }

    const protocolManager = ProtocolManager.getInstance();
    const adapter = protocolManager.getAdapter(device.brand);
    if (!adapter) {
      return false;
    }

    try {
      const success = await adapter.updateFirmware(deviceId, version);
      if (success && device) {
        device.firmwareVersion = version;
        await this.updateDeviceInDB(device);
      }
      return success;
    } catch (error) {
      logger.error(`Failed to update firmware for ${deviceId}`, error as Error);
      return false;
    }
  }

  private startSyncLoop(): void {
    this.syncInterval = setInterval(async () => {
      await this.syncAllDeviceStates();
    }, 5000) as unknown as number;
  }

  private async syncAllDeviceStates(): Promise<void> {
    const deviceIds = Array.from(this.devices.keys());
    if (deviceIds.length === 0) return;

    logger.debug(`Starting incremental sync for ${deviceIds.length} devices`);

    // 为每个设备状态获取添加独立超时（10秒），避免单个设备阻塞整体同步
    const results = await Promise.allSettled(
      deviceIds.map(id => this.getDeviceStateWithTimeout(id, 10000))
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
    const failedCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === null)).length;

    if (failedCount > 0) {
      logger.warn(`Sync completed: ${successCount} success, ${failedCount} failed`, { total: deviceIds.length });
    }
  }

  private async getDeviceStateWithTimeout(deviceId: string, timeoutMs: number): Promise<DeviceState | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        logger.warn(`Device state fetch timeout for ${deviceId} (${timeoutMs}ms)`);
        resolve(null);
      }, timeoutMs);

      this.getDeviceState(deviceId)
        .then((state) => {
          clearTimeout(timer);
          resolve(state);
        })
        .catch((error) => {
          clearTimeout(timer);
          logger.error(`Device state fetch error for ${deviceId}`, error);
          resolve(null);
        });
    });
  }

  private async saveDevicesToDB(devices: Device[]): Promise<void> {
    for (const device of devices) {
      await prisma.device.upsert({
        where: { id: device.id },
        update: {
          name: device.name,
          brand: device.brand,
          type: device.type,
          model: device.model || null,
          status: device.status,
          connectionType: device.connectionType,
          ipAddress: device.ipAddress || null,
          macAddress: device.macAddress || null,
          firmwareVersion: device.firmwareVersion || null,
          config: device.config || null,
          roomId: device.roomId || null,
          powerConsumption: device.powerConsumption || 0,
          updatedAt: new Date()
        },
        create: {
          id: device.id,
          name: device.name,
          brand: device.brand,
          type: device.type,
          model: device.model || null,
          status: device.status,
          connectionType: device.connectionType,
          ipAddress: device.ipAddress || null,
          macAddress: device.macAddress || null,
          firmwareVersion: device.firmwareVersion || null,
          config: device.config || null,
          roomId: device.roomId || null,
          powerConsumption: device.powerConsumption || 0
        }
      });
    }
  }

  private async updateDeviceInDB(device: Device): Promise<void> {
    await prisma.device.update({
      where: { id: device.id },
      data: {
        firmwareVersion: device.firmwareVersion || null,
        updatedAt: new Date()
      }
    });
  }

  private async saveDeviceStatusToDB(deviceId: string, status: string): Promise<void> {
    try {
      await prisma.device.update({
        where: { id: deviceId },
        data: {
          status,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error(`Failed to update device status in DB for ${deviceId}`, error as Error);
    }
  }
}
