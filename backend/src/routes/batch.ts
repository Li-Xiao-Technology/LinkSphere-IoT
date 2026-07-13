import { Router } from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';


const router = Router();

router.use(authMiddleware);

router.post('/action', async (req, res) => {
  try {
    const { deviceIds, action, params } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ error: 'deviceIds must be a non-empty array' });
    }

    const deviceManager = (req as any).app.get('deviceManager');
    const results = [];

    for (const deviceId of deviceIds) {
      try {
        const device = await prisma.device.findUnique({ where: { id: deviceId } });
        if (!device) {
          results.push({ deviceId, success: false, error: 'Device not found' });
          continue;
        }

        const result = await deviceManager.setDeviceState(deviceId, params);
        results.push({
          deviceId,
          deviceName: device.name,
          success: result
        });
      } catch (err) {
        results.push({
          deviceId,
          success: false,
          error: (err as Error).message
        });
      }
    }

    res.json({
      success: results.every(r => r.success),
      total: deviceIds.length,
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute batch action' });
  }
});

router.post('/power', async (req, res) => {
  try {
    const { deviceIds, power } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ error: 'deviceIds must be a non-empty array' });
    }

    const deviceManager = (req as any).app.get('deviceManager');
    const results = [];

    for (const deviceId of deviceIds) {
      try {
        const device = await prisma.device.findUnique({ where: { id: deviceId } });
        if (!device) {
          results.push({ deviceId, success: false, error: 'Device not found' });
          continue;
        }

        const result = await deviceManager.setDeviceState(deviceId, { power });
        results.push({
          deviceId,
          deviceName: device.name,
          success: result
        });
      } catch (err) {
        results.push({
          deviceId,
          success: false,
          error: (err as Error).message
        });
      }
    }

    res.json({
      success: results.every(r => r.success),
      total: deviceIds.length,
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set batch power' });
  }
});

router.post('/assign-room', async (req, res) => {
  try {
    const { deviceIds, roomId } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ error: 'deviceIds must be a non-empty array' });
    }

    if (!roomId) {
      return res.status(400).json({ error: 'roomId is required' });
    }

    await prisma.device.updateMany({
      where: { id: { in: deviceIds } },
      data: { roomId }
    });

    res.json({
      success: true,
      total: deviceIds.length,
      roomId
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign devices to room' });
  }
});

router.post('/assign-tags', async (req, res) => {
  try {
    const { deviceIds, tagIds } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ error: 'deviceIds must be a non-empty array' });
    }

    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({ error: 'tagIds must be a non-empty array' });
    }

    const relations = [];
    for (const deviceId of deviceIds) {
      for (const tagId of tagIds) {
        relations.push({ deviceId, tagId });
      }
    }

    await prisma.deviceTagRelation.createMany({
      data: relations
    });

    res.json({
      success: true,
      totalDevices: deviceIds.length,
      totalTags: tagIds.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign tags to devices' });
  }
});

router.post('/assign-group', async (req, res) => {
  try {
    const { deviceIds, groupId } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ error: 'deviceIds must be a non-empty array' });
    }

    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }

    await prisma.deviceGroupRelation.createMany({
      data: deviceIds.map((deviceId: string) => ({ deviceId, groupId }))
    });

    res.json({
      success: true,
      total: deviceIds.length,
      groupId
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign devices to group' });
  }
});

router.post('/delete', async (req, res) => {
  try {
    const { deviceIds } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ error: 'deviceIds must be a non-empty array' });
    }

    const deviceManager = (req as any).app.get('deviceManager');
    const results = [];

    for (const deviceId of deviceIds) {
      try {
        const success = await deviceManager.removeDevice(deviceId);
        results.push({ deviceId, success });
      } catch (err) {
        results.push({ deviceId, success: false, error: (err as Error).message });
      }
    }

    res.json({
      success: results.every(r => r.success),
      total: deviceIds.length,
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete devices' });
  }
});

router.post('/update-firmware', async (req, res) => {
  try {
    const { deviceIds, version } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ error: 'deviceIds must be a non-empty array' });
    }

    if (!version) {
      return res.status(400).json({ error: 'version is required' });
    }

    const results = [];

    for (const deviceId of deviceIds) {
      try {
        await prisma.device.update({
          where: { id: deviceId },
          data: { firmwareVersion: version }
        });

        await prisma.firmwareVersion.create({
          data: {
            deviceId,
            version,
            status: 'installed'
          }
        });

        results.push({ deviceId, success: true });
      } catch (err) {
        results.push({ deviceId, success: false, error: (err as Error).message });
      }
    }

    res.json({
      success: results.every(r => r.success),
      total: deviceIds.length,
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      results,
      version
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update firmware' });
  }
});

export default router;