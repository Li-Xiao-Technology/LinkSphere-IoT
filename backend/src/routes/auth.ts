import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/client';
import { User, AuthToken } from '../types';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLoginSchema, authRegisterSchema, refreshTokenSchema } from '../validation/schemas';
import { addToBlacklist, isBlacklisted, recordLoginAttempt, resetLoginAttempts } from '../utils/tokenStore';

const router = express.Router();

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

function generateTokens(user: User): AuthToken {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const accessToken = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    secret,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    secret,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
}

function getClientIp(req: express.Request): string {
  return (req.ip || req.socket.remoteAddress || 'unknown') as string;
}

router.post('/register', validate({ body: authRegisterSchema }), async (req, res) => {
  const { username, password, email } = req.body;

  const id = `user-${Date.now()}`;
  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        id,
        username,
        password: hash,
        email: email || null
      }
    });

    const household = await prisma.household.create({
      data: {
        id: `household-${Date.now()}`,
        name: '我的家',
        ownerId: user.id,
      }
    });

    await prisma.userHousehold.create({
      data: {
        userId: user.id,
        householdId: household.id,
        role: 'owner',
      }
    });

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', validate({ body: authLoginSchema }), async (req, res) => {
  const ip = getClientIp(req);
  const attempt = recordLoginAttempt(ip);

  if (attempt.locked) {
    return res.status(429).json({
      error: 'Too many login attempts',
      retryAfter: attempt.retryAfter,
    });
  }

  const { username, password } = req.body;

  try {
    // 判断是邮箱还是用户名
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);

    const user = isEmail
      ? await prisma.user.findUnique({ where: { email: username } })
      : await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid username or password',
        remainingAttempts: attempt.remaining,
      });
    }

    const result = await bcrypt.compare(password, user.password);
    if (!result) {
      return res.status(401).json({
        error: 'Invalid username or password',
        remainingAttempts: attempt.remaining,
      });
    }

    resetLoginAttempts(ip);

    const userObj: User = {
      id: user.id,
      username: user.username,
      password: user.password,
      email: user.email ?? undefined,
      role: (user.role as 'member' | 'admin' | 'viewer') || 'member',
      createdAt: user.createdAt.toISOString()
    };

    const tokens = generateTokens(userObj);
    const safeUser = {
      id: userObj.id,
      username: userObj.username,
      email: userObj.email,
      role: userObj.role,
      createdAt: userObj.createdAt,
    };
    res.json({
      ...tokens,
      user: safeUser,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/refresh', validate({ body: refreshTokenSchema }), async (req, res) => {
  const { refreshToken } = req.body;

  if (isBlacklisted(refreshToken)) {
    return res.status(401).json({ error: 'Token has been revoked' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    const decoded = jwt.verify(refreshToken, secret) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const userObj: User = {
      id: user.id,
      username: user.username,
      password: user.password,
      email: user.email ?? undefined,
      role: (user.role as 'member' | 'admin' | 'viewer') || 'member',
      createdAt: user.createdAt.toISOString()
    };

    const tokens = generateTokens(userObj);
    const safeUser = {
      id: userObj.id,
      username: userObj.username,
      email: userObj.email,
      role: userObj.role,
      createdAt: userObj.createdAt,
    };
    res.json({
      ...tokens,
      user: safeUser,
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

router.post('/logout', authMiddleware, (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    addToBlacklist(token);
  }
  res.json({ success: true });
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userHouseholds = await prisma.userHousehold.findMany({
      where: { userId: user.id },
      include: { household: true }
    });

    const households = userHouseholds.map((uh) => ({
      id: uh.household.id,
      name: uh.household.name,
      role: uh.role,
    }));

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      households,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export const authRoutes = router;
