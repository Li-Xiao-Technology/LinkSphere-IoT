import { Router, Request, Response } from 'express';
import { ProtocolManager } from '../protocols/ProtocolManager';
import { ModbusDeviceConfig, RegisterMapping, S7_200_SMART_DEFAULT_MAP } from '../protocols/ModbusTCPAdapter';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';
import { DeviceManager } from '../managers/DeviceManager';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { auditLogMiddleware } from '../middleware/auditLog';
import { validate } from '../middleware/validate';
import { deviceIdParamSchema, modbusWriteSchema, modbusDeviceCreateSchema } from '../validation/schemas';
import * as os from 'os';

const router = Router();

/**
 * 添加 Modbus TCP 设备
 * POST /api/modbus/devices
 */
router.post('/devices', authMiddleware, validate({ body: modbusDeviceCreateSchema }), async (req: Request, res: Response) => {
  try {
    const { name, host, port, slaveId, model, registerMap } = req.body;

    if (!host) {
      res.status(400).json({ error: 'host (IP地址) 是必填项' });
      return;
    }

    const config: ModbusDeviceConfig = {
      host,
      port: port || 502,
      slaveId: slaveId || 1,
      registerMap: registerMap || S7_200_SMART_DEFAULT_MAP,
    };

    const deviceId = `modbus-${host.replace(/\./g, '-')}-${config.port}-${config.slaveId}`;
    const modbusAdapter = ProtocolManager.getInstance().getModbusAdapter();

    const device = await modbusAdapter.addDevice(deviceId, config);
    if (!device) {
      res.status(500).json({ error: '无法连接到 Modbus TCP 设备' });
      return;
    }

    // 自定义名称
    if (name) {
      device.name = name;
    }
    if (model) {
      device.model = model;
    }

    // 保存到数据库
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

    logger.info(`Modbus TCP device added: ${deviceId} (${host}:${config.port})`);

    // 同步到 DeviceManager
    const deviceManager = DeviceManager.getInstance();
    deviceManager.addDevice(device);

    res.json(device);
  } catch (error) {
    logger.error('Failed to add Modbus TCP device', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 获取本机局域网网段信息
 * GET /api/modbus/network-info
 */
router.get('/network-info', authMiddleware, (_req: Request, res: Response) => {
  try {
    const interfaces = os.networkInterfaces();
    const networks: Array<{ interface: string; ip: string; netmask: string; baseIp: string }> = [];

    for (const [name, ifaceList] of Object.entries(interfaces)) {
      if (!ifaceList) continue;
      for (const iface of ifaceList) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const parts = iface.address.split('.');
          const baseIp = parts.slice(0, 3).join('.');
          networks.push({
            interface: name,
            ip: iface.address,
            netmask: iface.netmask,
            baseIp,
          });
        }
      }
    }

    res.json({
      networks,
      defaultBaseIp: networks.length > 0 ? networks[0].baseIp : '192.168.1',
    });
  } catch (error) {
    logger.error('Failed to get network info', error as Error);
    res.status(500).json({ error: (error as Error).message, defaultBaseIp: '192.168.1' });
  }
});

/**
 * 扫描局域网中的 Modbus TCP 设备
 * POST /api/modbus/scan
 */
router.post('/scan', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { baseIp, port, slaveId } = req.body;
    let localBase = baseIp;

    if (!localBase) {
      const interfaces = os.networkInterfaces();
      for (const ifaceList of Object.values(interfaces)) {
        if (!ifaceList) continue;
        for (const iface of ifaceList) {
          if (iface.family === 'IPv4' && !iface.internal) {
            const parts = iface.address.split('.');
            localBase = parts.slice(0, 3).join('.');
            break;
          }
        }
        if (localBase) break;
      }
    }

    if (!localBase) {
      localBase = '192.168.1';
    }

    const modbusAdapter = ProtocolManager.getInstance().getModbusAdapter();
    const found = await modbusAdapter.scanNetwork(localBase, port || 502, slaveId || 1);

    res.json({ devices: found, baseIp: localBase });
  } catch (error) {
    logger.error('Modbus TCP scan failed', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 获取 Modbus 设备的寄存器映射
 * GET /api/modbus/devices/:deviceId/registers
 */
router.get('/devices/:deviceId/registers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const modbusAdapter = ProtocolManager.getInstance().getModbusAdapter();
    const registerMap = modbusAdapter.getDeviceRegisterMap(deviceId);
    res.json({ registers: registerMap });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 更新 Modbus 设备寄存器映射
 * PUT /api/modbus/devices/:deviceId/registers
 */
router.put('/devices/:deviceId/registers', authMiddleware, requirePermission('device.config'), validate({ params: deviceIdParamSchema }), auditLogMiddleware('modbus.config', 'modbus'), async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { registerMap } = req.body as { registerMap: RegisterMapping[] };

    if (!Array.isArray(registerMap)) {
      res.status(400).json({ error: 'registerMap 必须是数组' });
      return;
    }

    // 更新数据库中的配置
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      res.status(404).json({ error: '设备不存在' });
      return;
    }

    let config: ModbusDeviceConfig;
    try {
      config = device.config ? JSON.parse(device.config) : { host: '', port: 502, slaveId: 1, registerMap: [] };
    } catch (parseError) {
      logger.error(`Failed to parse config for device ${deviceId}`, parseError as Error);
      config = { host: '', port: 502, slaveId: 1, registerMap: [] };
    }
    config.registerMap = registerMap;

    await prisma.device.update({
      where: { id: deviceId },
      data: { config: JSON.stringify(config) },
    });

    logger.info(`Register map updated for ${deviceId}`);
    res.json({ success: true, registerMap });
  } catch (error) {
    logger.error('Failed to update register map', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 读取 Modbus 设备指定寄存器
 * POST /api/modbus/devices/:deviceId/read
 */
router.post('/devices/:deviceId/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { type, address, quantity } = req.body;

    if (!type || address === undefined || !quantity) {
      res.status(400).json({ error: 'type, address, quantity 是必填项' });
      return;
    }

    const deviceManager = DeviceManager.getInstance();
    const state = await deviceManager.getDeviceState(deviceId);

    res.json({ deviceId, state });
  } catch (error) {
    logger.error('Failed to read Modbus registers', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 写入 Modbus 设备指定寄存器
 * POST /api/modbus/devices/:deviceId/write
 */
router.post('/devices/:deviceId/write', authMiddleware, requirePermission('device.control'), auditLogMiddleware('modbus.write', 'modbus'), async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { type, address, values } = req.body;

    if (!type || address === undefined || !values) {
      res.status(400).json({ error: 'type, address, values 是必填项' });
      return;
    }

    const deviceManager = DeviceManager.getInstance();
    const success = await deviceManager.setDeviceState(deviceId, { [type]: values });

    res.json({ success });
  } catch (error) {
    logger.error('Failed to write Modbus registers', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 测试 Modbus TCP 连接
 * POST /api/modbus/test-connection
 */
router.post('/test-connection', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { host, port, slaveId } = req.body;

    if (!host) {
      res.status(400).json({ error: 'host 是必填项' });
      return;
    }

    const config: ModbusDeviceConfig = {
      host,
      port: port || 502,
      slaveId: slaveId || 1,
      registerMap: [],
    };

    const testId = `test-${Date.now()}`;
    const modbusAdapter = ProtocolManager.getInstance().getModbusAdapter();
    const device = await modbusAdapter.addDevice(testId, config);

    const connected = device?.status === 'online';
    if (connected) {
      modbusAdapter.disconnectDevice(testId);
    }

    res.json({ connected, host, port: config.port, slaveId: config.slaveId });
  } catch (error) {
    logger.error('Modbus TCP test connection failed', error as Error);
    res.status(500).json({ error: (error as Error).message, connected: false });
  }
});

/**
 * 获取 S7-200 SMART 默认寄存器映射模板
 * GET /api/modbus/templates/s7-200-smart
 */
router.get('/templates/s7-200-smart', authMiddleware, (_req: Request, res: Response) => {
  res.json({
    name: 'S7-200 SMART (2SR20B)',
    model: '2SR20B',
    defaultPort: 502,
    defaultSlaveId: 1,
    registerMap: S7_200_SMART_DEFAULT_MAP,
  });
});

/**
 * 读取单个寄存器（调试用）
 * POST /api/modbus/devices/:deviceId/read-raw
 * Body: { type, address, quantity }
 */
router.post('/devices/:deviceId/read-raw', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { type, address, quantity } = req.body;

    if (!type || address === undefined) {
      res.status(400).json({ error: 'type 和 address 是必填项' });
      return;
    }

    const modbusAdapter = ProtocolManager.getInstance().getModbusAdapter();
    const value = await modbusAdapter.readRawRegister(
      deviceId,
      type as 'coil' | 'discrete' | 'holding' | 'input',
      Number(address),
      quantity ? Number(quantity) : 1
    );

    res.json({ deviceId, type, address, quantity: quantity || 1, value });
  } catch (error) {
    logger.error('Failed to read raw register', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 写入单个寄存器（调试用）
 * POST /api/modbus/devices/:deviceId/write-raw
 * Body: { type, address, value }
 */
router.post('/devices/:deviceId/write-raw', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { type, address, value } = req.body;

    if (!type || address === undefined || value === undefined) {
      res.status(400).json({ error: 'type, address, value 是必填项' });
      return;
    }

    const modbusAdapter = ProtocolManager.getInstance().getModbusAdapter();
    const success = await modbusAdapter.writeRawRegister(
      deviceId,
      type as 'coil' | 'holding',
      Number(address),
      value
    );

    res.json({ deviceId, type, address, value, success });
  } catch (error) {
    logger.error('Failed to write raw register', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 批量写入线圈（功能码 15）
 * POST /api/modbus/devices/:deviceId/write-multiple-coils
 * Body: { address, values }
 */
router.post('/devices/:deviceId/write-multiple-coils', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { address, values } = req.body;

    if (address === undefined || !Array.isArray(values)) {
      res.status(400).json({ error: 'address 和 values 是必填项' });
      return;
    }

    const modbusAdapter = ProtocolManager.getInstance().getModbusAdapter();
    await (modbusAdapter as any).writeMultipleCoils(deviceId, Number(address), values);

    res.json({ deviceId, address, count: values.length, success: true });
  } catch (error) {
    logger.error('Failed to write multiple coils', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * 批量写入寄存器（功能码 16）
 * POST /api/modbus/devices/:deviceId/write-multiple-registers
 * Body: { address, values }
 */
router.post('/devices/:deviceId/write-multiple-registers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { address, values } = req.body;

    if (address === undefined || !Array.isArray(values)) {
      res.status(400).json({ error: 'address 和 values 是必填项' });
      return;
    }

    const modbusAdapter = ProtocolManager.getInstance().getModbusAdapter();
    await (modbusAdapter as any).writeMultipleRegisters(deviceId, Number(address), values);

    res.json({ deviceId, address, count: values.length, success: true });
  } catch (error) {
    logger.error('Failed to write multiple registers', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
 
