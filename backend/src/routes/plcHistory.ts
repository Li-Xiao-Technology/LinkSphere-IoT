import { Router, Request, Response } from 'express';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

const router = Router();

router.get('/devices/:deviceId/history', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { property, startTime, endTime, limit = 100 } = req.query;

    let query: any = {
      deviceId,
    };

    if (property) {
      query.property = property;
    }

    if (startTime) {
      query.timestamp = {
        ...query.timestamp,
        gte: new Date(startTime as string),
      };
    }

    if (endTime) {
      query.timestamp = {
        ...query.timestamp,
        lte: new Date(endTime as string),
      };
    }

    const history = await prisma.plcRegisterHistory.findMany({
      where: query,
      orderBy: { timestamp: 'desc' },
      take: Number(limit),
    });

    res.json({ deviceId, count: history.length, data: history });
  } catch (error) {
    logger.error('Failed to fetch PLC register history', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/devices/:deviceId/history/trend', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { property, hours = 24 } = req.query;

    const hoursAgo = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);

    const history = await prisma.plcRegisterHistory.findMany({
      where: {
        deviceId,
        property: property as string,
        timestamp: { gte: hoursAgo },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        value: true,
        unit: true,
      },
    });

    const result = history.map((h) => ({
      timestamp: h.timestamp.toISOString(),
      value: h.value,
      unit: h.unit,
    }));

    res.json({ deviceId, property, hours, data: result });
  } catch (error) {
    logger.error('Failed to fetch PLC trend data', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/devices/:deviceId/history/properties', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const properties = await prisma.plcRegisterHistory.findMany({
      where: { deviceId },
      select: { property: true, unit: true },
      distinct: ['property'],
    });

    res.json({ deviceId, properties });
  } catch (error) {
    logger.error('Failed to fetch PLC properties', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete('/devices/:deviceId/history', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { before } = req.query;

    let query: any = { deviceId };
    if (before) {
      query.timestamp = { lte: new Date(before as string) };
    }

    const deleted = await prisma.plcRegisterHistory.deleteMany({
      where: query,
    });

    res.json({ deviceId, deletedCount: deleted.count });
  } catch (error) {
    logger.error('Failed to delete PLC history', error as Error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
