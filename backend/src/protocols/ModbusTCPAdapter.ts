import { Device, DeviceState, ProtocolAdapter } from '../types';
import { logger } from '../utils/logger';
import * as Modbus from 'jsmodbus';
import { Socket } from 'net';

// Modbus TCP 连接配置
interface ModbusDeviceConfig {
  host: string;
  port: number;
  slaveId: number;
  registerMap: RegisterMapping[];
}

interface RegisterMapping {
  property: string;
  type: 'coil' | 'discrete' | 'holding' | 'input';
  address: number;
  quantity: number;
  dataType: 'bool' | 'int16' | 'uint16' | 'float32' | 'string';
  writable: boolean;
  scale?: number;
  unit?: string;
}

// 设备连接缓存
interface ModbusConnection {
  config: ModbusDeviceConfig;
  lastRead: Map<string, unknown>;
  connected: boolean;
  socket: Socket | null;
  client: ModbusTCPClient | null;
}

// jsmodbus 实际类型
type ModbusTCPClient = InstanceType<typeof Modbus.client.TCP>;

// 2SR20B (S7-200 SMART) 默认寄存器映射
const S7_200_SMART_DEFAULT_MAP: RegisterMapping[] = [
  // 线圈 (Q区) - Q0.0~Q0.7 对应 Modbus 地址 0~7
  { property: 'coil0', type: 'coil', address: 0, quantity: 1, dataType: 'bool', writable: true },
  { property: 'coil1', type: 'coil', address: 1, quantity: 1, dataType: 'bool', writable: true },
  { property: 'coil2', type: 'coil', address: 2, quantity: 1, dataType: 'bool', writable: true },
  { property: 'coil3', type: 'coil', address: 3, quantity: 1, dataType: 'bool', writable: true },
  // 保持寄存器 (V区) - VW0, VW2, VW4...
  // power绑定到VW0用于PLC程序软开关控制
  { property: 'power', type: 'holding', address: 0, quantity: 1, dataType: 'int16', writable: true, unit: '' },
  { property: 'temperature', type: 'holding', address: 1, quantity: 1, dataType: 'int16', writable: false, scale: 0.1, unit: '°C' },
  { property: 'humidity', type: 'holding', address: 2, quantity: 1, dataType: 'int16', writable: false, scale: 0.1, unit: '%' },
  { property: 'pressure', type: 'holding', address: 3, quantity: 1, dataType: 'int16', writable: false, scale: 0.1, unit: 'kPa' },
  // 输入寄存器 (AI) - AIW0, AIW2...
  { property: 'analogInput0', type: 'input', address: 0, quantity: 1, dataType: 'int16', writable: false, unit: 'raw' },
  { property: 'analogInput1', type: 'input', address: 1, quantity: 1, dataType: 'int16', writable: false, unit: 'raw' },
  // 离散输入 (I区) - I0.0~I0.7
  { property: 'input0', type: 'discrete', address: 0, quantity: 1, dataType: 'bool', writable: false },
  { property: 'input1', type: 'discrete', address: 1, quantity: 1, dataType: 'bool', writable: false },
];

export class ModbusTCPAdapter implements ProtocolAdapter {
  brand = 'ModbusTCP';
  private connections: Map<string, ModbusConnection> = new Map();

  async discoverDevices(): Promise<Device[]> {
    // Modbus TCP 设备不支持自动发现，需手动添加
    const devices: Device[] = [];
    for (const [deviceId, conn] of this.connections) {
      devices.push({
        id: deviceId,
        name: `PLC ${conn.config.host}`,
        brand: 'ModbusTCP',
        type: 'plc',
        model: '2SR20B',
        status: conn.connected ? 'online' : 'offline',
        connectionType: 'ethernet',
        ipAddress: conn.config.host,
        config: JSON.stringify(conn.config),
      });
    }
    return devices;
  }

  /**
   * 手动添加 Modbus TCP 设备
   */
  async addDevice(deviceId: string, config: ModbusDeviceConfig): Promise<Device | null> {
    const conn: ModbusConnection = {
      config,
      lastRead: new Map(),
      connected: false,
      socket: null,
      client: null,
    };
    this.connections.set(deviceId, conn);

    // 尝试连接
    const connected = await this.connectDevice(deviceId);
    if (connected) {
      logger.info(`Modbus TCP device connected: ${config.host}:${config.port} (slave ${config.slaveId})`);
    }

    return {
      id: deviceId,
      name: `PLC ${config.host}`,
      brand: 'ModbusTCP',
      type: 'plc',
      model: '2SR20B',
      status: connected ? 'online' : 'offline',
      connectionType: 'ethernet',
      ipAddress: config.host,
      config: JSON.stringify(config),
    };
  }

  /**
   * 扫描局域网中的 Modbus TCP 设备
   */
  async scanNetwork(baseIp: string, port: number = 502, slaveId: number = 1): Promise<Array<{ host: string; port: number; slaveId: number }>> {
    const found: Array<{ host: string; port: number; slaveId: number }> = [];
    const base = baseIp.split('.').slice(0, 3).join('.');

    logger.info(`Scanning Modbus TCP devices on ${base}.*:${port}`);

    const promises = [];
    for (let i = 1; i <= 254; i++) {
      const host = `${base}.${i}`;
      promises.push(this.probeDevice(host, port, slaveId));
    }

    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        found.push(result.value);
      }
    }

    logger.info(`Scan complete, found ${found.length} Modbus TCP devices`);
    return found;
  }

  /**
   * 探测单个设备 - 优化版：先TCP握手，能连上就初步认为是Modbus设备
   * 这样能识别只监听端口但不响应Modbus指令的设备
   */
  private async probeDevice(host: string, port: number, slaveId: number): Promise<{ host: string; port: number; slaveId: number } | null> {
    return new Promise((resolve) => {
      const socket = new Socket();
      let resolved = false;

      const cleanup = (result: { host: string; port: number; slaveId: number } | null) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        try {
          if (!socket.destroyed) {
            socket.destroy();
          }
        } catch {
          // ignore
        }
        resolve(result);
      };

      const timeout = setTimeout(() => cleanup(null), 1500);

      socket.on('connect', () => {
        // TCP连接成功，立即认为该IP可能是Modbus设备
        cleanup({ host, port, slaveId });
      });

      socket.on('error', () => {
        cleanup(null);
      });

      socket.on('timeout', () => {
        cleanup(null);
      });

      socket.setTimeout(1500);
      try {
        socket.connect({ host, port });
      } catch {
        cleanup(null);
      }
    });
  }

  /**
   * 确保设备连接有效：检测现有连接，如已断开则重新连接
   */
  private async ensureConnection(deviceId: string): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn) return false;

    // 如果已有有效socket且未销毁，快速返回
    if (conn.socket && !conn.socket.destroyed && conn.connected && conn.client) {
      return true;
    }

    // 标记为离线，尝试重新连接
    conn.connected = false;
    conn.socket = null;
    conn.client = null;

    return this.connectDevice(deviceId);
  }

  private async connectDevice(deviceId: string): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn) return false;

    // 如果已有连接，先断开
    if (conn.socket) {
      try {
        conn.socket.destroy();
      } catch {
        // ignore
      }
      conn.socket = null;
      conn.client = null;
    }

    try {
      const socket = new Socket();
      const client = new Modbus.client.TCP(socket, conn.config.slaveId, 5000);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          socket.destroy();
          conn.connected = false;
          conn.socket = null;
          conn.client = null;
          resolve(false);
        }, 5000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          conn.connected = true;
          conn.socket = socket;
          conn.client = client;
          resolve(true);
        });

        socket.on('error', (err) => {
          clearTimeout(timeout);
          conn.connected = false;
          conn.socket = null;
          conn.client = null;
          logger.warn(`Modbus TCP connection error for ${deviceId}: ${err.message}`);
          resolve(false);
        });

        socket.on('close', () => {
          conn.connected = false;
          conn.socket = null;
          conn.client = null;
        });

        socket.connect({ host: conn.config.host, port: conn.config.port });
      });
    } catch (error) {
      conn.connected = false;
      conn.socket = null;
      conn.client = null;
      logger.error(`Failed to connect Modbus TCP device ${deviceId}`, error as Error);
      return false;
    }
  }

  async getDeviceState(deviceId: string): Promise<DeviceState | null> {
    const connected = await this.ensureConnection(deviceId);
    if (!connected) {
      return null;
    }

    const conn = this.connections.get(deviceId);
    if (!conn || !conn.client) {
      return null;
    }

    const state: DeviceState = { deviceId };
    const registerMap = Array.isArray(conn.config.registerMap) && conn.config.registerMap.length > 0 ? conn.config.registerMap : S7_200_SMART_DEFAULT_MAP;
    let readSuccess = false;

    for (const mapping of registerMap) {
      try {
        const value = await this.readRegister(conn.client, mapping);
        const scaledValue = mapping.scale ? (value as number) * mapping.scale : value;
        state[mapping.property] = scaledValue;
        conn.lastRead.set(mapping.property, scaledValue);
        readSuccess = true;
      } catch (error) {
        logger.warn(`Failed to read ${mapping.property} from ${deviceId}: ${(error as Error).message}`);
        const lastValue = conn.lastRead.get(mapping.property);
        if (lastValue !== undefined) {
          state[mapping.property] = lastValue;
        }
      }
    }

    // 如果没有任何一次读取成功，说明设备实际已离线（TCP半开连接）
    if (!readSuccess) {
      logger.warn(`All register reads failed for ${deviceId}, marking as offline`);
      if (conn.socket) {
        try {
          conn.socket.destroy();
        } catch {
          // ignore
        }
      }
      conn.connected = false;
      conn.socket = null;
      conn.client = null;
      return null;
    }

    return state;
  }

  async setDeviceState(deviceId: string, state: Partial<DeviceState>): Promise<boolean> {
    const connected = await this.ensureConnection(deviceId);
    if (!connected) {
      return false;
    }

    const conn = this.connections.get(deviceId);
    if (!conn || !conn.client) {
      return false;
    }

    const registerMap = Array.isArray(conn.config.registerMap) && conn.config.registerMap.length > 0 ? conn.config.registerMap : S7_200_SMART_DEFAULT_MAP;

    for (const [property, value] of Object.entries(state)) {
      if (property === 'deviceId') continue;

      const mapping = registerMap.find(m => m.property === property);
      if (!mapping || !mapping.writable) {
        logger.warn(`Property ${property} is not writable on ${deviceId}`);
        continue;
      }

      try {
        await this.writeRegister(conn.client, mapping, value);
        conn.lastRead.set(property, value);
        logger.info(`Set ${property}=${value} on ${deviceId}`);
      } catch (error) {
        logger.error(`Failed to write ${property} to ${deviceId}: ${(error as Error).message}`);
        return false;
      }
    }

    return true;
  }

  async updateFirmware(_deviceId: string, _version: string): Promise<boolean> {
    logger.warn('Firmware update for PLC should be done via PLC programming software');
    return false;
  }

  /**
   * 读取寄存器
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async readRegister(client: ModbusTCPClient, mapping: RegisterMapping): Promise<any> {
    switch (mapping.type) {
      case 'coil': {
        const result = await client.readCoils(mapping.address, mapping.quantity);
        const coils = result.response.body.valuesAsArray;
        if (mapping.dataType === 'bool') {
          return coils?.[0] ?? false;
        }
        return coils;
      }
      case 'discrete': {
        const result = await client.readDiscreteInputs(mapping.address, mapping.quantity);
        const inputs = result.response.body.valuesAsArray;
        if (mapping.dataType === 'bool') {
          return inputs?.[0] ?? false;
        }
        return inputs;
      }
      case 'holding': {
        const result = await client.readHoldingRegisters(mapping.address, this.getRegisterCount(mapping));
        const values = Array.from(result.response.body.valuesAsArray ?? []);
        return this.decodeValue(values, mapping);
      }
      case 'input': {
        const result = await client.readInputRegisters(mapping.address, this.getRegisterCount(mapping));
        const values = Array.from(result.response.body.valuesAsArray ?? []);
        return this.decodeValue(values, mapping);
      }
      default:
        throw new Error(`Unknown register type: ${mapping.type}`);
    }
  }

  /**
   * 写入寄存器
   */
  private async writeRegister(client: ModbusTCPClient, mapping: RegisterMapping, value: unknown): Promise<void> {
    switch (mapping.type) {
      case 'coil':
        await client.writeSingleCoil(mapping.address, Boolean(value));
        break;
      case 'holding': {
        const numValue = Number(value);
        if (mapping.scale) {
          const scaled = Math.round(numValue / mapping.scale);
          await client.writeSingleRegister(mapping.address, scaled);
        } else {
          await client.writeSingleRegister(mapping.address, numValue);
        }
        break;
      }
      default:
        throw new Error(`Cannot write to ${mapping.type} register`);
    }
  }

  async writeMultipleCoils(deviceId: string, address: number, values: boolean[]): Promise<void> {
    const connected = await this.ensureConnection(deviceId);
    if (!connected) {
      throw new Error('Device not connected');
    }
    const conn = this.connections.get(deviceId);
    if (!conn || !conn.client) {
      throw new Error('Device not found');
    }
    await conn.client.writeMultipleCoils(address, values);
  }

  async writeMultipleRegisters(deviceId: string, address: number, values: number[]): Promise<void> {
    const connected = await this.ensureConnection(deviceId);
    if (!connected) {
      throw new Error('Device not connected');
    }
    const conn = this.connections.get(deviceId);
    if (!conn || !conn.client) {
      throw new Error('Device not found');
    }
    await conn.client.writeMultipleRegisters(address, values);
  }

  private getRegisterCount(mapping: RegisterMapping): number {
    switch (mapping.dataType) {
      case 'bool': return 1;
      case 'int16':
      case 'uint16': return 1;
      case 'float32': return 2;
      case 'string': return mapping.quantity;
      default: return mapping.quantity;
    }
  }

  private decodeValue(values: number[], mapping: RegisterMapping): unknown {
    if (!values || values.length === 0) return null;

    switch (mapping.dataType) {
      case 'bool':
        return values[0] !== 0;
      case 'int16':
        return values[0] > 32767 ? values[0] - 65536 : values[0];
      case 'uint16':
        return values[0];
      case 'float32': {
        const buf = Buffer.alloc(4);
        buf.writeUInt16BE(values[0] ?? 0, 0);
        buf.writeUInt16BE(values[1] ?? 0, 2);
        return buf.readFloatBE(0);
      }
      case 'string': {
        const buf = Buffer.alloc(values.length * 2);
        values.forEach((v, i) => buf.writeUInt16BE(v, i * 2));
        return buf.toString('ascii').replace(/\0/g, '');
      }
      default:
        return values[0];
    }
  }

  /**
   * 断开设备连接
   */
  disconnectDevice(deviceId: string): void {
    const conn = this.connections.get(deviceId);
    if (conn?.socket) {
      try {
        conn.socket.destroy();
      } catch {
        // ignore
      }
      conn.socket = null;
      conn.client = null;
      conn.connected = false;
    }
  }

  isDeviceConnected(deviceId: string): boolean {
    return this.connections.get(deviceId)?.connected ?? false;
  }

  getDeviceRegisterMap(deviceId: string): RegisterMapping[] {
    const conn = this.connections.get(deviceId);
    if (!conn) return [];
    return conn.config.registerMap.length > 0 ? conn.config.registerMap : S7_200_SMART_DEFAULT_MAP;
  }

  async readRawRegister(deviceId: string, type: 'coil' | 'discrete' | 'holding' | 'input', address: number, quantity: number = 1): Promise<unknown> {
    const connected = await this.ensureConnection(deviceId);
    if (!connected) {
      throw new Error('Device not connected');
    }

    const conn = this.connections.get(deviceId);
    if (!conn || !conn.client) {
      throw new Error('Device not found');
    }

    const mapping: RegisterMapping = {
      property: 'raw',
      type,
      address,
      quantity,
      dataType: quantity === 1 ? 'uint16' : 'uint16',
      writable: false,
    };

    return this.readRegister(conn.client, mapping);
  }

  async writeRawRegister(deviceId: string, type: 'coil' | 'holding', address: number, value: boolean | number): Promise<boolean> {
    const connected = await this.ensureConnection(deviceId);
    if (!connected) {
      throw new Error('Device not connected');
    }

    const conn = this.connections.get(deviceId);
    if (!conn || !conn.client) {
      throw new Error('Device not found');
    }

    const mapping: RegisterMapping = {
      property: 'raw',
      type,
      address,
      quantity: 1,
      dataType: type === 'coil' ? 'bool' : 'uint16',
      writable: true,
    };

    await this.writeRegister(conn.client, mapping, value);
    return true;
  }
}

export { ModbusDeviceConfig, RegisterMapping, S7_200_SMART_DEFAULT_MAP };
 
