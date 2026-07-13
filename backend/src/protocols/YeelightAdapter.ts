import { ProtocolAdapter, Device, DeviceState } from '../types';
import { logger } from '../utils/logger';
import { Socket } from 'net';
import { createSocket, RemoteInfo } from 'dgram';

interface YeelightDeviceConfig {
  host: string;
  port: number;
  id?: string;
  model?: string;
  name?: string;
}

interface YeelightConnection {
  config: YeelightDeviceConfig;
  socket: Socket | null;
  connected: boolean;
  lastRead: Map<string, unknown>;
}

interface YeelightProps {
  power?: 'on' | 'off';
  bright?: number;
  ct?: number;
  rgb?: number;
  hue?: number;
  sat?: number;
  color_mode?: number;
  flowing?: number;
  delayoff?: number;
  music_on?: number;
}

// SSDP 发现响应解析
function parseSsdpResponse(data: string): YeelightDeviceConfig | null {
  const lines = data.split('\r\n');
  const headers = new Map<string, string>();

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      headers.set(key, value);
    }
  }

  const location = headers.get('location');
  if (!location || !location.startsWith('yeelight://')) {
    return null;
  }

  const hostPort = location.replace('yeelight://', '');
  const [host, portStr] = hostPort.split(':');
  const id = headers.get('id');
  const model = headers.get('model');

  return {
    host,
    port: parseInt(portStr || '55443', 10),
    id,
    model,
    name: model ? `Yeelight ${model}` : `Yeelight ${host}`,
  };
}

export class YeelightAdapter implements ProtocolAdapter {
  brand = 'yeelight';
  private connections: Map<string, YeelightConnection> = new Map();
  private cmdId = 1;

  async discoverDevices(): Promise<Device[]> {
    const configs = await this.ssdpDiscover();
    const devices: Device[] = [];

    for (const config of configs) {
      const deviceId = config.id || `yeelight-${config.host.replace(/\./g, '-')}`;

      // 建立连接并获取状态
      await this.addDevice(deviceId, config);
      const state = await this.getDeviceState(deviceId);

      devices.push({
        id: deviceId,
        name: config.name || `Yeelight ${config.host}`,
        brand: 'yeelight',
        type: 'light',
        model: config.model || 'XMCTD01YL',
        status: state ? 'online' : 'offline',
        connectionType: 'wifi',
        ipAddress: config.host,
        config: JSON.stringify(config),
      });
    }

    logger.info(`Yeelight discovery complete, found ${devices.length} devices`);
    return devices;
  }

  private ssdpDiscover(timeoutMs = 3000): Promise<YeelightDeviceConfig[]> {
    return new Promise((resolve) => {
      const configs: YeelightDeviceConfig[] = [];
      const seen = new Set<string>();

      const socket = createSocket('udp4');
      const message = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n' +
        'HOST: 239.255.255.250:1982\r\n' +
        'MAN: "ssdp:discover"\r\n' +
        'ST: wifi_bulb\r\n' +
        '\r\n'
      );

      socket.on('message', (msg, rinfo: RemoteInfo) => {
        const data = msg.toString();
        const config = parseSsdpResponse(data);
        if (config && !seen.has(config.host)) {
          seen.add(config.host);
          configs.push(config);
          logger.info(`Yeelight discovered: ${config.host}:${config.port} (${config.model})`);
        }
      });

      socket.on('error', (err) => {
        logger.error('SSDP discovery error', err);
      });

      socket.bind(() => {
        socket.setBroadcast(true);
        socket.send(message, 0, message.length, 1982, '239.255.255.250', (err) => {
          if (err) {
            logger.error('SSDP send error', err);
          }
        });
      });

      setTimeout(() => {
        try {
          socket.close();
        } catch {
          // ignore
        }
        resolve(configs);
      }, timeoutMs);
    });
  }

  async addDevice(deviceId: string, config: YeelightDeviceConfig): Promise<Device | null> {
    const conn: YeelightConnection = {
      config,
      socket: null,
      connected: false,
      lastRead: new Map(),
    };
    this.connections.set(deviceId, conn);

    const connected = await this.ensureConnection(deviceId);
    if (connected) {
      // 获取初始状态
      const state = await this.getDeviceState(deviceId);
      logger.info(`Yeelight device connected: ${config.host}:${config.port}`);

      return {
        id: deviceId,
        name: config.name || `Yeelight ${config.host}`,
        brand: 'yeelight',
        type: 'light',
        model: config.model || 'XMCTD01YL',
        status: state ? 'online' : 'offline',
        connectionType: 'wifi',
        ipAddress: config.host,
        config: JSON.stringify(config),
      };
    }

    return {
      id: deviceId,
      name: config.name || `Yeelight ${config.host}`,
      brand: 'yeelight',
      type: 'light',
      model: config.model || 'XMCTD01YL',
      status: 'offline',
      connectionType: 'wifi',
      ipAddress: config.host,
      config: JSON.stringify(config),
    };
  }

  private async ensureConnection(deviceId: string): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn) return false;

    if (conn.socket && !conn.socket.destroyed && conn.connected) {
      return true;
    }

    conn.connected = false;
    conn.socket = null;

    return this.connectDevice(deviceId);
  }

  private connectDevice(deviceId: string): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn) return Promise.resolve(false);

    if (conn.socket) {
      try {
        conn.socket.destroy();
      } catch {
        // ignore
      }
    }

    return new Promise((resolve) => {
      const socket = new Socket();
      let resolved = false;

      const cleanup = (result: boolean) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        resolve(result);
      };

      const timeout = setTimeout(() => {
        socket.destroy();
        conn.connected = false;
        conn.socket = null;
        cleanup(false);
      }, 5000);

      socket.on('connect', () => {
        conn.connected = true;
        conn.socket = socket;
        cleanup(true);
      });

      socket.on('error', (err) => {
        logger.warn(`Yeelight connection error for ${deviceId}: ${err.message}`);
        cleanup(false);
      });

      socket.on('close', () => {
        conn.connected = false;
        conn.socket = null;
      });

      socket.on('data', (data) => {
        try {
          const text = data.toString();
          const lines = text.split('\r\n').filter(l => l.trim());
          for (const line of lines) {
            const parsed = JSON.parse(line);
            if (parsed.method === 'props') {
              // 设备主动上报状态变化
              const props = parsed.params as YeelightProps;
              Object.entries(props).forEach(([key, value]) => {
                conn.lastRead.set(key, value);
              });
            }
          }
        } catch {
          // ignore parse errors
        }
      });

      socket.connect({ host: conn.config.host, port: conn.config.port || 55443 });
    });
  }

  private async sendCommand(deviceId: string, method: string, params: unknown[]): Promise<unknown> {
    const connected = await this.ensureConnection(deviceId);
    if (!connected) {
      throw new Error('Device not connected');
    }

    const conn = this.connections.get(deviceId);
    if (!conn || !conn.socket) {
      throw new Error('Device not found');
    }

    const id = this.cmdId++;
    const cmd = JSON.stringify({ id, method, params }) + '\r\n';

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 5000);

      const onData = (data: Buffer) => {
        try {
          const text = data.toString();
          const lines = text.split('\r\n').filter(l => l.trim());
          for (const line of lines) {
            const parsed = JSON.parse(line);
            if (parsed.id === id) {
              clearTimeout(timeout);
              conn.socket?.off('data', onData);
              if (parsed.error) {
                reject(new Error(parsed.error.message || 'Command failed'));
              } else {
                resolve(parsed.result);
              }
              return;
            }
          }
        } catch {
          // continue listening
        }
      };

      conn.socket!.on('data', onData);
      conn.socket!.write(cmd, (err) => {
        if (err) {
          clearTimeout(timeout);
          conn.socket?.off('data', onData);
          reject(err);
        }
      });
    });
  }

  async getDeviceState(deviceId: string): Promise<DeviceState | null> {
    try {
      const result = await this.sendCommand(deviceId, 'get_prop', [
        'power', 'bright', 'ct', 'rgb', 'hue', 'sat', 'color_mode', 'flowing', 'delayoff',
      ]);

      if (!Array.isArray(result)) {
        return null;
      }

      const keys = ['power', 'bright', 'ct', 'rgb', 'hue', 'sat', 'color_mode', 'flowing', 'delayoff'];
      const state: DeviceState = { deviceId };

      result.forEach((value, index) => {
        const key = keys[index];
        if (value !== '') {
          if (key === 'power') {
            state.power = value === 'on';
          } else if (key === 'bright' || key === 'ct' || key === 'rgb' || key === 'hue' || key === 'sat' || key === 'color_mode' || key === 'flowing' || key === 'delayoff') {
            const num = parseInt(value as string, 10);
            state[key] = isNaN(num) ? value : num;
          } else {
            state[key] = value;
          }
        }
      });

      // 同步到 lastRead
      const conn = this.connections.get(deviceId);
      if (conn) {
        Object.entries(state).forEach(([key, value]) => {
          if (key !== 'deviceId') {
            conn.lastRead.set(key, value);
          }
        });
      }

      return state;
    } catch (error) {
      logger.error(`Failed to get Yeelight state for ${deviceId}`, error as Error);
      return null;
    }
  }

  async setDeviceState(deviceId: string, state: Partial<DeviceState>): Promise<boolean> {
    try {
      for (const [key, value] of Object.entries(state)) {
        if (key === 'deviceId') continue;

        switch (key) {
          case 'power': {
            const effect = 'smooth';
            const duration = 500;
            await this.sendCommand(deviceId, 'set_power', [value ? 'on' : 'off', effect, duration]);
            break;
          }
          case 'brightness':
          case 'bright': {
            const brightness = Math.max(1, Math.min(100, Number(value)));
            await this.sendCommand(deviceId, 'set_bright', [brightness, 'smooth', 500]);
            break;
          }
          case 'ct': {
            const ct = Math.max(1700, Math.min(6500, Number(value)));
            await this.sendCommand(deviceId, 'set_ct_abx', [ct, 'smooth', 500]);
            break;
          }
          case 'color':
          case 'rgb': {
            let rgbValue: number;
            if (typeof value === 'string' && value.startsWith('#')) {
              rgbValue = parseInt(value.replace('#', ''), 16);
            } else {
              rgbValue = Number(value);
            }
            await this.sendCommand(deviceId, 'set_rgb', [rgbValue, 'smooth', 500]);
            break;
          }
          case 'toggle': {
            await this.sendCommand(deviceId, 'toggle', []);
            break;
          }
          default: {
            logger.warn(`Unsupported Yeelight property: ${key}`);
          }
        }
      }

      // 更新 lastRead
      const conn = this.connections.get(deviceId);
      if (conn) {
        Object.entries(state).forEach(([key, value]) => {
          if (key !== 'deviceId') {
            conn.lastRead.set(key, value);
          }
        });
      }

      return true;
    } catch (error) {
      logger.error(`Failed to set Yeelight state for ${deviceId}`, error as Error);
      return false;
    }
  }

  async updateFirmware(_deviceId: string, _version: string): Promise<boolean> {
    logger.warn('Firmware update for Yeelight should be done via Mi Home app');
    return false;
  }

  disconnectDevice(deviceId: string): void {
    const conn = this.connections.get(deviceId);
    if (conn?.socket) {
      try {
        conn.socket.destroy();
      } catch {
        // ignore
      }
      conn.socket = null;
      conn.connected = false;
    }
  }

  isDeviceConnected(deviceId: string): boolean {
    return this.connections.get(deviceId)?.connected ?? false;
  }

  async testConnection(config: YeelightDeviceConfig): Promise<boolean> {
    const testId = `test-${Date.now()}`;
    await this.addDevice(testId, config);
    const connected = this.isDeviceConnected(testId);
    if (connected) {
      this.disconnectDevice(testId);
      this.connections.delete(testId);
    }
    return connected;
  }

  getLastRead(deviceId: string): Map<string, unknown> {
    return this.connections.get(deviceId)?.lastRead || new Map();
  }
}

export { YeelightDeviceConfig };
