import express from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

function getThirtyDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /summary — Summary stats
router.get('/summary', authMiddleware, async (_req, res) => {
  try {
    const [totalUsers, totalDevices, totalRules, totalScenes, activeRules] = await Promise.all([
      prisma.user.count(),
      prisma.device.count(),
      prisma.rule.count(),
      prisma.scene.count(),
      prisma.rule.count({ where: { enabled: true } }),
    ]);

    res.json({
      totalUsers,
      totalDevices,
      totalRules,
      totalScenes,
      activeRules,
    });
  } catch (err) {
    logger.error('Failed to get analytics summary', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /devices/usage — Device usage stats: per-device action count in last 30 days
router.get('/devices/usage', authMiddleware, async (_req, res) => {
  try {
    const thirtyDaysAgo = getThirtyDaysAgo();

    const usage = await prisma.auditLog.groupBy({
      by: ['resourceId'],
      where: {
        resource: 'device',
        resourceId: { not: null },
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { _all: true },
    });

    const data = usage
      .map((u) => ({ deviceId: u.resourceId, count: u._count._all }))
      .sort((a, b) => b.count - a.count);

    res.json(data);
  } catch (err) {
    logger.error('Failed to get device usage stats', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /users/activity — User activity stats: per-user action count in last 30 days
router.get('/users/activity', authMiddleware, async (_req, res) => {
  try {
    const thirtyDaysAgo = getThirtyDaysAgo();

    const activity = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { _all: true },
    });

    const data = activity
      .map((u) => ({ userId: u.userId, count: u._count._all }))
      .sort((a, b) => b.count - a.count);

    res.json(data);
  } catch (err) {
    logger.error('Failed to get user activity stats', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /timeline — Activity timeline: daily counts for last 30 days
router.get('/timeline', authMiddleware, async (_req, res) => {
  try {
    const thirtyDaysAgo = getThirtyDaysAgo();

    const logs = await prisma.auditLog.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    });

    const byDay = new Map<string, number>();
    for (const log of logs) {
      const day = log.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + 1);
    }

    const timeline: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.toISOString().slice(0, 10);
      timeline.push({ date: day, count: byDay.get(day) || 0 });
    }

    res.json(timeline);
  } catch (err) {
    logger.error('Failed to get activity timeline', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
