const blacklistedTokens = new Map<string, number>();
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const BLACKLIST_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

export function addToBlacklist(token: string): void {
  blacklistedTokens.set(token, Date.now() + BLACKLIST_EXPIRE_MS);
}

export function isBlacklisted(token: string): boolean {
  const expireTime = blacklistedTokens.get(token);
  if (!expireTime) return false;
  if (expireTime < Date.now()) {
    blacklistedTokens.delete(token);
    return false;
  }
  return true;
}

export function recordLoginAttempt(ip: string): { locked: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry) {
    loginAttempts.set(ip, { count: 1, lockedUntil: 0 });
    return { locked: false, remaining: MAX_LOGIN_ATTEMPTS - 1, retryAfter: 0 };
  }

  if (entry.lockedUntil > now) {
    return {
      locked: true,
      remaining: 0,
      retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  entry.count += 1;

  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = now + LOCK_DURATION_MS;
    return {
      locked: true,
      remaining: 0,
      retryAfter: LOCK_DURATION_MS / 1000,
    };
  }

  return {
    locked: false,
    remaining: MAX_LOGIN_ATTEMPTS - entry.count,
    retryAfter: 0,
  };
}

export function resetLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export function cleanupExpired(): void {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (entry.lockedUntil > 0 && entry.lockedUntil < now) {
      loginAttempts.delete(ip);
    }
  }
  for (const [token, expireTime] of blacklistedTokens) {
    if (expireTime < now) {
      blacklistedTokens.delete(token);
    }
  }
}

setInterval(cleanupExpired, 60 * 1000);
