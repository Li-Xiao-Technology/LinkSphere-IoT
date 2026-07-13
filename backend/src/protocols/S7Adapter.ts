import { Device, DeviceState, ProtocolAdapter } from '../types';
import nodes7 from 'nodes7';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

interface NodeS7Instance {
  initiateConnection(options: {
    port: number;
    host: string;
    rack: number;
    slot: number;
    timeout?: number;
  }, callback: (err: Error | undefined) => void): void;
  dropConnection(callback?: (err: Error | null) => void): void;
  setTranslationCB(callback: (name: string) => { area: number; dbNumber: number; start: number; type: string }): void;
  addItems(items: string | string[]): void;
  readAllItems(callback: (anythingBad: boolean, values: Record<string, unknown>) => void): void;
  writeItems(items: string | string[], values: unknown | unknown[], callback: (anythingBad: boolean, values: unknown) => void): void;
}

interface S7RegisterConfig {
  property: string;
  type: 'DB' | 'I' | 'Q' | 'M' | 'T' | 'C';
  address: string;
  dbNumber?: number;
  dataType?: 'BOOL' | 'BYTE' | 'WORD' | 'DWORD' | 'INT' | 'DINT' | 'REAL';
  scale?: number;
  readOnly?: boolean;
  unit?: string;
}

interface S7DeviceConfig {
  ipAddress?: string;
  rack: number;
  slot: number;
  timeout: number;
  registerMap: S7RegisterConfig[];
  cpuType?: string;
}

interface S7Connection {
  conn: NodeS7Instance;
  deviceId: string;
  ipAddress: string;
  rack: number;
  slot: number;
  timeout: number;
  config: S7DeviceConfig;
  lastUsed: number;
  isConnecting: boolean;
  connectPromise?: Promise<S7Connection>;
}

const CONNECTION_IDLE_TIMEOUT = 5 * 60 * 1000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export class S7Adapter implements ProtocolAdapter {
  brand = 'SiemensS7';
  private connections: Map<string, S7Connection> = new Map();

  async discoverDevices(): Promise<Device[]> {
    return [];
  }

  private async loadConfig(deviceId: string): Promise<S7DeviceConfig | null> {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device || !device.config) {
      return null;
    }

    try {
      const parsed = JSON.parse(device.config) as Partial<S7DeviceConfig>;
      return {
        ipAddress: device.ipAddress || parsed.ipAddress,
        rack: parsed.rack ?? 0,
        slot: parsed.slot ?? 1,
        timeout: parsed.timeout ?? 5000,
        registerMap: parsed.registerMap || [],
        cpuType: parsed.cpuType || 'S7-200 SMART',
      };
    } catch {
      return null;
    }
  }

  private formatAddress(reg: S7RegisterConfig): string {
    switch (reg.type) {
      case 'DB':
        return `DB${reg.dbNumber},${reg.address}`;
      case 'I':
      case 'Q':
      case 'M':
      case 'T':
      case 'C':
        return `${reg.type}${reg.address}`;
      default:
        return reg.address;
    }
  }

  private async getConnection(deviceId: string): Promise<S7Connection | null> {
    const existing = this.connections.get(deviceId);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing;
    }

    const config = await this.loadConfig(deviceId);
    if (!config || !config.ipAddress) {
      logger.error(`[S7Adapter] Device ${deviceId} has no valid config or IP`);
      return null;
    }

    const conn = new (nodes7 as any)({ silent: true }) as NodeS7Instance;

    const connection: S7Connection = {
      conn,
      deviceId,
      ipAddress: config.ipAddress,
      rack: config.rack,
      slot: config.slot,
      timeout: config.timeout,
      config,
      lastUsed: Date.now(),
      isConnecting: true,
    };

    try {
      await this.connect(connection);
      this.connections.set(deviceId, connection);
      this.scheduleCleanup();
      return connection;
    } catch (err) {
      logger.error(`[S7Adapter] Failed to connect to ${deviceId} (${config.ipAddress}):`, err as Error);
      return null;
    } finally {
      connection.isConnecting = false;
    }
  }

  private async connect(connection: S7Connection, retry = 0): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      connection.conn.initiateConnection(
        {
          port: 102,
          host: connection.ipAddress,
          rack: connection.rack,
          slot: connection.slot,
          timeout: connection.timeout,
        },
        (err: Error | undefined) => {
          if (err) {
            if (retry < MAX_RETRIES) {
              setTimeout(() => {
                this.connect(connection, retry + 1).then(resolve).catch(reject);
              }, RETRY_DELAY * Math.pow(2, retry));
            } else {
              reject(err);
            }
          } else {
            logger.info(`[S7Adapter] Connected to ${connection.deviceId} (${connection.ipAddress})`);
            resolve();
          }
        }
      );
    });
  }

  private async ensureConnected(connection: S7Connection): Promise<void> {
    connection.lastUsed = Date.now();
  }

  private scheduleCleanup(): void {
    const now = Date.now();
    for (const [deviceId, conn] of this.connections.entries()) {
      if (now - conn.lastUsed > CONNECTION_IDLE_TIMEOUT && !conn.isConnecting) {
        try {
          conn.conn.dropConnection(() => {});
        } catch {
          // ignore
        }
        this.connections.delete(deviceId);
        logger.info(`[S7Adapter] Idle connection closed for ${deviceId}`);
      }
    }
  }

  async getDeviceState(deviceId: string): Promise<DeviceState | null> {
    const connection = await this.getConnection(deviceId);
    if (!connection) {
      return null;
    }

    try {
      await this.ensureConnected(connection);
      const registerMap = connection.config.registerMap;
      const state: DeviceState = { deviceId };

      const readableRegs = registerMap.filter((r) => {
        const addr = this.formatAddress(r);
        return addr && addr.length > 0;
      });

      if (readableRegs.length > 0) {
        try {
          const values = await this.batchRead(connection, readableRegs);
          for (const reg of readableRegs) {
            const rawValue = values[this.formatAddress(reg)];
            if (rawValue !== undefined && rawValue !== null) {
              const scaled = reg.scale && typeof rawValue === 'number'
                ? rawValue * reg.scale
                : rawValue;
              state[reg.property] = scaled;
            }
          }
        } catch (err) {
          logger.error(`[S7Adapter] Batch read failed for ${deviceId}:`, err as Error);
        }
      }

      state['online'] = true;
      return state;
    } catch (err) {
      logger.error(`[S7Adapter] getDeviceState failed for ${deviceId}:`, err as Error);
      return { deviceId, online: false };
    }
  }

  private async batchRead(connection: S7Connection, regs: S7RegisterConfig[]): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const addresses = regs.map((r) => this.formatAddress(r));
      connection.conn.addItems(addresses);

      connection.conn.readAllItems((anythingBad: boolean, values: Record<string, unknown>) => {
        if (anythingBad) {
          reject(new Error('Batch read failed'));
        } else {
          resolve(values);
        }
      });
    });
  }

  async setDeviceState(deviceId: string, state: Partial<DeviceState>): Promise<boolean> {
    const connection = await this.getConnection(deviceId);
    if (!connection) {
      return false;
    }

    try {
      await this.ensureConnected(connection);
      const registerMap = connection.config.registerMap;
      const writes: Array<{ address: string; value: unknown; reg: S7RegisterConfig }> = [];

      for (const [property, value] of Object.entries(state)) {
        if (property === 'deviceId' || property === 'online' || property === 'plcStatus') {
          continue;
        }

        const reg = registerMap.find((r) => r.property === property && !r.readOnly);
        if (!reg) {
          logger.warn(`[S7Adapter] No writable register found for property ${property} on ${deviceId}`);
          continue;
        }

        let writeValue = value;
        if (reg.scale && typeof value === 'number') {
          writeValue = value / reg.scale;
        }

        writes.push({
          address: this.formatAddress(reg),
          value: writeValue,
          reg,
        });
      }

      if (writes.length > 0) {
        await this.batchWrite(connection, writes);
      }

      return true;
    } catch (err) {
      logger.error(`[S7Adapter] setDeviceState failed for ${deviceId}:`, err as Error);
      return false;
    }
  }

  private async batchWrite(
    connection: S7Connection,
    writes: Array<{ address: string; value: unknown }>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const addresses = writes.map((w) => w.address);
      const values = writes.map((w) => w.value);

      connection.conn.writeItems(addresses, values, (anythingBad: boolean) => {
        if (anythingBad) {
          reject(new Error('Batch write failed'));
        } else {
          resolve();
        }
      });
    });
  }

  async updateFirmware(deviceId: string, _version: string): Promise<boolean> {
    logger.info(`[S7Adapter] Firmware update not supported for device ${deviceId}`);
    return false;
  }

  public disconnect(deviceId: string): void {
    const connection = this.connections.get(deviceId);
    if (connection) {
      try {
        connection.conn.dropConnection(() => {});
      } catch {
        // ignore
      }
      this.connections.delete(deviceId);
    }
  }

  public disconnectAll(): void {
    for (const deviceId of this.connections.keys()) {
      this.disconnect(deviceId);
    }
  }
}
