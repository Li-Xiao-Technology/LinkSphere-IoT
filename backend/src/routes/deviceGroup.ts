import { Router } from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

router.use(authMiddleware);
router.use(requirePermission('device.group'));

router.get('/', async (req, res) => {
  try {
    const groups = await prisma.deviceGroup.findMany({
      include: {
        devices: {
          include: { device: true }
        }
      },
      orderBy: { sortIndex: 'asc' }
    });

    res.json(groups.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      color: g.color,
      sortIndex: g.sortIndex,
      deviceCount: g.devices.length,
      devices: g.devices.map(d => d.device),
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString()
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch device groups' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const group = await prisma.deviceGroup.findUnique({
      where: { id: req.params.id },
      include: {
        devices: {
          include: { device: true }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({
      id: group.id,
      name: group.name,
      icon: group.icon,
      color: group.color,
      sortIndex: group.sortIndex,
      deviceCount: group.devices.length,
      devices: group.devices.map(d => d.device),
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch device group' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, icon = 'folder', color = '#6366F1', deviceIds = [] } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const group = await prisma.deviceGroup.create({
      data: {
        name,
        icon,
        color
      }
    });

    if (deviceIds.length > 0) {
      await prisma.deviceGroupRelation.createMany({
        data: deviceIds.map((deviceId: string) => ({
          deviceId,
          groupId: group.id
        }))
      });
    }

    res.status(201).json({
      id: group.id,
      name: group.name,
      icon: group.icon,
      color: group.color,
      sortIndex: group.sortIndex,
      deviceCount: deviceIds.length,
      devices: [],
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create device group' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, icon, color, sortIndex } = req.body;

    const group = await prisma.deviceGroup.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(icon && { icon }),
        ...(color && { color }),
        ...(sortIndex !== undefined && { sortIndex })
      }
    });

    res.json({
      id: group.id,
      name: group.name,
      icon: group.icon,
      color: group.color,
      sortIndex: group.sortIndex,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update device group' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.deviceGroup.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete device group' });
  }
});

router.post('/:id/devices', async (req, res) => {
  try {
    const { deviceIds } = req.body;

    if (!Array.isArray(deviceIds)) {
      return res.status(400).json({ error: 'deviceIds must be an array' });
    }

    await prisma.deviceGroupRelation.createMany({
      data: deviceIds.map((deviceId: string) => ({
        deviceId,
        groupId: req.params.id
      }))
    });

    const group = await prisma.deviceGroup.findUnique({
      where: { id: req.params.id },
      include: { devices: { include: { device: true } } }
    });

    res.json({
      success: true,
      deviceCount: group?.devices.length || 0,
      devices: group?.devices.map(d => d.device) || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add devices to group' });
  }
});

router.delete('/:id/devices/:deviceId', async (req, res) => {
  try {
    await prisma.deviceGroupRelation.delete({
      where: {
        deviceId_groupId: {
          deviceId: req.params.deviceId,
          groupId: req.params.id
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove device from group' });
  }
});

router.post('/:id/action', async (req, res) => {
  try {
    const { action, params } = req.body;

    const group = await prisma.deviceGroup.findUnique({
      where: { id: req.params.id },
      include: { devices: { include: { device: true } } }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const deviceManager = (req as any).app.get('deviceManager');
    const results = [];

    for (const relation of group.devices) {
      try {
        const result = await deviceManager.setDeviceState(relation.device.id, params);
        results.push({
          deviceId: relation.device.id,
          deviceName: relation.device.name,
          success: result
        });
      } catch {
        results.push({
          deviceId: relation.device.id,
          deviceName: relation.device.name,
          success: false
        });
      }
    }

    res.json({
      success: results.every(r => r.success),
      results
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute group action' });
  }
});

export default router;