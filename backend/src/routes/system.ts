import express from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

const os = require('os');

let lastCpuInfo: Array<{ user: number; nice: number; sys: number; idle: number; irq: number }> | null = null;
let lastCpuTime = 0;

function calculateCpuPercent(): number {
  const currentCpuInfo = os.cpus().map((cpu: any) => ({
    user: cpu.times.user,
    nice: cpu.times.nice,
    sys: cpu.times.sys,
    idle: cpu.times.idle,
    irq: cpu.times.irq,
  }));

  const now = Date.now();

  // 首次调用，记录当前状态并返回0，等待下次调用计算差值
  if (lastCpuInfo === null) {
    lastCpuInfo = currentCpuInfo;
    lastCpuTime = now;
    return 0;
  }

  // 如果调用间隔太短（小于1秒），返回上次计算的结果
  if (now - lastCpuTime < 1000) {
    return 0;
  }

  let totalIdle = 0;
  let totalTick = 0;

  for (let i = 0; i < currentCpuInfo.length; i++) {
    const idle = currentCpuInfo[i].idle - lastCpuInfo[i].idle;
    const user = currentCpuInfo[i].user - lastCpuInfo[i].user;
    const nice = currentCpuInfo[i].nice - lastCpuInfo[i].nice;
    const sys = currentCpuInfo[i].sys - lastCpuInfo[i].sys;
    const irq = currentCpuInfo[i].irq - lastCpuInfo[i].irq;

    const total = user + nice + sys + irq + idle;
    totalTick += total;
    totalIdle += idle;
  }

  lastCpuInfo = currentCpuInfo;
  lastCpuTime = now;

  if (totalTick === 0) return 0;

  const usage = ((totalTick - totalIdle) / totalTick) * 100;
  return Math.min(Math.max(Math.round(usage), 0), 100);
}

router.get('/status', authMiddleware, async (_req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuPercent = calculateCpuPercent();
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    res.json({
      uptime: process.uptime(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
        total: totalMemory,
        free: freeMemory,
        percent: Math.round((memUsage.rss / totalMemory) * 100),
      },
      cpu: {
        percent: cpuPercent,
        cores: cpus.length,
        model: cpus[0]?.model || '',
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

router.get('/database/status', authMiddleware, async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    const dbUrl = process.env.DATABASE_URL || '';
    const dbProvider = process.env.DB_PROVIDER || '';
    let dbType = 'Unknown';
    let dbName = '';

    if (dbUrl.startsWith('file:') || dbProvider === 'sqlite' || dbProvider === '') {
      dbType = 'SQLite';
      const match = dbUrl.match(/file:(?:\/\/)?(.+)/);
      if (match) {
        dbName = match[1];
      }
    } else if (dbUrl.startsWith('postgresql:') || dbProvider === 'postgresql') {
      dbType = 'PostgreSQL';
      try {
        const url = new URL(dbUrl);
        dbName = url.pathname.replace('/', '') || 'default';
      } catch {}
    } else if (dbUrl.startsWith('mysql:') || dbProvider === 'mysql') {
      dbType = 'MySQL';
      try {
        const url = new URL(dbUrl);
        dbName = url.pathname.replace('/', '') || 'default';
      } catch {}
    } else if (dbUrl.startsWith('mongodb:') || dbProvider === 'mongodb') {
      dbType = 'MongoDB';
      try {
        const url = new URL(dbUrl);
        dbName = url.pathname.replace('/', '') || 'default';
      } catch {}
    }
    
    res.json({
      status: 'ok',
      type: dbType,
      name: dbName,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Database connection check failed', err as Error);
    res.status(503).json({
      status: 'error',
      type: 'Unknown',
      error: (err as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
