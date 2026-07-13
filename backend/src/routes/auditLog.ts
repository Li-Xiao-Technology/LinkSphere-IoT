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

// GET / — List audit logs with pagination and filtering
router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
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

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const data = logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    }));

    res.json({ data, total, page, pageSize });
  } catch (err) {
    logger.error('Failed to list audit logs', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /export — Export audit logs as CSV (must be before /:id)
router.get('/export', authMiddleware, async (req, res) => {
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
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(csv);
  } catch (err) {
    logger.error('Failed to export audit logs', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /:id — Get single audit log by id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const log = await prisma.auditLog.findUnique({
      where: { id: req.params.id },
    });

    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json({
      ...log,
      createdAt: log.createdAt.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to get audit log', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
