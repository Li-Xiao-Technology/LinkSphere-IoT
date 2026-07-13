import express from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// GET / — List all tags
router.get('/', authMiddleware, async (req, res) => {
  try {
    const tags = await prisma.deviceTag.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { devices: true } } },
    });
    res.json(tags);
  } catch (err) {
    logger.error('Failed to list device tags', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST / — Create tag { name, color? }
router.post('/', authMiddleware, async (req, res) => {
  const { name, color } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Tag name is required' });
  }

  const id = `tag-${Date.now()}`;

  try {
    const tag = await prisma.deviceTag.create({
      data: {
        id,
        name,
        color: color || '#005FB8',
      },
    });
    res.json(tag);
  } catch (err) {
    if ((err as Error).message.includes('Unique constraint failed')) {
      return res.status(400).json({ error: 'Tag name already exists' });
    }
    logger.error('Failed to create device tag', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /:id — Update tag { name?, color? }
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, color } = req.body;

  try {
    const tag = await prisma.deviceTag.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
      },
    });
    res.json(tag);
  } catch (err) {
    if ((err as Error).message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    if ((err as Error).message.includes('Unique constraint failed')) {
      return res.status(400).json({ error: 'Tag name already exists' });
    }
    logger.error('Failed to update device tag', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /:id — Delete tag (also removes DeviceTagRelation entries)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.deviceTagRelation.deleteMany({
      where: { tagId: req.params.id },
    });

    await prisma.deviceTag.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to delete does not exist')) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    logger.error('Failed to delete device tag', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /devices/:deviceId — Get tags for a device
router.get('/devices/:deviceId', authMiddleware, async (req, res) => {
  try {
    const relations = await prisma.deviceTagRelation.findMany({
      where: { deviceId: req.params.deviceId },
      include: { tag: true },
    });
    res.json(relations.map((r) => r.tag));
  } catch (err) {
    logger.error('Failed to get device tags', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /devices/:deviceId — Assign tags to device { tagIds: string[] } (replace all)
router.post('/devices/:deviceId', authMiddleware, async (req, res) => {
  const { tagIds } = req.body as { tagIds: string[] };
  if (!Array.isArray(tagIds)) {
    return res.status(400).json({ error: 'tagIds must be an array' });
  }

  try {
    await prisma.deviceTagRelation.deleteMany({
      where: { deviceId: req.params.deviceId },
    });

    if (tagIds.length > 0) {
      await prisma.deviceTagRelation.createMany({
        data: tagIds.map((tagId) => ({
          deviceId: req.params.deviceId,
          tagId,
        })),
      });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to assign device tags', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /devices/:deviceId/:tagId — Remove single tag from device
router.delete('/devices/:deviceId/:tagId', authMiddleware, async (req, res) => {
  try {
    await prisma.deviceTagRelation.delete({
      where: {
        deviceId_tagId: {
          deviceId: req.params.deviceId,
          tagId: req.params.tagId,
        },
      },
    });
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to delete does not exist')) {
      return res.status(404).json({ error: 'Tag relation not found' });
    }
    logger.error('Failed to remove device tag', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /by-tag/:tagId — Get all devices with this tag
router.get('/by-tag/:tagId', authMiddleware, async (req, res) => {
  try {
    const relations = await prisma.deviceTagRelation.findMany({
      where: { tagId: req.params.tagId },
      include: { device: true },
    });
    res.json(relations.map((r) => r.device));
  } catch (err) {
    logger.error('Failed to get devices by tag', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
