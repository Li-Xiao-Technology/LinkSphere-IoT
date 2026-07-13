import { Router } from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

router.use(authMiddleware);
router.use(requirePermission('firmware.manage'));

router.get('/', async (req, res) => {
  try {
    const { brand, model } = req.query;
    const filters: Record<string, unknown> = {};

    if (brand) filters.brand = brand;
    if (model) filters.model = model;

    const firmwares = await prisma.firmware.findMany({
      where: filters,
      orderBy: { releasedAt: 'desc' }
    });

    res.json(firmwares.map(f => ({
      id: f.id,
      brand: f.brand,
      model: f.model,
      version: f.version,
      changelog: f.changelog,
      downloadUrl: f.downloadUrl,
      fileSize: f.fileSize,
      releasedAt: f.releasedAt.toISOString(),
      isStable: f.isStable,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString()
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch firmwares' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const firmware = await prisma.firmware.findUnique({
      where: { id: req.params.id }
    });

    if (!firmware) {
      return res.status(404).json({ error: 'Firmware not found' });
    }

    res.json({
      id: firmware.id,
      brand: firmware.brand,
      model: firmware.model,
      version: firmware.version,
      changelog: firmware.changelog,
      downloadUrl: firmware.downloadUrl,
      fileSize: firmware.fileSize,
      releasedAt: firmware.releasedAt.toISOString(),
      isStable: firmware.isStable,
      createdAt: firmware.createdAt.toISOString(),
      updatedAt: firmware.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch firmware' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { brand, model, version, changelog, downloadUrl, fileSize, isStable = true } = req.body;

    if (!brand || !model || !version || !downloadUrl) {
      return res.status(400).json({ error: 'brand, model, version, and downloadUrl are required' });
    }

    const firmware = await prisma.firmware.create({
      data: {
        brand,
        model,
        version,
        changelog,
        downloadUrl,
        fileSize,
        isStable
      }
    });

    res.status(201).json({
      id: firmware.id,
      brand: firmware.brand,
      model: firmware.model,
      version: firmware.version,
      changelog: firmware.changelog,
      downloadUrl: firmware.downloadUrl,
      fileSize: firmware.fileSize,
      releasedAt: firmware.releasedAt.toISOString(),
      isStable: firmware.isStable,
      createdAt: firmware.createdAt.toISOString(),
      updatedAt: firmware.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create firmware' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { brand, model, version, changelog, downloadUrl, fileSize, isStable } = req.body;

    const firmware = await prisma.firmware.update({
      where: { id: req.params.id },
      data: {
        ...(brand && { brand }),
        ...(model && { model }),
        ...(version && { version }),
        ...(changelog && { changelog }),
        ...(downloadUrl && { downloadUrl }),
        ...(fileSize && { fileSize }),
        ...(isStable !== undefined && { isStable })
      }
    });

    res.json({
      id: firmware.id,
      brand: firmware.brand,
      model: firmware.model,
      version: firmware.version,
      changelog: firmware.changelog,
      downloadUrl: firmware.downloadUrl,
      fileSize: firmware.fileSize,
      releasedAt: firmware.releasedAt.toISOString(),
      isStable: firmware.isStable,
      createdAt: firmware.createdAt.toISOString(),
      updatedAt: firmware.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update firmware' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.firmware.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete firmware' });
  }
});

router.get('/devices/:deviceId', async (req, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.deviceId },
      include: { firmwareVersions: true }
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const availableFirmwares = await prisma.firmware.findMany({
      where: {
        brand: device.brand,
        model: device.model || device.type
      },
      orderBy: { releasedAt: 'desc' }
    });

    res.json({
      deviceId: device.id,
      deviceName: device.name,
      currentVersion: device.firmwareVersion,
      availableUpdates: availableFirmwares.filter(f => f.version !== device.firmwareVersion),
      updateHistory: device.firmwareVersions.map(v => ({
        version: v.version,
        status: v.status,
        createdAt: v.createdAt.toISOString()
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch device firmware info' });
  }
});

router.post('/devices/:deviceId/update', async (req, res) => {
  try {
    const { version } = req.body;

    const device = await prisma.device.findUnique({
      where: { id: req.params.deviceId }
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const firmware = await prisma.firmware.findFirst({
      where: {
        brand: device.brand,
        model: device.model || device.type,
        version
      }
    });

    if (!firmware) {
      return res.status(404).json({ error: 'Firmware version not found' });
    }

    await prisma.device.update({
      where: { id: req.params.deviceId },
      data: { firmwareVersion: version }
    });

    await prisma.firmwareVersion.create({
      data: {
        deviceId: req.params.deviceId,
        version,
        status: 'installed',
        filePath: firmware.downloadUrl,
        changelog: firmware.changelog,
        fileSize: firmware.fileSize
      }
    });

    res.json({
      success: true,
      deviceId: req.params.deviceId,
      deviceName: device.name,
      version,
      message: 'Firmware updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update device firmware' });
  }
});

export default router;