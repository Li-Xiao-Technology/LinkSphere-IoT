import { ProtocolAdapter, Device, DeviceState } from '../types';
import { logger } from '../utils/logger';
import * as mqtt from 'mqtt';

interface MqttDeviceConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  clientId?: string;
  topicPrefix?: string;
  qos?: 0 | 1 | 2;
}

interface PublishOptions {
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

interface MqttConnection {
  config: MqttDeviceConfig;
  client: mqtt.MqttClient | null;
  connected: boolean;
  subscribedTopics: string[];
  lastRead: Map<string, unknown>;
}

export class MqttAdapter implements ProtocolAdapter {
  brand = 'mqtt';
  private connections: Map<string, MqttConnection> = new Map();
  private globalClient: mqtt.MqttClient | null = null;

  async discoverDevices(): Promise<Device[]> {
    const devices: Device[] = [];
    for (const [deviceId, conn] of this.connections) {
      devices.push({
        id: deviceId,
        name: `MQTT Device ${conn.config.host}`,
        brand: 'mqtt',
        type: 'sensor',
        status: conn.connected ? 'online' : 'offline',
        connectionType: 'wifi',
        ipAddress: conn.config.host,
        config: JSON.stringify(conn.config),
      });
    }

    const discovered = await this.scanLocalNetwork();
    discovered.forEach(device => {
      if (!this.connections.has(device.id)) {
        devices.push(device);
        this.connections.set(device.id, {
          config: JSON.parse(device.config || '{}') as MqttDeviceConfig,
          client: null,
          connected: false,
          subscribedTopics: [],
          lastRead: new Map(),
        });
      }
    });

    return devices;
  }

  private async scanLocalNetwork(): Promise<Device[]> {
    const devices: Device[] = [];
    const commonPorts = [1883, 8883, 1884];
    const localIps = await this.getLocalIps();

    for (const ipPrefix of localIps) {
      const scanPromises = [];
      for (let i = 1; i <= 254; i++) {
        for (const port of commonPorts) {
          scanPromises.push(this.testMqttConnection(`${ipPrefix}.${i}`, port));
        }
      }

      const results = await Promise.allSettled(scanPromises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const { host, port } = result.value;
          devices.push({
            id: `mqtt-${host}-${port}`,
            name: `MQTT Device ${host}:${port}`,
            brand: 'mqtt',
            type: 'sensor',
            status: 'online',
            connectionType: 'wifi',
            ipAddress: host,
            config: JSON.stringify({ host, port }),
          });
        }
      }
    }

    return devices;
  }

  private async getLocalIps(): Promise<string[]> {
    const { networkInterfaces } = await import('os');
    const interfaces = networkInterfaces();
    const ipPrefixes = new Set<string>();

    for (const iface of Object.values(interfaces)) {
      for (const addr of iface || []) {
        if (addr.family === 'IPv4' && !addr.internal) {
          const parts = addr.address.split('.');
          if (parts.length === 4) {
            ipPrefixes.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
          }
        }
      }
    }

    return Array.from(ipPrefixes);
  }

  private async testMqttConnection(host: string, port: number): Promise<{ host: string; port: number } | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null);
      }, 500);

      const socket = require('net').createConnection(port, host, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ host, port });
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(null);
      });
    });
  }

  async addDevice(deviceId: string, config: MqttDeviceConfig): Promise<Device | null> {
    const conn: MqttConnection = {
      config,
      client: null,
      connected: false,
      subscribedTopics: [],
      lastRead: new Map(),
    };
    this.connections.set(deviceId, conn);

    const connected = await this.connectDevice(deviceId);
    if (connected) {
      logger.info(`MQTT device connected: ${config.host}:${config.port}`);
    }

    return {
      id: deviceId,
      name: `MQTT Device ${config.host}`,
      brand: 'mqtt',
      type: 'sensor',
      status: connected ? 'online' : 'offline',
      connectionType: 'wifi',
      ipAddress: config.host,
      config: JSON.stringify(config),
    };
  }

  private async connectDevice(deviceId: string): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn) return false;

    if (conn.client) {
      try {
        conn.client.end();
      } catch {
        // ignore
      }
      conn.client = null;
    }

    const { host, port, username, password, clientId, topicPrefix } = conn.config;
    const url = `mqtt://${host}:${port}`;

    return new Promise((resolve) => {
      const client = mqtt.connect(url, {
        clientId: clientId || `iot-platform-${deviceId}`,
        username,
        password,
        clean: true,
        connectTimeout: 5000,
        keepalive: 60,
      });

      const timeout = setTimeout(() => {
        client.end();
        conn.connected = false;
        conn.client = null;
        resolve(false);
      }, 5000);

      client.on('connect', () => {
        clearTimeout(timeout);
        conn.connected = true;
        conn.client = client;
        logger.info(`MQTT client connected: ${url}`);

        const stateTopic = `${topicPrefix || 'iot'}/${deviceId}/state`;
        const commandTopic = `${topicPrefix || 'iot'}/${deviceId}/command`;

        client.subscribe([stateTopic, commandTopic], (err) => {
          if (!err) {
            conn.subscribedTopics = [stateTopic, commandTopic];
            logger.info(`MQTT subscribed to topics: ${stateTopic}, ${commandTopic}`);
          }
        });

        client.on('message', (topic, message) => {
          try {
            const payload = JSON.parse(message.toString());
            if (topic.includes('/state')) {
              conn.lastRead.set('state', payload);
              Object.entries(payload).forEach(([key, value]) => {
                conn.lastRead.set(key, value);
              });
            }
          } catch (e) {
            logger.warn(`Failed to parse MQTT message: ${message.toString()}`);
          }
        });

        client.on('error', (err) => {
          logger.error(`MQTT client error for ${deviceId}: ${err.message}`);
        });

        client.on('close', () => {
          conn.connected = false;
          logger.info(`MQTT client disconnected: ${url}`);
        });

        resolve(true);
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        conn.connected = false;
        conn.client = null;
        logger.error(`MQTT connection error for ${deviceId}: ${err.message}`);
        resolve(false);
      });
    });
  }

  async getDeviceState(deviceId: string): Promise<DeviceState | null> {
    const conn = this.connections.get(deviceId);
    if (!conn) return null;

    if (!conn.connected) {
      const reconnected = await this.connectDevice(deviceId);
      if (!reconnected) {
        return null;
      }
    }

    const state: DeviceState = { deviceId };
    conn.lastRead.forEach((value, key) => {
      if (key !== 'state') {
        state[key] = value;
      }
    });

    return Object.keys(state).length > 1 ? state : null;
  }

  async setDeviceState(deviceId: string, state: Partial<DeviceState>): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn || !conn.client || !conn.connected) {
      return false;
    }

    const { topicPrefix } = conn.config;
    const commandTopic = `${topicPrefix || 'iot'}/${deviceId}/command`;

    try {
      const payload = JSON.stringify(state);
      const publishQos = (conn.config.qos || 1) as 0 | 1 | 2;
      await conn.client.publish(commandTopic, payload, { qos: publishQos, retain: false });
      logger.info(`MQTT published to ${commandTopic}: ${payload}`);

      Object.entries(state).forEach(([key, value]) => {
        if (key !== 'deviceId') {
          conn.lastRead.set(key, value);
        }
      });

      return true;
    } catch (error) {
      logger.error(`Failed to publish MQTT message for ${deviceId}`, error as Error);
      return false;
    }
  }

  async updateFirmware(deviceId: string, version: string): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn || !conn.client || !conn.connected) {
      return false;
    }

    const { topicPrefix } = conn.config;
    const firmwareTopic = `${topicPrefix || 'iot'}/${deviceId}/firmware`;

    try {
      const payload = JSON.stringify({ version, action: 'update' });
      await conn.client.publish(firmwareTopic, payload, { qos: 1 });
      logger.info(`MQTT firmware update request sent to ${deviceId}: ${version}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send firmware update via MQTT for ${deviceId}`, error as Error);
      return false;
    }
  }

  disconnectDevice(deviceId: string): void {
    const conn = this.connections.get(deviceId);
    if (conn?.client) {
      try {
        conn.client.end();
      } catch {
        // ignore
      }
      conn.client = null;
      conn.connected = false;
    }
  }

  isDeviceConnected(deviceId: string): boolean {
    return this.connections.get(deviceId)?.connected ?? false;
  }

  async publishMessage(deviceId: string, topic: string, payload: unknown, options?: PublishOptions): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn || !conn.client || !conn.connected) {
      return false;
    }

    try {
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const publishQos = (options?.qos || conn.config.qos || 1) as 0 | 1 | 2;
      await conn.client.publish(topic, message, { qos: publishQos, retain: options?.retain || false });
      logger.info(`MQTT published to ${topic}: ${message}`);
      return true;
    } catch (error) {
      logger.error(`Failed to publish MQTT message to ${topic}`, error as Error);
      return false;
    }
  }

  async subscribeTopic(deviceId: string, topic: string): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn || !conn.client || !conn.connected) {
      return false;
    }

    try {
      await conn.client.subscribe(topic);
      if (!conn.subscribedTopics.includes(topic)) {
        conn.subscribedTopics.push(topic);
      }
      logger.info(`MQTT subscribed to topic: ${topic}`);
      return true;
    } catch (error) {
      logger.error(`Failed to subscribe MQTT topic: ${topic}`, error as Error);
      return false;
    }
  }

  async unsubscribeTopic(deviceId: string, topic: string): Promise<boolean> {
    const conn = this.connections.get(deviceId);
    if (!conn || !conn.client || !conn.connected) {
      return false;
    }

    try {
      await conn.client.unsubscribe(topic);
      conn.subscribedTopics = conn.subscribedTopics.filter(t => t !== topic);
      logger.info(`MQTT unsubscribed from topic: ${topic}`);
      return true;
    } catch (error) {
      logger.error(`Failed to unsubscribe MQTT topic: ${topic}`, error as Error);
      return false;
    }
  }

  getSubscribedTopics(deviceId: string): string[] {
    return this.connections.get(deviceId)?.subscribedTopics || [];
  }

  async testConnection(config: MqttDeviceConfig): Promise<boolean> {
    return new Promise((resolve) => {
      const { host, port, username, password, clientId } = config;
      const url = `mqtt://${host}:${port}`;
      const client = mqtt.connect(url, {
        clientId: clientId || `test-${Date.now()}`,
        username,
        password,
        clean: true,
        connectTimeout: 3000,
        keepalive: 60,
      });

      const timeout = setTimeout(() => {
        client.end();
        resolve(false);
      }, 5000);

      client.on('connect', () => {
        clearTimeout(timeout);
        client.end();
        resolve(true);
      });

      client.on('error', () => {
        clearTimeout(timeout);
        client.end();
        resolve(false);
      });
    });
  }
}

export { MqttDeviceConfig, MqttConnection };