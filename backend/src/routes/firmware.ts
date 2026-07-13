import express from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import { webhookEvents } from '../services/webhookService';

const router = express.Router();

// GET / — List all firmware versions (optional ?deviceId filter)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.query;
    const where = deviceId ? { deviceId: deviceId as string } : {};
    const versions = await prisma.firmwareVersion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(versions);
  } catch (err) {
    logger.error('Failed to list firmware versions', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /device/:deviceId — Get all firmware versions for a device (must be before /:id)
router.get('/device/:deviceId', authMiddleware, async (req, res) => {
  try {
    const versions = await prisma.firmwareVersion.findMany({
      where: { deviceId: req.params.deviceId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(versions);
  } catch (err) {
    logger.error('Failed to get device firmware versions', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /:id — Get single firmware version
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const version = await prisma.firmwareVersion.findUnique({
      where: { id: req.params.id },
    });
    if (!version) {
      return res.status(404).json({ error: 'Firmware version not found' });
    }
    res.json(version);
  } catch (err) {
    logger.error('Failed to get firmware version', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST / — Create firmware version record { deviceId, version, filePath?, changelog?, fileSize? }
router.post('/', authMiddleware, async (req, res) => {
  const { deviceId, version, filePath, changelog, fileSize } = req.body;
  if (!deviceId || !version) {
    return res.status(400).json({ error: 'deviceId and version are required' });
  }

  try {
    const firmware = await prisma.firmwareVersion.create({
      data: {
        deviceId,
        version,
        filePath: filePath || null,
        changelog: changelog || null,
        fileSize: fileSize !== undefined ? Number(fileSize) : null,
        status: 'available',
      },
    });
    res.json(firmware);
  } catch (err) {
    logger.error('Failed to create firmware version', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /:id — Update firmware version { version?, changelog?, status?, filePath? }
router.put('/:id', authMiddleware, async (req, res) => {
  const { version, changelog, status, filePath } = req.body;

  const data: {
    version?: string;
    changelog?: string | null;
    status?: string;
    filePath?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (version !== undefined) data.version = version;
  if (changelog !== undefined) data.changelog = changelog || null;
  if (status !== undefined) data.status = status;
  if (filePath !== undefined) data.filePath = filePath || null;

  try {
    const firmware = await prisma.firmwareVersion.update({
      where: { id: req.params.id },
      data,
    });
    res.json(firmware);
  } catch (err) {
    if ((err as Error).message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'Firmware version not found' });
    }
    logger.error('Failed to update firmware version', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /:id — Delete firmware version
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.firmwareVersion.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to delete does not exist')) {
      return res.status(404).json({ error: 'Firmware version not found' });
    }
    logger.error('Failed to delete firmware version', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /:id/install — Mark firmware as installed (set status to 'installed')
router.post('/:id/install', authMiddleware, async (req, res) => {
  try {
    const firmware = await prisma.firmwareVersion.update({
      where: { id: req.params.id },
      data: {
        status: 'installed',
        updatedAt: new Date(),
      },
    });
    webhookEvents.firmwareUpdated(firmware.deviceId, firmware.version).catch((e) => logger.error('webhook firmwareUpdated failed', e as Error));
    res.json({ success: true, firmware });
  } catch (err) {
    if ((err as Error).message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'Firmware version not found' });
    }
    logger.error('Failed to mark firmware as installed', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
