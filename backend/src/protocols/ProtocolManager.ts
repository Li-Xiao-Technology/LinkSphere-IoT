import { ProtocolAdapter } from '../types';
import { ModbusTCPAdapter } from './ModbusTCPAdapter';
import { MqttAdapter } from './MqttAdapter';
import { YeelightAdapter } from './YeelightAdapter';
import { YeelightBLEAdapter } from './YeelightBLEAdapter';
import { S7Adapter } from './S7Adapter';
import { MiioAdapter } from './MiioAdapter';
import { logger } from '../utils/logger';

export interface PluginInfo {
  brand: string;
  version: string;
  description: string;
  isBuiltIn: boolean;
}

export class ProtocolManager {
  private static instance: ProtocolManager;
  private adapters: Map<string, ProtocolAdapter> = new Map();
  private pluginInfo: Map<string, PluginInfo> = new Map();
  private modbusAdapter: ModbusTCPAdapter;
  private mqttAdapter: MqttAdapter;
  private yeelightAdapter: YeelightAdapter;
  private yeelightBLEAdapter: YeelightBLEAdapter;
  private s7Adapter: S7Adapter;
  private miioAdapter: MiioAdapter;

  private constructor() {
    // 注册内置适配器（仅生产级真实协议适配器）
    this.modbusAdapter = new ModbusTCPAdapter();
    this.registerAdapter(this.modbusAdapter, { version: '2.0.0', description: 'Modbus TCP 工业设备适配器' });
    this.mqttAdapter = new MqttAdapter();
    this.registerAdapter(this.mqttAdapter, { version: '1.0.0', description: 'MQTT 协议适配器' });
    this.yeelightAdapter = new YeelightAdapter();
    this.registerAdapter(this.yeelightAdapter, { version: '1.0.0', description: 'Yeelight Wi-Fi 灯具适配器' });
    this.yeelightBLEAdapter = new YeelightBLEAdapter();
    this.registerAdapter(this.yeelightBLEAdapter, { version: '1.0.0', description: 'Yeelight BLE 灯具适配器' });
    this.s7Adapter = new S7Adapter();
    this.registerAdapter(this.s7Adapter, { version: '2.0.0', description: 'Siemens S7 PLC 适配器' });
    this.miioAdapter = new MiioAdapter();
    this.registerAdapter(this.miioAdapter, { version: '1.0.0', description: '米家设备 miIO 协议适配器' });

    logger.info(`ProtocolManager initialized with ${this.adapters.size} adapters: ${this.getSupportedBrands().join(', ')}`);
  }

  public static getInstance(): ProtocolManager {
    if (!ProtocolManager.instance) {
      ProtocolManager.instance = new ProtocolManager();
    }
    return ProtocolManager.instance;
  }

  /**
   * 注册协议适配器（支持外部插件动态注册）
   */
  public registerAdapter(adapter: ProtocolAdapter, info?: { version?: string; description?: string }): void {
    this.adapters.set(adapter.brand, adapter);
    this.pluginInfo.set(adapter.brand, {
      brand: adapter.brand,
      version: info?.version || 'unknown',
      description: info?.description || '',
      isBuiltIn: false,
    });
    logger.info(`Protocol adapter registered: ${adapter.brand}`);
  }

  public getAdapter(brand: string): ProtocolAdapter | undefined {
    return this.adapters.get(brand);
  }

  public getAllAdapters(): ProtocolAdapter[] {
    return Array.from(this.adapters.values());
  }

  public getSupportedBrands(): string[] {
    return Array.from(this.adapters.keys());
  }

  public getPluginInfo(): PluginInfo[] {
    return Array.from(this.pluginInfo.values());
  }

  public unregisterAdapter(brand: string): boolean {
    const existed = this.adapters.delete(brand);
    this.pluginInfo.delete(brand);
    if (existed) {
      logger.info(`Protocol adapter unregistered: ${brand}`);
    }
    return existed;
  }

  public getModbusAdapter(): ModbusTCPAdapter {
    return this.modbusAdapter;
  }

  public getMqttAdapter(): MqttAdapter {
    return this.mqttAdapter;
  }

  public getYeelightAdapter(): YeelightAdapter {
    return this.yeelightAdapter;
  }

  public getYeelightBLEAdapter(): YeelightBLEAdapter {
    return this.yeelightBLEAdapter;
  }

  public getS7Adapter(): S7Adapter {
    return this.s7Adapter;
  }

  public getMiioAdapter(): MiioAdapter {
    return this.miioAdapter;
  }
}