import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

/**
 * 审计日志中间件
 * 记录写操作（增删改、控制）的 who/when/what/how
 * 挂载在 authMiddleware 之后，确保 req.user 已填充
 */
export function auditLogMiddleware(action: string, resource: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.userId;
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';
    const resourceId = req.params.id || req.params.deviceId || req.params.ruleId || req.params.sceneId || req.params.scheduleId;
    const body = req.body;
    const details = body && Object.keys(body).length > 0 ? JSON.stringify(body).slice(0, 2000) : undefined;

    let status = 'success';

    res.on('finish', async () => {
      if (res.statusCode >= 400) {
        status = 'failure';
      }
      try {
        await prisma.auditLog.create({
          data: {
            userId,
            action,
            resource,
            resourceId,
            ip,
            userAgent,
            status,
            details,
          },
        });
      } catch (e) {
        logger.error('Audit log write failed', e as Error);
      }
    });

    next();
  };
}
