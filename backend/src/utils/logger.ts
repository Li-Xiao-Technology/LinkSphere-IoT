import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  context?: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
  userId?: string;
  stack?: string;
  errorMessage?: string;
}

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

const LOG_LEVEL_MAP: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const isProduction = process.env.NODE_ENV === 'production';
const enableFileLogging = isProduction;
const serviceName = process.env.SERVICE_NAME || 'linksphere-backend';
const logFilePath = path.join(__dirname, '../..', 'server.log');

const asyncLocalStorage = new AsyncLocalStorage<{
  requestId?: string;
  traceId?: string;
  userId?: string;
}>();

function formatTimestamp(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_MAP[level] >= LOG_LEVEL_MAP[currentLogLevel];
}

function getLevelColor(level: LogLevel): string {
  const colors: Record<LogLevel, string> = {
    debug: '\x1b[34m',
    info: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
  };
  return colors[level];
}

function formatConsoleLog(entry: LogEntry): string {
  const { timestamp, level, message, requestId } = entry;
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  let output = `${dim}${timestamp}${reset} [${getLevelColor(level)}${level.toUpperCase().padEnd(5)}${reset}] ${message}`;

  if (requestId) {
    output += ` ${dim}[req=${requestId}]${reset}`;
  }

  if (entry.userId) {
    output += ` ${dim}[user=${entry.userId}]${reset}`;
  }

  if (entry.context && Object.keys(entry.context).length > 0) {
    try {
      output += ' ' + JSON.stringify(entry.context);
    } catch {
      output += ' ' + String(entry.context);
    }
  }

  if (entry.errorMessage) {
    output += `\n  ${getLevelColor(level)}${entry.errorMessage}${reset}`;
  }

  return output;
}

function buildEntry(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): LogEntry {
  const store = asyncLocalStorage.getStore();
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    message,
    service: serviceName,
    context,
    requestId: store?.requestId,
    traceId: store?.traceId,
    userId: store?.userId,
  };

  if (error) {
    entry.stack = error.stack;
    entry.errorMessage = error.message;
  }

  return entry;
}

function writeToFile(entry: LogEntry): void {
  if (!enableFileLogging) return;

  const logLine = JSON.stringify(entry) + '\n';

  fs.appendFile(logFilePath, logLine, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

function outputLog(entry: LogEntry): void {
  if (isProduction) {
    const output = JSON.stringify(entry);
    if (entry.level === 'error') {
      console.error(output);
    } else if (entry.level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  } else {
    const output = formatConsoleLog(entry);
    if (entry.level === 'error') {
      console.error(output);
    } else if (entry.level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  writeToFile(entry);
}

let requestIdCounter = 0;

function generateRequestId(): string {
  return `${Date.now().toString(36)}-${(++requestIdCounter).toString(36)}`;
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>): void => {
    if (!shouldLog('debug')) return;
    const entry = buildEntry('debug', message, context);
    outputLog(entry);
  },

  info: (message: string, context?: Record<string, unknown>): void => {
    if (!shouldLog('info')) return;
    const entry = buildEntry('info', message, context);
    outputLog(entry);
  },

  warn: (message: string, context?: Record<string, unknown>): void => {
    if (!shouldLog('warn')) return;
    const entry = buildEntry('warn', message, context);
    outputLog(entry);
  },

  error: (message: string, error?: Error, context?: Record<string, unknown>): void => {
    if (!shouldLog('error')) return;
    const entry = buildEntry('error', message, context, error);
    outputLog(entry);
  },

  request: (method: string, path: string, statusCode: number, duration: number, requestId?: string): void => {
    const entry = buildEntry('info', 'Request completed', {
      method,
      path,
      statusCode,
      durationMs: duration,
    });
    if (requestId && !entry.requestId) {
      entry.requestId = requestId;
    }
    outputLog(entry);
  },

  generateRequestId,
  getRequestId: (): string | undefined => {
    return asyncLocalStorage.getStore()?.requestId;
  },
};

export function runWithRequestContext(
  ctx: { requestId: string; traceId?: string; userId?: string },
  fn: () => void
): void {
  asyncLocalStorage.run(ctx, fn);
}

export function getRequestStore(): { requestId?: string; traceId?: string; userId?: string } | undefined {
  return asyncLocalStorage.getStore();
}

export function setRequestUser(userId: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.userId = userId;
  }
}
