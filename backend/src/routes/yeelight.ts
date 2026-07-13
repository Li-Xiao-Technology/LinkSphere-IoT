import { Router, Request, Response } from 'express';
import { ProtocolManager } from '../protocols/ProtocolManager';
import { YeelightDeviceConfig } from '../protocols/YeelightAdapter';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';
import { DeviceManager } from '../managers/DeviceManager';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { auditLogMiddleware } from '../middleware/auditLog';

const router = Router();

/**
 * SSDP 自动发现局域网中的 Yeelight 设备
 * GET /api/yeelight/discover
 */
router.get('/discover', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const yeelightAdapter = ProtocolManager.getInstance().getYeelightAdapter();
    const devices = await yeelightAdapter.discoverDevices();

    // 保存到数据库
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
          config: device.config || null,
          updatedAt: new Date(),
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
          config: device.config || null,
        },
      });

      const deviceManager = DeviceManager.getInstance();
      deviceManager.addDevice(device);
    }

    res.json({ count: devices.length, devices });
  } catch (error) {
    logger.error('Yeelight discovery failed', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 手动添加 Yeelight 设备
 * POST /api/yeelight/devices
 */
router.post('/devices', authMiddleware, requirePermission('device.create'), auditLogMiddleware('yeelight.create', 'yeelight'), async (req: Request, res: Response) => {
  try {
    const { name, host, port, model } = req.body;

    if (!host) {
      res.status(400).json({ error: 'host (IP地址) 是必填项' });
      return;
    }

    const config: YeelightDeviceConfig = {
      host,
      port: port || 55443,
      model: model || 'XMCTD01YL',
      name,
    };

    const deviceId = `yeelight-${host.replace(/\./g, '-')}`;
    const yeelightAdapter = ProtocolManager.getInstance().getYeelightAdapter();

    const device = await yeelightAdapter.addDevice(deviceId, config);
    if (!device) {
      res.status(500).json({ error: '无法连接到 Yeelight 设备' });
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
        model: device.model || null,
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
        model: device.model || null,
        status: device.status,
        connectionType: device.connectionType,
        ipAddress: device.ipAddress || null,
        config: device.config || null,
      },
    });

    logger.info(`Yeelight device added: ${deviceId} (${host})`);

    const deviceManager = DeviceManager.getInstance();
    deviceManager.addDevice(device);

    res.json(device);
  } catch (error) {
    logger.error('Failed to add Yeelight device', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 测试 Yeelight 连接
 * POST /api/yeelight/test-connection
 */
router.post('/test-connection', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { host, port } = req.body;

    if (!host) {
      res.status(400).json({ error: 'host 是必填项' });
      return;
    }

    const config: YeelightDeviceConfig = {
      host,
      port: port || 55443,
    };

    const yeelightAdapter = ProtocolManager.getInstance().getYeelightAdapter();
    const connected = await yeelightAdapter.testConnection(config);

    res.json({ connected, host, port: config.port });
  } catch (error) {
    logger.error('Yeelight test connection failed', error as Error);
    res.status(500).json({ error: (error as Error).message, connected: false });
  }
});

/**
 * 获取 Yeelight 设备状态
 * GET /api/yeelight/devices/:deviceId/state
 */
router.get('/devices/:deviceId/state', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const deviceManager = DeviceManager.getInstance();
    const state = await deviceManager.getDeviceState(deviceId);

    res.json({ deviceId, state });
  } catch (error) {
    logger.error('Failed to get Yeelight state', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 控制 Yeelight 设备
 * POST /api/yeelight/devices/:deviceId/state
 */
router.post('/devices/:deviceId/state', authMiddleware, requirePermission('device.control'), auditLogMiddleware('yeelight.control', 'yeelight'), async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const state = req.body;

    const deviceManager = DeviceManager.getInstance();
    const success = await deviceManager.setDeviceState(deviceId, state);

    res.json({ deviceId, success });
  } catch (error) {
    logger.error('Failed to set Yeelight state', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 发送原始 Yeelight 命令
 * POST /api/yeelight/devices/:deviceId/command
 */
router.post('/devices/:deviceId/command', authMiddleware, requirePermission('device.control'), auditLogMiddleware('yeelight.command', 'yeelight'), async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { method, params } = req.body;

    if (!method) {
      res.status(400).json({ error: 'method 是必填项' });
      return;
    }

    const yeelightAdapter = ProtocolManager.getInstance().getYeelightAdapter();
    const result = await (yeelightAdapter as any).sendCommand(deviceId, method, params || []);

    res.json({ deviceId, method, params, result });
  } catch (error) {
    logger.error('Failed to send Yeelight command', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 删除 Yeelight 设备
 * DELETE /api/yeelight/devices/:deviceId
 */
router.delete('/devices/:deviceId', authMiddleware, requirePermission('device.delete'), auditLogMiddleware('yeelight.delete', 'yeelight'), async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const yeelightAdapter = ProtocolManager.getInstance().getYeelightAdapter();
    yeelightAdapter.disconnectDevice(deviceId);

    const deviceManager = DeviceManager.getInstance();
    const success = await deviceManager.removeDevice(deviceId);

    res.json({ deviceId, success });
  } catch (error) {
    logger.error('Failed to remove Yeelight device', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
