import { Request, Response, NextFunction } from 'express';
import { logger, runWithRequestContext } from '../utils/logger';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string || logger.generateRequestId();
  const traceId = req.headers['x-trace-id'] as string || requestId;
  const startTime = Date.now();

  (req as any).requestId = requestId;
  (req as any).traceId = traceId;

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Trace-Id', traceId);

  runWithRequestContext({ requestId, traceId }, () => {
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.request(req.method, req.path, res.statusCode, duration, requestId);
    });

    res.on('close', () => {
      const duration = Date.now() - startTime;
      if (res.writableEnded) return;
      logger.warn(`Request aborted: ${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        durationMs: duration,
      });
    });

    next();
  });
}
