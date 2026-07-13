import express from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

function toCSV(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.join(',');
  const dataLines = rows.map((r) =>
    r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

function sendCSV(res: express.Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send(csv);
}

// GET /energy — Export energy logs as CSV
router.get('/energy', authMiddleware, async (req, res) => {
  try {
    const { deviceId, startDate, endDate } = req.query;

    const where: {
      deviceId?: string;
      recordedAt?: { gte?: Date; lte?: Date };
    } = {};
    if (deviceId) where.deviceId = deviceId as string;
    if (startDate || endDate) {
      where.recordedAt = {};
      if (startDate) where.recordedAt.gte = new Date(startDate as string);
      if (endDate) where.recordedAt.lte = new Date(endDate as string);
    }

    const logs = await prisma.energyLog.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      include: { device: { select: { name: true } } },
    });

    const headers = ['deviceId', 'deviceName', 'power', 'recordedAt'];
    const rows = logs.map((log) => [
      log.deviceId,
      log.device?.name || '',
      log.power,
      log.recordedAt.toISOString(),
    ]);

    const csv = toCSV(headers, rows);
    sendCSV(res, 'energy-logs', csv);
  } catch (err) {
    logger.error('Failed to export energy logs', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /devices/:deviceId/history — Export device state history as CSV
router.get('/devices/:deviceId/history', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where: {
      deviceId: string;
      changedAt?: { gte?: Date; lte?: Date };
    } = { deviceId: req.params.deviceId };

    if (startDate || endDate) {
      where.changedAt = {};
      if (startDate) where.changedAt.gte = new Date(startDate as string);
      if (endDate) where.changedAt.lte = new Date(endDate as string);
    }

    const history = await prisma.deviceStateHistory.findMany({
      where,
      orderBy: { changedAt: 'asc' },
    });

    const headers = ['deviceId', 'status', 'state', 'changedAt'];
    const rows = history.map((item) => [
      item.deviceId,
      item.status,
      item.state || '',
      item.changedAt.toISOString(),
    ]);

    const csv = toCSV(headers, rows);
    sendCSV(res, `device-${req.params.deviceId}-history`, csv);
  } catch (err) {
    logger.error('Failed to export device state history', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /audit-logs — Export audit logs as CSV (same as auditLog /export)
router.get('/audit-logs', authMiddleware, async (req, res) => {
  try {
    const { userId, resource, action, startDate, endDate } = req.query;

    const where: {
      userId?: string;
      resource?: string;
      action?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (userId) where.userId = userId as string;
    if (resource) where.resource = resource as string;
    if (action) where.action = action as string;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'id',
      'userId',
      'action',
      'resource',
      'resourceId',
      'details',
      'ip',
      'userAgent',
      'status',
      'createdAt',
    ];
    const rows = logs.map((log) => [
      log.id,
      log.userId || '',
      log.action,
      log.resource,
      log.resourceId || '',
      log.details || '',
      log.ip || '',
      log.userAgent || '',
      log.status,
      log.createdAt.toISOString(),
    ]);

    const csv = toCSV(headers, rows);
    sendCSV(res, 'audit-logs', csv);
  } catch (err) {
    logger.error('Failed to export audit logs', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
