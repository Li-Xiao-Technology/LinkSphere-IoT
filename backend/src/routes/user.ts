import express from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.get('/profile', authMiddleware, async (req, res) => {
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

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { email, username } = req.body;

    if (username && username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const updateData: { email?: string; username?: string } = {};
    if (email !== undefined) updateData.email = email || null;
    if (username) updateData.username = username;

    const user = await prisma.user.update({
      where: { id: req.user?.userId },
      data: updateData
    });

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
    if ((err as Error).message.includes('Unique constraint failed')) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await bcrypt.compare(currentPassword, user.password);
    if (!result) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user?.userId },
      data: { password: hash }
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/notifications/preferences', authMiddleware, async (req, res) => {
  try {
    const preferences = await prisma.notificationPreference.findUnique({
      where: { userId: req.user?.userId }
    });

    res.json(preferences || {
      userId: req.user?.userId,
      deviceOffline: true,
      deviceOnline: false,
      warning: true,
      info: false,
      ruleTriggered: true,
      firmwareUpdate: true,
      scheduleExecuted: false,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/notifications/preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId as string;
    const {
      deviceOffline,
      deviceOnline,
      warning,
      info,
      ruleTriggered,
      firmwareUpdate,
      scheduleExecuted,
    } = req.body;

    const preferences = await prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        deviceOffline,
        deviceOnline,
        warning,
        info,
        ruleTriggered,
        firmwareUpdate,
        scheduleExecuted,
      },
      create: {
        userId,
        deviceOffline: deviceOffline ?? true,
        deviceOnline: deviceOnline ?? false,
        warning: warning ?? true,
        info: info ?? false,
        ruleTriggered: ruleTriggered ?? true,
        firmwareUpdate: firmwareUpdate ?? true,
        scheduleExecuted: scheduleExecuted ?? false,
      }
    });

    res.json(preferences);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export const userRoutes = router;