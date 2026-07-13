import { ProtocolAdapter, Device, DeviceState } from '../types';
import { logger } from '../utils/logger';

// Yeelight BLE 协议常量
// 基于 XMCTD01YL 床头灯逆向工程协议
const YEELIGHT_SERVICE_UUID = 'fe87';
const YEELIGHT_CONTROL_UUID = 'aa7d3f342d4f41e0807f52fbf8cf7443';
const YEELIGHT_NOTIFY_UUID = '8f65073d9f574aaaafea397d19d5bbeb';

// 控制指令
const CMD_POWER_ON = Buffer.from([0x43, 0x40, 0x01]);
const CMD_POWER_OFF = Buffer.from([0x43, 0x40, 0x02]);
const CMD_PAIR = Buffer.from([0x43, 0x67, 0x02]);

// 亮度指令 (1-64)
const CMD_BRIGHTNESS = (value: number) => Buffer.from([0x43, 0x42, value]);

// 色温指令 (1-16, 低=暖, 高=冷)
const CMD_COLOR_TEMP = (value: number) => Buffer.from([0x43, 0x43, value]);

// 延时关灯指令 (单位: 分钟, 0=取消)
const CMD_DELAY_OFF = (minutes: number) => {
  const msb = Math.floor(minutes / 256);
  const lsb = minutes % 256;
  return Buffer.from([0x43, 0x44, msb, lsb]);
};

// 模式切换指令
const MODE_READING = Buffer.from([0x43, 0x45, 0x01]);
const MODE_SLEEP = Buffer.from([0x43, 0x45, 0x02]);
const MODE_NIGHT = Buffer.from([0x43, 0x45, 0x03]);
const MODE_COLOR = Buffer.from([0x43, 0x45, 0x04]);
const MODE_BRIGHT = Buffer.from([0x43, 0x45, 0x05]);

// 定时关闭查询指令
const CMD_QUERY_DELAY = Buffer.from([0x43, 0x46, 0x00]);

/* eslint-disable @typescript-eslint/no-explicit-any */

interface BLEConnection {
  peripheral: any;
  controlCharacteristic: any | null;
  notifyCharacteristic: any | null;
  connected: boolean;
  paired: boolean;
  lastState: Map<string, unknown>;
}

export interface YeelightBLEDeviceConfig {
  macAddress: string;
  name?: string;
}

export class YeelightBLEAdapter implements ProtocolAdapter {
  brand = 'yeelight-ble';
  private noble: any = null;
  private connections: Map<string, BLEConnection> = new Map();
  private nobleReady = false;

  constructor() {
    this.initNoble();
  }

  private async initNoble(): Promise<void> {
    try {
      // 动态导入 noble-winrt，Windows 10+ 原生 BLE 支持
      const nobleModule = await import('noble-winrt');
      this.noble = nobleModule.default || nobleModule;

      this.noble.on('stateChange', (state: string) => {
        if (state === 'poweredOn') {
          this.nobleReady = true;
          logger.info('Yeelight BLE adapter ready - Bluetooth powered on');
        } else {
          this.nobleReady = false;
          logger.warn(`Yeelight BLE adapter state: ${state}`);
        }
      });

      this.noble.on('warning', (message: string) => {
        logger.warn(`Yeelight BLE warning: ${message}`);
      });

      logger.info('Yeelight BLE adapter initialized with noble-winrt');
    } catch (error) {
      logger.error('Failed to initialize noble-winrt', error as Error);
      logger.info('Yeelight BLE adapter will operate in degraded mode - BLE scanning unavailable');
    }
  }

  private async waitForReady(timeoutMs = 10000): Promise<boolean> {
    if (this.nobleReady) return true;
    if (!this.noble) return false;

    const start = Date.now();
    while (!this.nobleReady && Date.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return this.nobleReady;
  }

  async debugScan(timeoutMs = 10000): Promise<{ devices: any[]; count: number }> {
    const ready = await this.waitForReady();
    if (!ready || !this.noble) {
      return { devices: [], count: 0 };
    }

    return new Promise((resolve) => {
      const devices: any[] = [];
      const seen = new Set<string>();
      let resolved = false;

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        if (this.noble) {
          this.noble.stopScanning();
          this.noble.off('discover', onDiscover);
        }
        logger.info(`Debug BLE scan complete, found ${devices.length} devices`);
        resolve({ devices, count: devices.length });
      };

      const onDiscover = (peripheral: any) => {
        if (!seen.has(peripheral.uuid)) {
          seen.add(peripheral.uuid);
          const adv = peripheral.advertisement || {};
          devices.push({
            uuid: peripheral.uuid,
            address: peripheral.address,
            name: adv.localName || 'Unknown',
            rssi: peripheral.rssi,
            serviceUuids: adv.serviceUuids || [],
          });
          logger.info(`BLE found: ${peripheral.address} (${adv.localName || 'Unknown'}) rssi=${peripheral.rssi}`);
        }
      };

      this.noble.on('discover', onDiscover);
      this.noble.startScanning([], false, (error?: Error) => {
        if (error) {
          logger.error('Debug BLE scan start failed', error);
        }
      });

      setTimeout(cleanup, timeoutMs);
    });
  }

  async discoverDevices(timeoutMs = 5000): Promise<Device[]> {
    const ready = await this.waitForReady();
    if (!ready || !this.noble) {
      logger.warn('BLE not ready, cannot discover devices');
      return [];
    }

    return new Promise((resolve) => {
      const devices: Device[] = [];
      const seen = new Set<string>();
      let resolved = false;

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        if (this.noble) {
          this.noble.stopScanning();
          this.noble.off('discover', onDiscover);
        }
        logger.info(`Yeelight BLE discovery complete, found ${devices.length} devices`);
        resolve(devices);
      };

      const onDiscover = (peripheral: any) => {
        const advServiceUuids = peripheral.advertisement?.serviceUuids || [];
        const isYeelight = advServiceUuids.some(
          (uuid: string) => {
            const low = uuid.toLowerCase();
            return low.includes('fe87') || low.includes('fee7');
          }
        );

        const localName = peripheral.advertisement?.localName || '';
        const isYeelightByName = localName.toLowerCase().includes('yeelight') ||
          localName.toLowerCase().includes('xmctd') ||
          localName.toLowerCase().includes('yl_');

        if ((isYeelight || isYeelightByName) && !seen.has(peripheral.uuid)) {
          seen.add(peripheral.uuid);
          const deviceId = `yeelight-ble-${peripheral.uuid}`;
          
          const conn: BLEConnection = {
            peripheral,
            controlCharacteristic: null,
            notifyCharacteristic: null,
            connected: false,
            paired: false,
            lastState: new Map(),
          };
          this.connections.set(deviceId, conn);
          
          this.connectDevice(deviceId).then((connected) => {
            if (connected) {
              logger.info(`Yeelight BLE auto-connected: ${deviceId}`);
              // 自动发起配对，否则连接会被系统断开
              this.pairDevice(deviceId).then((paired) => {
                if (paired) {
                  logger.info(`Yeelight BLE auto-paired: ${deviceId}`);
                } else {
                  logger.warn(`Yeelight BLE auto-pair failed: ${deviceId}, connection may be unstable`);
                }
              }).catch((error) => {
                logger.warn(`Yeelight BLE auto-pair error: ${deviceId}`, error);
              });
            }
          }).catch((error) => {
            logger.warn(`Yeelight BLE auto-connect failed for ${deviceId}:`, error);
          });

          const device: Device = {
            id: deviceId,
            name: localName || `Yeelight BLE ${peripheral.address}`,
            brand: 'yeelight-ble',
            type: 'light',
            model: 'XMCTD01YL',
            status: 'online',
            connectionType: 'bluetooth',
            ipAddress: peripheral.address,
            config: JSON.stringify({ macAddress: peripheral.address }),
          };
          devices.push(device);
          logger.info(`Yeelight BLE discovered: ${peripheral.address} (${localName})`);
        }
      };

      this.noble.on('discover', onDiscover);
      this.noble.startScanning([YEELIGHT_SERVICE_UUID], false, (error?: Error) => {
        if (error) {
          logger.error('BLE scan start failed', error);
        }
      });

      setTimeout(cleanup, timeoutMs);
    });
  }

  async addDevice(deviceId: string, config: YeelightBLEDeviceConfig): Promise<Device | null> {
    const ready = await this.waitForReady();
    if (!ready || !this.noble) {
      logger.warn('BLE not ready, cannot add device');
      return null;
    }

    // 通过扫描找到目标设备
    const peripheral = await this.findPeripheral(config.macAddress);
    if (!peripheral) {
      logger.warn(`Yeelight BLE device not found: ${config.macAddress}`);
      return {
        id: deviceId,
        name: config.name || `Yeelight BLE ${config.macAddress}`,
        brand: 'yeelight-ble',
        type: 'light',
        model: 'XMCTD01YL',
        status: 'offline',
        connectionType: 'bluetooth',
        ipAddress: config.macAddress,
        config: JSON.stringify(config),
      };
    }

    const conn: BLEConnection = {
      peripheral,
      controlCharacteristic: null,
      notifyCharacteristic: null,
      connected: false,
      paired: false,
      lastState: new Map(),
    };
    this.connections.set(deviceId, conn);

    const connected = await this.ensureConnection(deviceId);
    if (connected) {
      logger.info(`Yeelight BLE device connected: ${config.macAddress}`);
      return {
        id: deviceId,
        name: config.name || `Yeelight BLE ${config.macAddress}`,
        brand: 'yeelight-ble',
        type: 'light',
        model: 'XMCTD01YL',
        status: 'online',
        connectionType: 'bluetooth',
        ipAddress: config.macAddress,
        config: JSON.stringify(config),
      };
    }

    return {
      id: deviceId,
      name: config.name || `Yeelight BLE ${config.macAddress}`,
      brand: 'yeelight-ble',
      type: 'light',
      model: 'XMCTD01YL',
      status: 'offline',
      connectionType: 'bluetooth',
      ipAddress: config.macAddress,
      config: JSON.stringify(config),
    };
  }

  private async findPeripheral(macAddress: string, timeoutMs = 10000): Promise<any | null> {
    if (!this.noble) return null;

    return new Promise((resolve) => {
      let found: any = null;

      const onDiscover = (peripheral: any) => {
        if (peripheral.address?.toLowerCase() === macAddress.toLowerCase()) {
          found = peripheral;
          if (this.noble) {
            this.noble.stopScanning();
            this.noble.removeAllListeners('discover');
          }
          resolve(found);
        }
      };

      this.noble.on('discover', onDiscover);
      this.noble.startScanning([], false);

      setTimeout(() => {
        if (this.noble) {
          this.noble.stopScanning();
          this.noble.removeAllListeners('discover');
        }
        resolve(found);
      }, timeoutMs);
    });
  }

  private async ensureConnection(deviceId: string): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn) return false;

    if (conn.connected && conn.controlCharacteristic) {
      return true;
    }

    return this.connectDevice(deviceId);
  }

  private async connectDevice(deviceId: string): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn || !conn.peripheral) return false;

    try {
      // 连接外设
      await new Promise<void>((resolve, reject) => {
        conn.peripheral.connect((error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      conn.connected = true;
      logger.info(`BLE connected to ${deviceId}`);

      // 发现所有服务和特征（不指定UUID，先枚举看看有什么）
      const allServices: any[] = await new Promise((resolve, reject) => {
        conn.peripheral.discoverServices([], (error: Error | null, services: any[]) => {
          if (error) reject(error);
          else resolve(services);
        });
      });

      logger.info(`BLE services on ${deviceId}:`);
      for (const svc of allServices) {
        logger.info(`  Service: ${svc.uuid}`);
      }

      const service = allServices.find((s: any) => {
        const uuid = s.uuid.toLowerCase();
        return uuid.includes('fee7') || uuid.includes('fe87');
      }) || allServices[0];

      if (!service) {
        logger.warn(`No BLE service found on ${deviceId}`);
        return false;
      }

      logger.info(`Using service: ${service.uuid} on ${deviceId}`);

      const characteristics: any[] = await new Promise((resolve, reject) => {
        service.discoverCharacteristics([], (error: Error | null, chars: any[]) => {
          if (error) reject(error);
          else resolve(chars);
        });
      });

      // 打印所有特征，方便调试
      for (const char of characteristics) {
        const uuid = char.uuid.toLowerCase().replace(/-/g, '');
        logger.info(`  Characteristic: ${uuid} properties=[${char.properties.join(',')}]`);
      }

      for (const char of characteristics) {
        const uuid = char.uuid.toLowerCase().replace(/-/g, '');

        if (uuid.includes('aa7d3f34')) {
          conn.controlCharacteristic = char;
          logger.info(`Found control characteristic for ${deviceId}`);
        } else if (uuid.includes('8f65073d')) {
          conn.notifyCharacteristic = char;
          // 订阅通知
          await new Promise<void>((resolve, reject) => {
            char.subscribe((error?: Error) => {
              if (error) reject(error);
              else resolve();
            });
          });
          // 监听状态变化
          char.on('data', (data: Buffer) => {
            this.handleNotification(deviceId, data);
          });
          logger.info(`Subscribed to notifications for ${deviceId}`);
        }
      }

      if (!conn.controlCharacteristic) {
        logger.warn(`Control characteristic not found for ${deviceId}, attempting write on all characteristics`);
        for (const char of characteristics) {
          if (char.properties.includes('write')) {
            conn.controlCharacteristic = char;
            logger.info(`Using fallback write characteristic for ${deviceId}`);
            break;
          }
        }
      }

      // 移除旧的断开监听器，防止重复注册
      conn.peripheral.removeAllListeners('disconnect');
      
      // 监听断开事件，自动重连
      conn.peripheral.on('disconnect', () => {
        conn.connected = false;
        conn.controlCharacteristic = null;
        conn.notifyCharacteristic = null;
        logger.info(`BLE disconnected: ${deviceId}, will reconnect in 5 seconds`);
        
        setTimeout(() => {
          this.reconnectDevice(deviceId).catch((error) => {
            logger.warn(`Reconnect failed for ${deviceId}:`, error);
          });
        }, 5000);
      });

      return conn.controlCharacteristic !== null;
    } catch (error) {
      logger.error(`BLE connection failed for ${deviceId}`, error as Error);
      conn.connected = false;
      return false;
    }
  }

  private async reconnectDevice(deviceId: string): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn) return false;

    logger.info(`Attempting to reconnect ${deviceId}...`);

    const { prisma } = await import('../prisma/client');
    const device = await prisma.device.findUnique({ where: { id: deviceId } });

    if (!device || !device.ipAddress) {
      logger.warn(`Device ${deviceId} not found in database or missing MAC address`);
      return false;
    }

    const config: YeelightBLEDeviceConfig = {
      macAddress: device.ipAddress,
      name: device.name,
    };

    const peripheral = await this.findPeripheral(config.macAddress, 15000);
    if (!peripheral) {
      logger.warn(`Yeelight BLE device not found during reconnect: ${config.macAddress}`);
      return false;
    }

    conn.peripheral = peripheral;

    return this.connectDevice(deviceId);
  }

  private handleNotification(deviceId: string, data: Buffer): void {
    const conn = this.connections.get(deviceId);
    if (!conn) return;

    try {
      if (data.length >= 3 && data[0] === 0x43) {
        const cmd = data[1];

        switch (cmd) {
          case 0x40:
            conn.lastState.set('power', data[2] === 0x01);
            break;
          case 0x42:
            conn.lastState.set('brightness', Math.round((data[2] / 64) * 100));
            break;
          case 0x43:
            conn.lastState.set('colorTemp', Math.round((data[2] / 16) * 100));
            break;
          case 0x44:
            if (data.length >= 4) {
              const delayMinutes = (data[2] << 8) | data[3];
              conn.lastState.set('delayOff', delayMinutes);
            }
            break;
          case 0x45:
            const modeMap: Record<number, string> = {
              0x01: 'reading',
              0x02: 'sleep',
              0x03: 'night',
              0x04: 'color',
              0x05: 'bright',
            };
            conn.lastState.set('mode', modeMap[data[2]] || 'custom');
            break;
          default:
            conn.lastState.set(`cmd_0x${cmd.toString(16)}`, data.slice(2));
        }

        logger.debug(`Yeelight BLE notification: ${deviceId} cmd=0x${cmd.toString(16)} data=${data.slice(2).toString('hex')}`);
      }
    } catch (error) {
      logger.error('Failed to parse BLE notification', error as Error);
    }
  }

  async getDeviceState(deviceId: string): Promise<DeviceState | null> {
    const conn = this.connections.get(deviceId);
    if (!conn || !conn.connected) {
      return null;
    }

    const state: DeviceState = { deviceId };

    const power = conn.lastState.get('power');
    const brightness = conn.lastState.get('brightness');
    const colorTemp = conn.lastState.get('colorTemp');
    const delayOff = conn.lastState.get('delayOff');
    const mode = conn.lastState.get('mode');

    if (power !== undefined) {
      state.power = power as boolean;
    }
    if (brightness !== undefined) {
      state.brightness = brightness as number;
    }
    if (colorTemp !== undefined) {
      state.colorTemp = colorTemp as number;
    }
    if (delayOff !== undefined) {
      state.delayOff = delayOff as number;
    }
    if (mode !== undefined) {
      state.mode = mode as string;
    }

    return state;
  }

  async setDeviceState(deviceId: string, state: Partial<DeviceState>): Promise<boolean> {
    const connected = await this.ensureConnection(deviceId);
    if (!connected) {
      logger.warn(`Yeelight BLE device not connected: ${deviceId}`);
      return false;
    }

    const conn = this.connections.get(deviceId);
    if (!conn || !conn.controlCharacteristic) {
      logger.warn(`No control characteristic for ${deviceId}`);
      return false;
    }

    try {
      for (const [key, value] of Object.entries(state)) {
        if (key === 'deviceId') continue;

        let data: Buffer | null = null;

        switch (key) {
          case 'power': {
            data = value ? CMD_POWER_ON : CMD_POWER_OFF;
            conn.lastState.set('power', !!value);
            break;
          }
          case 'brightness':
          case 'bright': {
            const pct = Math.max(0, Math.min(100, Number(value)));
            const bleBright = pct === 0 ? 0x01 : Math.max(1, Math.min(64, Math.round((pct / 100) * 64)));
            data = CMD_BRIGHTNESS(bleBright);
            conn.lastState.set('brightness', pct);
            break;
          }
          case 'colorTemp':
          case 'ct': {
            const pct = Math.max(0, Math.min(100, Number(value)));
            const bleCt = Math.max(1, Math.min(16, Math.round((pct / 100) * 16)));
            data = CMD_COLOR_TEMP(bleCt);
            conn.lastState.set('colorTemp', pct);
            break;
          }
          case 'delayOff':
          case 'delay': {
            const minutes = Math.max(0, Math.min(65535, Number(value)));
            data = CMD_DELAY_OFF(minutes);
            conn.lastState.set('delayOff', minutes);
            break;
          }
          case 'mode': {
            const modeCmdMap: Record<string, Buffer> = {
              reading: MODE_READING,
              sleep: MODE_SLEEP,
              night: MODE_NIGHT,
              color: MODE_COLOR,
              bright: MODE_BRIGHT,
            };
            data = modeCmdMap[String(value)] || MODE_READING;
            conn.lastState.set('mode', String(value));
            break;
          }
          case 'toggle': {
            const currentPower = conn.lastState.get('power') as boolean | undefined;
            data = currentPower ? CMD_POWER_OFF : CMD_POWER_ON;
            conn.lastState.set('power', !currentPower);
            break;
          }
          default:
            logger.warn(`Unsupported Yeelight BLE property: ${key}`);
        }

        if (data) {
          await this.writeCharacteristic(conn.controlCharacteristic, data);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return true;
    } catch (error) {
      logger.error(`Failed to set Yeelight BLE state for ${deviceId}`, error as Error);
      return false;
    }
  }

  async pairDevice(deviceId: string): Promise<boolean> {
    // 如果设备不在连接列表中，先尝试连接
    if (!this.connections.has(deviceId)) {
      logger.info(`Device ${deviceId} not in connection list, attempting to connect first...`);

      // 从数据库获取设备配置
      const { prisma } = await import('../prisma/client');
      const device = await prisma.device.findUnique({ where: { id: deviceId } });

      if (!device || !device.ipAddress) {
        logger.warn(`Device ${deviceId} not found in database or missing MAC address`);
        return false;
      }

      const config: YeelightBLEDeviceConfig = {
        macAddress: device.ipAddress,
        name: device.name,
      };

      // 先扫描找到设备
      const peripheral = await this.findPeripheral(config.macAddress, 15000);
      if (!peripheral) {
        logger.warn(`Yeelight BLE device not found during pairing: ${config.macAddress}`);
        return false;
      }

      // 添加到连接列表
      const conn: BLEConnection = {
        peripheral,
        controlCharacteristic: null,
        notifyCharacteristic: null,
        connected: false,
        paired: false,
        lastState: new Map(),
      };
      this.connections.set(deviceId, conn);
      logger.info(`Device ${deviceId} found, attempting connection...`);
    }

    const connected = await this.ensureConnection(deviceId);
    if (!connected) {
      logger.warn(`Failed to connect to ${deviceId} for pairing`);
      return false;
    }

    const conn = this.connections.get(deviceId);
    if (!conn || !conn.controlCharacteristic) return false;

    try {
      // 先确保灯是开着的
      await this.writeCharacteristic(conn.controlCharacteristic, CMD_POWER_ON);
      await new Promise(resolve => setTimeout(resolve, 300));

      // 发送配对命令
      await this.writeCharacteristic(conn.controlCharacteristic, CMD_PAIR);
      conn.paired = false;
      logger.info(`Yeelight BLE pairing initiated for ${deviceId} - waiting for button press (30s)`);

      // 启动心跳防止连接被断开
      const heartbeat = setInterval(async () => {
        try {
          if (conn.connected && conn.controlCharacteristic) {
            // 发送查询指令作为心跳
            await this.writeCharacteristic(conn.controlCharacteristic, CMD_QUERY_DELAY);
          }
        } catch (error) {
          // 忽略心跳错误
        }
      }, 3000);

      // 等待30秒让用户物理确认
      await new Promise(resolve => setTimeout(resolve, 30000));
      clearInterval(heartbeat);

      if (!conn.connected) {
        logger.warn(`Yeelight BLE ${deviceId} disconnected during pairing window`);
        return false;
      }

      // 如果30秒后还连着，认为配对成功
      conn.paired = true;
      logger.info(`Yeelight BLE pairing completed for ${deviceId}`);
      return true;
    } catch (error) {
      logger.error(`Pairing failed for ${deviceId}`, error as Error);
      return false;
    }
  }

  private writeCharacteristic(characteristic: any, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      characteristic.write(data, false, (error?: Error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async updateFirmware(_deviceId: string, _version: string): Promise<boolean> {
    logger.warn('Firmware update for Yeelight BLE should be done via Yeelight App');
    return false;
  }

  disconnectDevice(deviceId: string): void {
    const conn = this.connections.get(deviceId);
    if (conn?.peripheral && conn.connected) {
      try {
        conn.peripheral.disconnect(() => {
          conn.connected = false;
          conn.controlCharacteristic = null;
          conn.notifyCharacteristic = null;
          logger.info(`BLE disconnected: ${deviceId}`);
        });
      } catch {
        // ignore
      }
    }
  }

  isDeviceConnected(deviceId: string): boolean {
    return this.connections.get(deviceId)?.connected ?? false;
  }

  async testConnection(config: YeelightBLEDeviceConfig): Promise<boolean> {
    const ready = await this.waitForReady(5000);
    if (!ready || !this.noble) return false;

    const peripheral = await this.findPeripheral(config.macAddress, 8000);
    return peripheral !== null;
  }

  getLastState(deviceId: string): Map<string, unknown> {
    return this.connections.get(deviceId)?.lastState || new Map();
  }
}
