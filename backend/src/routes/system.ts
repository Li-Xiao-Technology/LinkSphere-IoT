import express from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// GET /status — System status
router.get('/status', authMiddleware, async (_req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    res.json({
      uptime: process.uptime(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Failed to get system status', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /devices/summary — Device count by status (online/offline), by type, by brand
router.get('/devices/summary', authMiddleware, async (_req, res) => {
  try {
    const [byStatus, byType, byBrand, total] = await Promise.all([
      prisma.device.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.device.groupBy({
        by: ['type'],
        _count: { _all: true },
      }),
      prisma.device.groupBy({
        by: ['brand'],
        _count: { _all: true },
      }),
      prisma.device.count(),
    ]);

    res.json({
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      byType: byType.map((t) => ({ type: t.type, count: t._count._all })),
      byBrand: byBrand.map((b) => ({ brand: b.brand, count: b._count._all })),
    });
  } catch (err) {
    logger.error('Failed to get device summary', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /notifications/recent — Recent 10 unread notifications
router.get('/notifications/recent', authMiddleware, async (_req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { read: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const data = notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    }));

    res.json(data);
  } catch (err) {
    logger.error('Failed to get recent notifications', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /database/status — Database connection check
router.get('/database/status', authMiddleware, async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Database connection check failed', err as Error);
    res.status(503).json({
      status: 'error',
      error: (err as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
