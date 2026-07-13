import { Router, Request, Response } from 'express';
import { ProtocolManager } from '../protocols/ProtocolManager';
import { MqttDeviceConfig } from '../protocols/MqttAdapter';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';
import { DeviceManager } from '../managers/DeviceManager';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { auditLogMiddleware } from '../middleware/auditLog';

const router = Router();

router.post('/devices', authMiddleware, requirePermission('device.create'), auditLogMiddleware('mqtt.create', 'mqtt'), async (req: Request, res: Response) => {
  try {
    const { name, host, port, username, password, clientId, topicPrefix, qos } = req.body;

    if (!host) {
      res.status(400).json({ error: 'host (IP地址) 是必填项' });
      return;
    }

    const config: MqttDeviceConfig = {
      host,
      port: port || 1883,
      username,
      password,
      clientId,
      topicPrefix: topicPrefix || 'iot',
      qos: qos || 1,
    };

    const deviceId = `mqtt-${host.replace(/\./g, '-')}-${config.port}`;
    const mqttAdapter = ProtocolManager.getInstance().getAdapter('mqtt');

    if (!mqttAdapter) {
      res.status(500).json({ error: 'MQTT 适配器未初始化' });
      return;
    }

    const device = await (mqttAdapter as any).addDevice(deviceId, config);
    if (!device) {
      res.status(500).json({ error: '无法连接到 MQTT 设备' });
      return;
    }

    if (name) {
      device.name = name;
    }

    await prisma.device.upsert({
      where: { id: deviceId },
      update: {
        name: device.name,
        brand: device.brand,
        type: device.type,
        status: device.status,
        connectionType: device.connectionType,
        ipAddress: device.ipAddress || null,
        config: device.config || null,
        updatedAt: new Date(),
      },
      create: {
        id: deviceId,
        name: device.name,
        brand: device.brand,
        type: device.type,
        status: device.status,
        connectionType: device.connectionType,
        ipAddress: device.ipAddress || null,
        config: device.config || null,
      },
    });

    logger.info(`MQTT device added: ${deviceId} (${host}:${config.port})`);

    const deviceManager = DeviceManager.getInstance();
    deviceManager.addDevice(device);

    res.json(device);
  } catch (error) {
    logger.error('Failed to add MQTT device', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/test-connection', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { host, port, username, password, clientId } = req.body;

    if (!host) {
      res.status(400).json({ error: 'host 是必填项' });
      return;
    }

    const config: MqttDeviceConfig = {
      host,
      port: port || 1883,
      username,
      password,
      clientId,
    };

    const mqttAdapter = ProtocolManager.getInstance().getAdapter('mqtt');
    if (!mqttAdapter) {
      res.status(500).json({ error: 'MQTT 适配器未初始化' });
      return;
    }

    const connected = await (mqttAdapter as any).testConnection(config);

    res.json({ connected, host, port: config.port });
  } catch (error) {
    logger.error('MQTT test connection failed', error as Error);
    res.status(500).json({ error: (error as Error).message, connected: false });
  }
});

router.post('/devices/:deviceId/publish', authMiddleware, requirePermission('device.control'), auditLogMiddleware('mqtt.publish', 'mqtt'), async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { topic, payload, qos, retain } = req.body;

    if (!topic || payload === undefined) {
      res.status(400).json({ error: 'topic 和 payload 是必填项' });
      return;
    }

    const mqttAdapter = ProtocolManager.getInstance().getAdapter('mqtt');
    if (!mqttAdapter) {
      res.status(500).json({ error: 'MQTT 适配器未初始化' });
      return;
    }

    const success = await (mqttAdapter as any).publishMessage(deviceId, topic, payload, { qos, retain });

    res.json({ deviceId, topic, success });
  } catch (error) {
    logger.error('Failed to publish MQTT message', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/devices/:deviceId/subscribe', authMiddleware, requirePermission('device.control'), async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { topic } = req.body;

    if (!topic) {
      res.status(400).json({ error: 'topic 是必填项' });
      return;
    }

    const mqttAdapter = ProtocolManager.getInstance().getAdapter('mqtt');
    if (!mqttAdapter) {
      res.status(500).json({ error: 'MQTT 适配器未初始化' });
      return;
    }

    const success = await (mqttAdapter as any).subscribeTopic(deviceId, topic);

    res.json({ deviceId, topic, success });
  } catch (error) {
    logger.error('Failed to subscribe MQTT topic', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/devices/:deviceId/unsubscribe', authMiddleware, requirePermission('device.control'), async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { topic } = req.body;

    if (!topic) {
      res.status(400).json({ error: 'topic 是必填项' });
      return;
    }

    const mqttAdapter = ProtocolManager.getInstance().getAdapter('mqtt');
    if (!mqttAdapter) {
      res.status(500).json({ error: 'MQTT 适配器未初始化' });
      return;
    }

    const success = await (mqttAdapter as any).unsubscribeTopic(deviceId, topic);

    res.json({ deviceId, topic, success });
  } catch (error) {
    logger.error('Failed to unsubscribe MQTT topic', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/devices/:deviceId/topics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const mqttAdapter = ProtocolManager.getInstance().getAdapter('mqtt');
    if (!mqttAdapter) {
      res.status(500).json({ error: 'MQTT 适配器未初始化' });
      return;
    }

    const topics = (mqttAdapter as any).getSubscribedTopics(deviceId);
    const connected = (mqttAdapter as any).isDeviceConnected(deviceId);

    res.json({ deviceId, connected, topics });
  } catch (error) {
    logger.error('Failed to get MQTT subscribed topics', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/devices/:deviceId/state', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const deviceManager = DeviceManager.getInstance();
    const state = await deviceManager.getDeviceState(deviceId);

    res.json({ deviceId, state });
  } catch (error) {
    logger.error('Failed to get MQTT device state', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/devices/:deviceId/state', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const state = req.body;

    const deviceManager = DeviceManager.getInstance();
    const success = await deviceManager.setDeviceState(deviceId, state);

    res.json({ deviceId, success });
  } catch (error) {
    logger.error('Failed to set MQTT device state', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete('/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const mqttAdapter = ProtocolManager.getInstance().getAdapter('mqtt');
    if (mqttAdapter) {
      (mqttAdapter as any).disconnectDevice(deviceId);
    }

    const deviceManager = DeviceManager.getInstance();
    const success = await deviceManager.removeDevice(deviceId);

    res.json({ deviceId, success });
  } catch (error) {
    logger.error('Failed to remove MQTT device', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;