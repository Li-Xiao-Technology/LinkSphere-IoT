import express from 'express';
import { DeviceManager } from '../managers/DeviceManager';
import { prisma } from '../prisma/client';
import { requirePermission } from '../middleware/permission';
import { authMiddleware } from '../middleware/auth';
import { auditLogMiddleware } from '../middleware/auditLog';

const router = express.Router();
const deviceManager = DeviceManager.getInstance();

router.get('/', authMiddleware, (req, res) => {
  const devices = deviceManager.getAllDevices();
  res.json(devices);
});

router.get('/:id', authMiddleware, async (req, res) => {
  const device = deviceManager.getDeviceById(req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  res.json(device);
});

router.delete('/:id', authMiddleware, requirePermission('device.delete'), auditLogMiddleware('device.delete', 'device'), async (req, res) => {
  const success = await deviceManager.removeDevice(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Device not found' });
  }
  res.json({ success: true });
});

router.put('/:id/name', authMiddleware, requirePermission('device.update'), auditLogMiddleware('device.update', 'device'), async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  try {
    const device = await prisma.device.update({
      where: { id: req.params.id },
      data: { name },
    });
    res.json({ success: true, device });
  } catch (error) {
    console.error('Failed to update device name:', error);
    res.status(404).json({ error: 'Device not found' });
  }
});

router.get('/:id/state', authMiddleware, async (req, res) => {
  const state = await deviceManager.getDeviceState(req.params.id);
  if (!state) {
    return res.status(404).json({ error: 'Device state not found' });
  }
  res.json(state);
});

router.put('/:id/state', authMiddleware, requirePermission('device.control'), async (req, res) => {
  const success = await deviceManager.setDeviceState(req.params.id, req.body);
  if (!success) {
    return res.status(400).json({ error: 'Failed to update device state' });
  }
  res.json({ success: true });
});

router.get('/type/:type', authMiddleware, (req, res) => {
  const devices = deviceManager.getDevicesByType(req.params.type);
  res.json(devices);
});

router.get('/brand/:brand', authMiddleware, (req, res) => {
  const devices = deviceManager.getDevicesByBrand(req.params.brand);
  res.json(devices);
});

router.post('/discover', authMiddleware, requirePermission('device.discover'), auditLogMiddleware('device.discover', 'device'), async (req, res) => {
  const devices = await deviceManager.discoverDevices();
  res.json(devices);
});

router.post('/:id/firmware/update', authMiddleware, requirePermission('device.firmware'), auditLogMiddleware('device.firmware', 'device'), async (req, res) => {
  const { version } = req.body;
  if (!version) {
    return res.status(400).json({ error: 'Version is required' });
  }
  const success = await deviceManager.updateFirmware(req.params.id, version);
  if (!success) {
    return res.status(400).json({ error: 'Failed to update firmware' });
  }
  res.json({ success: true });
});

router.get('/:id/history', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate, limit = 100 } = req.query;

  const where: {
    deviceId: string;
    changedAt?: {
      gte?: Date;
      lte?: Date;
    };
  } = { deviceId: id };

  if (startDate) {
    where.changedAt = where.changedAt || {};
    where.changedAt.gte = new Date(startDate as string);
  }
  if (endDate) {
    where.changedAt = where.changedAt || {};
    where.changedAt.lte = new Date(endDate as string);
  }

  try {
    const history = await prisma.deviceStateHistory.findMany({
      where,
      orderBy: { changedAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    const parsedHistory = history.map((item) => ({
      ...item,
      state: item.state ? JSON.parse(item.state) : null,
    }));

    res.json(parsedHistory);
  } catch (error) {
    console.error('Failed to get device state history:', error);
    res.status(500).json({ error: 'Failed to get device state history' });
  }
});

export const deviceRoutes = router;