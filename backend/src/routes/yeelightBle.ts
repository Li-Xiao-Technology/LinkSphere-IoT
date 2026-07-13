import { Router, Request, Response } from 'express';
import { ProtocolManager } from '../protocols/ProtocolManager';
import { YeelightBLEDeviceConfig } from '../protocols/YeelightBLEAdapter';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';
import { DeviceManager } from '../managers/DeviceManager';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { auditLogMiddleware } from '../middleware/auditLog';

const router = Router();

/**
 * 调试接口：扫描并列出所有BLE设备的完整服务和特征信息
 * GET /api/yeelight-ble/debug/scan
 */
router.get('/debug/scan', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const bleAdapter = ProtocolManager.getInstance().getYeelightBLEAdapter();
    const result = await bleAdapter.debugScan();
    res.json(result);
  } catch (error) {
    logger.error('Debug scan failed', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * BLE 扫描发现 Yeelight 设备
 * GET /api/yeelight-ble/discover
 */
router.get('/discover', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const bleAdapter = ProtocolManager.getInstance().getYeelightBLEAdapter();
    const devices = await bleAdapter.discoverDevices();

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
    logger.error('Yeelight BLE discovery failed', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 手动添加 Yeelight BLE 设备
 * POST /api/yeelight-ble/devices
 */
router.post('/devices', authMiddleware, requirePermission('device.create'), auditLogMiddleware('yeelightBle.create', 'yeelightBle'), async (req: Request, res: Response) => {
  try {
    const { name, macAddress } = req.body;

    if (!macAddress) {
      res.status(400).json({ error: 'macAddress (蓝牙MAC地址) 是必填项' });
      return;
    }

    const config: YeelightBLEDeviceConfig = {
      macAddress,
      name,
    };

    const deviceId = `yeelight-ble-${macAddress.replace(/:/g, '').toLowerCase()}`;
    const bleAdapter = ProtocolManager.getInstance().getYeelightBLEAdapter();

    const device = await bleAdapter.addDevice(deviceId, config);
    if (!device) {
      res.status(500).json({ error: '无法连接到 Yeelight BLE 设备' });
      return;
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

    logger.info(`Yeelight BLE device added: ${deviceId} (${macAddress})`);

    const deviceManager = DeviceManager.getInstance();
    deviceManager.addDevice(device);

    res.json(device);
  } catch (error) {
    logger.error('Failed to add Yeelight BLE device', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 测试 BLE 连接
 * POST /api/yeelight-ble/test-connection
 */
router.post('/test-connection', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { macAddress } = req.body;

    if (!macAddress) {
      res.status(400).json({ error: 'macAddress 是必填项' });
      return;
    }

    const config: YeelightBLEDeviceConfig = { macAddress };
    const bleAdapter = ProtocolManager.getInstance().getYeelightBLEAdapter();
    const found = await bleAdapter.testConnection(config);

    res.json({ found, macAddress });
  } catch (error) {
    logger.error('Yeelight BLE test connection failed', error as Error);
    res.status(500).json({ error: (error as Error).message, found: false });
  }
});

/**
 * 获取设备状态
 * GET /api/yeelight-ble/devices/:deviceId/state
 */
router.get('/devices/:deviceId/state', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const bleAdapter = ProtocolManager.getInstance().getYeelightBLEAdapter();
    const state = await bleAdapter.getDeviceState(deviceId);

    res.json({ deviceId, state });
  } catch (error) {
    logger.error('Failed to get Yeelight BLE state', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 控制设备
 * POST /api/yeelight-ble/devices/:deviceId/state
 */
router.post('/devices/:deviceId/state', authMiddleware, requirePermission('device.control'), auditLogMiddleware('yeelightBle.control', 'yeelightBle'), async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const state = req.body;

    const deviceManager = DeviceManager.getInstance();
    const success = await deviceManager.setDeviceState(deviceId, state);

    res.json({ deviceId, success });
  } catch (error) {
    logger.error('Failed to set Yeelight BLE state', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 配对设备（需要旋转灯具完成配对）
 * POST /api/yeelight-ble/devices/:deviceId/pair
 */
router.post('/devices/:deviceId/pair', authMiddleware, requirePermission('device.config'), auditLogMiddleware('yeelightBle.config', 'yeelightBle'), async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const bleAdapter = ProtocolManager.getInstance().getYeelightBLEAdapter();
    const success = await bleAdapter.pairDevice(deviceId);

    res.json({
      deviceId,
      success,
      message: success
        ? '配对已发起，请旋转灯具完成配对（30秒内）'
        : '配对失败，请确保设备已连接且处于开机状态',
    });
  } catch (error) {
    logger.error('Failed to pair Yeelight BLE device', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 删除设备
 * DELETE /api/yeelight-ble/devices/:deviceId
 */
router.delete('/devices/:deviceId', authMiddleware, requirePermission('device.delete'), auditLogMiddleware('yeelightBle.delete', 'yeelightBle'), async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const bleAdapter = ProtocolManager.getInstance().getYeelightBLEAdapter();
    bleAdapter.disconnectDevice(deviceId);

    const deviceManager = DeviceManager.getInstance();
    const success = await deviceManager.removeDevice(deviceId);

    res.json({ deviceId, success });
  } catch (error) {
    logger.error('Failed to remove Yeelight BLE device', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
