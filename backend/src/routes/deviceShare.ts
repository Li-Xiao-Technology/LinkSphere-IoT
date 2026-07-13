import express from 'express';
import { prisma } from '../prisma/client';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId as string;
    const shares = await prisma.deviceShare.findMany({
      where: { OR: [{ ownerId: userId }, { sharedWithId: userId }] },
      include: {
        device: true,
        owner: true,
        sharedWith: true,
      },
    });
    res.json(shares);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/device/:deviceId', async (req, res) => {
  try {
    const shares = await prisma.deviceShare.findMany({
      where: { deviceId: req.params.deviceId },
      include: { sharedWith: true },
    });
    res.json(shares);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', async (req, res) => {
  const { deviceId, sharedWithId, permission } = req.body;
  const ownerId = req.user?.userId as string;

  if (!deviceId || !sharedWithId || !permission) {
    return res.status(400).json({ error: 'deviceId, sharedWithId and permission are required' });
  }

  try {
    const id = `share-${Date.now()}`;
    const share = await prisma.deviceShare.create({
      data: { id, deviceId, ownerId, sharedWithId, permission },
      include: { device: true, sharedWith: true },
    });
    res.json(share);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  const { permission } = req.body;

  try {
    const share = await prisma.deviceShare.update({
      where: { id: req.params.id },
      data: { permission, updatedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'Share not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.deviceShare.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to delete does not exist')) {
      return res.status(404).json({ error: 'Share not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/shared-with-me', async (req, res) => {
  try {
    const userId = req.user?.userId as string;
    const shares = await prisma.deviceShare.findMany({
      where: { sharedWithId: userId },
      include: { device: true, owner: true },
    });
    res.json(shares);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export const deviceShareRoutes = router;