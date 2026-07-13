import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandlerMiddleware(err: Error | AppError, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req as any).requestId;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, err, {
        statusCode: err.statusCode,
        code: err.code,
        requestId,
        path: req.path,
        method: req.method,
        details: err.details,
      });
    } else {
      logger.warn(`${req.method} ${req.path} -> ${err.statusCode} ${err.code}`, {
        statusCode: err.statusCode,
        code: err.code,
        requestId,
        path: req.path,
        method: req.method,
      });
    }

    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details !== undefined && { details: err.details }),
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Unknown / unexpected error
  logger.error(`Unhandled error: ${req.method} ${req.path}`, err, {
    statusCode: 500,
    requestId,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    code: 'INTERNAL_ERROR',
    requestId,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, `Not Found: ${req.method} ${req.path}`, 'NOT_FOUND'));
}

export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
