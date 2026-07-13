import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    timestamp: number;
  };
}

const store: RateLimitStore = {};

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '1000', 10);

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  if (!store[ip]) {
    store[ip] = { count: 0, timestamp: Date.now() };
  }
  
  const entry = store[ip];
  
  if (Date.now() - entry.timestamp > WINDOW_MS) {
    entry.count = 0;
    entry.timestamp = Date.now();
  }
  
  entry.count++;
  
  if (entry.count > MAX_REQUESTS) {
    res.status(429).json({ 
      error: 'Too many requests', 
      retryAfter: Math.ceil((WINDOW_MS - (Date.now() - entry.timestamp)) / 1000) 
    });
    return;
  }
  
  next();
}
