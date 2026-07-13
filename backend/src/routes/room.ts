import express from 'express';
import { prisma } from '../prisma/client';
import { Device } from '../types';
import { validate } from '../middleware/validate';
import { idParamSchema, roomCreateSchema } from '../validation/schemas';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { sortIndex: 'asc' }
    });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', async (req, res) => {
  const { name, icon, sortIndex } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const id = `room-${Date.now()}`;

  try {
    const room = await prisma.room.create({
      data: {
        id,
        name,
        icon: icon || 'home',
        sortIndex: sortIndex || 0
      }
    });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, icon, sortIndex } = req.body;

  try {
    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: { name, icon, sortIndex }
    });
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/:id', validate({ params: idParamSchema }), async (req, res) => {
  try {
    await prisma.device.updateMany({
      where: { roomId: req.params.id },
      data: { roomId: null }
    });

    const room = await prisma.room.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to delete does not exist')) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:id/devices', async (req, res) => {
  const { deviceIds } = req.body as { deviceIds: string[] };
  if (!Array.isArray(deviceIds)) {
    return res.status(400).json({ error: 'deviceIds must be an array' });
  }

  try {
    await prisma.device.updateMany({
      where: { roomId: req.params.id },
      data: { roomId: null }
    });

    await Promise.all(
      deviceIds.map(deviceId =>
        prisma.device.update({
          where: { id: deviceId },
          data: { roomId: req.params.id }
        })
      )
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:id/devices', async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      where: { roomId: req.params.id }
    });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export const roomRoutes = router;