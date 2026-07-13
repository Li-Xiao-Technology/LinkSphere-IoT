import express from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// GET / — List all thresholds (optional ?deviceId filter)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.query;
    const where = deviceId ? { deviceId: deviceId as string } : {};
    const thresholds = await prisma.alertThreshold.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(thresholds);
  } catch (err) {
    logger.error('Failed to list thresholds', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /device/:deviceId — Get all thresholds for a device (must be before /:id)
router.get('/device/:deviceId', authMiddleware, async (req, res) => {
  try {
    const thresholds = await prisma.alertThreshold.findMany({
      where: { deviceId: req.params.deviceId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(thresholds);
  } catch (err) {
    logger.error('Failed to get device thresholds', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /:id — Get single threshold
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const threshold = await prisma.alertThreshold.findUnique({
      where: { id: req.params.id },
    });
    if (!threshold) {
      return res.status(404).json({ error: 'Threshold not found' });
    }
    res.json(threshold);
  } catch (err) {
    logger.error('Failed to get threshold', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST / — Create threshold { deviceId, property, minValue?, maxValue?, enabled? }
router.post('/', authMiddleware, async (req, res) => {
  const { deviceId, property, minValue, maxValue, enabled } = req.body;
  if (!deviceId || !property) {
    return res.status(400).json({ error: 'deviceId and property are required' });
  }

  try {
    const threshold = await prisma.alertThreshold.create({
      data: {
        deviceId,
        property,
        minValue: minValue !== undefined ? Number(minValue) : null,
        maxValue: maxValue !== undefined ? Number(maxValue) : null,
        enabled: enabled !== undefined ? Boolean(enabled) : true,
      },
    });
    res.json(threshold);
  } catch (err) {
    if ((err as Error).message.includes('Unique constraint failed')) {
      return res.status(400).json({ error: 'Threshold for this device and property already exists' });
    }
    logger.error('Failed to create threshold', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /:id — Update threshold
router.put('/:id', authMiddleware, async (req, res) => {
  const { property, minValue, maxValue, enabled } = req.body;

  const data: {
    property?: string;
    minValue?: number | null;
    maxValue?: number | null;
    enabled?: boolean;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (property !== undefined) data.property = property;
  if (minValue !== undefined) data.minValue = minValue === null ? null : Number(minValue);
  if (maxValue !== undefined) data.maxValue = maxValue === null ? null : Number(maxValue);
  if (enabled !== undefined) data.enabled = Boolean(enabled);

  try {
    const threshold = await prisma.alertThreshold.update({
      where: { id: req.params.id },
      data,
    });
    res.json(threshold);
  } catch (err) {
    if ((err as Error).message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'Threshold not found' });
    }
    logger.error('Failed to update threshold', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /:id — Delete threshold
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.alertThreshold.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to delete does not exist')) {
      return res.status(404).json({ error: 'Threshold not found' });
    }
    logger.error('Failed to delete threshold', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
