import { Router, Request, Response } from 'express';
import { prisma } from '../prisma/client';

const router = Router();

/**
 * 健康检查端点
 * GET /api/health
 * 用于 Docker/K8s 就绪探针和负载均衡器健康检查
 */
router.get('/', async (_req: Request, res: Response) => {
  const checks: Record<string, 'ok' | 'error'> = {};
  let overall = 'ok';

  // 数据库连接检查
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
    overall = 'error';
  }

  const statusCode = overall === 'ok' ? 200 : 503;
  res.status(statusCode).json({
    status: overall,
    checks,
    timestamp: new Date().toISOString()
  });
});

export default router;
