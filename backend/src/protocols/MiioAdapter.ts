/**
 * 米家设备 miIO 协议适配器
 * 通过局域网 miIO 协议发现和控制小米/米家智能设备
 * 
 * 支持设备类型：
 * - 空气净化器、加湿器
 * - 智能插座、插线板
 * - 扫地机器人
 * - Yeelight 灯具
 * - Aqara 网关及子设备
 * - Philips 灯泡等
 * 
 * 使用前提：
 * - 设备与服务器在同一局域网
 * - 设备需支持 miIO 协议
 * - 部分设备需要获取 Token（如扫地机器人）
 */

import { ProtocolAdapter, Device, DeviceState } from '../types';
import { logger } from '../utils/logger';

// miio 模块类型声明（无官方类型）
interface MiioDevice {
  id: string;
  model?: string;
  address: string;
  port: number;
  token?: string;
  matches(capability: string): boolean;
  on(event: string, callback: (value: unknown) => void): void;
  destroy(): void;
  property(name: string): unknown;
  properties(): Record<string, unknown>;
  setPower?(power: boolean): Promise<boolean>;
  setBrightness?(brightness: number): Promise<boolean>;
  setColorTemperature?(temp: number): Promise<boolean>;
  togglePower?(): Promise<boolean>;
  call(method: string, args: unknown[]): Promise<unknown>;
}

interface MiioBrowser {
  on(event: 'available' | 'unavailable' | 'error', callback: (data: unknown) => void): void;
  stop(): void;
}

interface MiioLibrary {
  devices(options?: { cacheTime?: number; filter?: (reg: unknown) => boolean }): MiioBrowser;
  browse(options?: { cacheTime?: number }): MiioBrowser;
  device(options: { address: string; token?: string }): Promise<MiioDevice>;
}

// 动态导入 miio（CommonJS 模块）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const miio: MiioLibrary = require('miio');

// 设备类型映射
const DEVICE_TYPE_MAP: Record<string, string> = {
  'air-purifier': 'airpurifier',
  'humidifier': 'humidifier',
  'power-strip': 'powerstrip',
  'plug': 'switch',
  'outlet': 'switch',
  'vacuum': 'vacuum',
  'vacuum-cleaner': 'vacuum',
  'light': 'light',
  'bulb': 'light',
  'yeelight': 'light',
  'gateway': 'gateway',
  'sensor': 'sensor',
  'switch': 'switch',
  'sensor_ht': 'sensor',
  'motion': 'sensor',
  'magnet': 'sensor',
};

export class MiioAdapter implements ProtocolAdapter {
  brand = 'miio';
  private browser: MiioBrowser | null = null;
  private devices: Map<string, MiioDevice> = new Map();
  private deviceInfos: Map<string, { id: string; model: string; address: string }> = new Map();
  private discoveryCallbacks: ((devices: Device[]) => void)[] = [];
  private isDiscovering = false;

  /**
   * 发现局域网内的米家设备
   */
  async discoverDevices(): Promise<Device[]> {
    logger.info('[MiioAdapter] Starting device discovery...');
    
    // 停止之前的发现
    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }

    this.isDiscovering = true;
    const discoveredDevices: Device[] = [];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.isDiscovering = false;
        if (this.browser) {
          this.browser.stop();
          this.browser = null;
        }
        logger.info(`[MiioAdapter] Discovery timeout, found ${discoveredDevices.length} devices`);
        resolve(discoveredDevices);
      }, 10000); // 10秒超时

      try {
        this.browser = miio.devices({
          cacheTime: 300, // 5分钟缓存
        });

        this.browser.on('available', (reg: unknown) => {
          const info = reg as { id: string; model?: string; address: string; token?: string; device?: MiioDevice };
          
          // 没有设备实例的跳过
          if (!info.device) {
            logger.debug(`[MiioAdapter] Device ${info.id} hides its token or not connectable`);
            return;
          }

          const device = info.device;
          const model = info.model || device.model || 'unknown';
          
          // 映射设备类型
          const deviceType = this.mapDeviceType(model);
          
          const discoveredDevice: Device = {
            id: `miio-${info.id}`,
            name: `${this.getBrandName(model)} ${this.getDeviceTypeName(model)}`,
            brand: 'miio',
            type: deviceType,
            model: model,
            status: 'online',
            connectionType: 'wifi',
            ipAddress: info.address,
          };

          // 缓存设备实例
          this.devices.set(discoveredDevice.id, device);
          this.deviceInfos.set(discoveredDevice.id, {
            id: info.id,
            model: model,
            address: info.address,
          });

          discoveredDevices.push(discoveredDevice);
          logger.info(`[MiioAdapter] Discovered device: ${model} (${info.id}) at ${info.address}`);
        });

        this.browser.on('unavailable', (reg: unknown) => {
          const info = reg as { id: string };
          const deviceId = `miio-${info.id}`;
          this.devices.delete(deviceId);
          this.deviceInfos.delete(deviceId);
          logger.info(`[MiioAdapter] Device ${info.id} went offline`);
        });

        this.browser.on('error', (err: unknown) => {
          logger.error('[MiioAdapter] Discovery error:', err instanceof Error ? err : new Error(String(err)));
        });
      } catch (error) {
        clearTimeout(timeout);
        this.isDiscovering = false;
        logger.error('[MiioAdapter] Failed to start discovery:', error instanceof Error ? error : new Error(String(error)));
        reject(error);
      }
    });
  }

  /**
   * 获取设备状态
   */
  async getDeviceState(deviceId: string): Promise<DeviceState | null> {
    const device = this.devices.get(deviceId);
    if (!device) {
      logger.warn(`[MiioAdapter] Device ${deviceId} not found in cache`);
      return null;
    }

    try {
      // 获取设备属性
      const props = device.properties() as Record<string, unknown>;
      
      const state: DeviceState = {
        deviceId: deviceId,
      };

      // 根据设备能力映射状态
      if (device.matches('cap:power')) {
        state.power = props.power as boolean ?? false;
      }
      if (device.matches('cap:brightness')) {
        state.brightness = props.brightness as number ?? 0;
      }
      if (device.matches('cap:color-temp')) {
        state.colorTemperature = props.colorTemperature as number;
      }
      if (device.matches('cap:temperature')) {
        state.temperature = props.temperature as number;
      }
      if (device.matches('cap:relative-humidity')) {
        state.humidity = props.humidity as number;
      }
      if (device.matches('cap:pm2.5')) {
        state.pm25 = props.pm2_5 as number;
      }
      if (device.matches('cap:mode')) {
        state.mode = props.mode as string;
      }

      // 额外属性
      if (props.aqi) state.aqi = props.aqi as number;
      if (props.filter_life) state.filterLife = props.filter_life as number;
      if (props.filter_remaining) state.filterRemaining = props.filter_remaining as number;

      return state;
    } catch (error) {
      logger.error(`[MiioAdapter] Failed to get state for ${deviceId}:`, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * 设置设备状态
   */
  async setDeviceState(deviceId: string, state: Partial<DeviceState>): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      logger.warn(`[MiioAdapter] Device ${deviceId} not found in cache`);
      return false;
    }

    try {
      // 电源控制
      if (state.power !== undefined && device.setPower) {
        await device.setPower(state.power);
      } else if (state.power !== undefined && device.togglePower) {
        const currentPower = device.property('power') as boolean;
        if (currentPower !== state.power) {
          await device.togglePower();
        }
      }

      // 亮度控制
      if (state.brightness !== undefined && device.setBrightness) {
        await device.setBrightness(state.brightness);
      }

      // 色温控制
      if (state.colorTemperature !== undefined && state.colorTemperature !== null && device.setColorTemperature) {
        await device.setColorTemperature(state.colorTemperature as number);
      } else if (state.colorTemperature !== undefined && state.colorTemperature !== null) {
        // 尝试通过原始调用设置色温
        await device.call('set_ct_pc', [state.colorTemperature as number, 'smooth', 500]);
      }

      // 模式控制（通过原始调用）
      if (state.mode !== undefined) {
        await device.call('set_mode', [state.mode]);
      }

      logger.info(`[MiioAdapter] Successfully set state for ${deviceId}`);
      return true;
    } catch (error) {
      logger.error(`[MiioAdapter] Failed to set state for ${deviceId}:`, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 固件更新（miio 协议不支持）
   */
  async updateFirmware(_deviceId: string, _version: string): Promise<boolean> {
    logger.warn('[MiioAdapter] Firmware update not supported via miIO protocol');
    return false;
  }

  /**
   * 停止设备发现
   */
  stopDiscovery(): void {
    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }
    this.isDiscovering = false;
  }

  /**
   * 销毁所有设备连接
   */
  destroy(): void {
    this.stopDiscovery();
    for (const device of this.devices.values()) {
      try {
        device.destroy();
      } catch (error) {
        // ignore
      }
    }
    this.devices.clear();
    this.deviceInfos.clear();
  }

  /**
   * 映射设备型号到设备类型
   */
  private mapDeviceType(model: string): string {
    const modelLower = model.toLowerCase();
    
    for (const [key, type] of Object.entries(DEVICE_TYPE_MAP)) {
      if (modelLower.includes(key)) {
        return type;
      }
    }
    
    return 'unknown';
  }

  /**
   * 根据型号获取品牌名
   */
  private getBrandName(model: string): string {
    const modelLower = model.toLowerCase();
    
    if (modelLower.includes('yeelight') || modelLower.startsWith('yeelink.')) return 'Yeelight';
    if (modelLower.includes('zhimi') || modelLower.startsWith('zhimi.')) return '智米';
    if (modelLower.includes('roborock') || modelLower.startsWith('rockrobo.')) return '石头';
    if (modelLower.includes('dreame') || modelLower.startsWith('dreame.')) return '追觅';
    if (modelLower.includes('chuangmi')) return '创米';
    if (modelLower.includes('lumi') || modelLower.includes('aqara')) return 'Aqara';
    
    return '米家';
  }

  /**
   * 根据型号获取设备类型名称
   */
  private getDeviceTypeName(model: string): string {
    const modelLower = model.toLowerCase();
    
    if (modelLower.includes('air') || modelLower.includes('purifier')) return '空气净化器';
    if (modelLower.includes('humidifier')) return '加湿器';
    if (modelLower.includes('vacuum') || modelLower.includes('robot')) return '扫地机器人';
    if (modelLower.includes('plug') || modelLower.includes('outlet')) return '智能插座';
    if (modelLower.includes('power') && modelLower.includes('strip')) return '插线板';
    if (modelLower.includes('light') || modelLower.includes('bulb') || modelLower.includes('lamp')) return '智能灯';
    if (modelLower.includes('gateway')) return '网关';
    if (modelLower.includes('sensor') || modelLower.includes('motion') || modelLower.includes('magnet')) return '传感器';
    if (modelLower.includes('switch')) return '智能开关';
    
    return '设备';
  }
}