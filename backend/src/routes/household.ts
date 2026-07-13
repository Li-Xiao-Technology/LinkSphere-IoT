import express from 'express';
import { prisma } from '../prisma/client';
import { Household, HouseholdMember } from '../types';
import { validate } from '../middleware/validate';
import { idParamSchema, householdCreateSchema } from '../validation/schemas';

const router = express.Router();

router.post('/', validate({ body: householdCreateSchema }), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const id = `household-${Date.now()}`;
    const ownerId = req.user?.userId || 'default-user';
    const createdAt = new Date();

    const household = await prisma.household.create({
      data: {
        id,
        name,
        ownerId,
        createdAt
      }
    });

    await prisma.userHousehold.create({
      data: {
        userId: ownerId,
        householdId: id,
        role: 'admin'
      }
    });

    const result: Household = {
      id: household.id,
      name: household.name,
      ownerId: household.ownerId,
      createdAt: household.createdAt.toISOString()
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId || 'default-user';

    const userHouseholds = await prisma.userHousehold.findMany({
      where: { userId },
      include: { household: true }
    });

    const households = await Promise.all(userHouseholds.map(async (uh) => {
      const members = await prisma.userHousehold.findMany({
        where: { householdId: uh.household.id },
        include: { user: true }
      });

      return {
        id: uh.household.id,
        name: uh.household.name,
        ownerId: uh.household.ownerId,
        createdAt: uh.household.createdAt.toISOString(),
        members: members.map((m) => ({
          id: m.userId,
          username: m.user?.username || '',
          role: m.role,
          joinedAt: new Date().toISOString(),
        })),
      };
    }));

    res.json(households);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:id/members', async (req, res) => {
  try {
    const { username, role } = req.body;
    if (!username || !role) {
      return res.status(400).json({ error: 'username and role are required' });
    }

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const householdId = req.params.id;
    await prisma.userHousehold.upsert({
      where: { userId_householdId: { userId: user.id, householdId } },
      update: { role },
      create: {
        userId: user.id,
        householdId,
        role
      }
    });

    const member: HouseholdMember = {
      userId: user.id,
      householdId: req.params.id,
      role: role as HouseholdMember['role'],
      username: user.username
    };

    res.json(member);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/members', async (req, res) => {
  try {
    const userHouseholds = await prisma.userHousehold.findMany({
      where: { householdId: req.params.id },
      include: { user: true }
    });

    const members: HouseholdMember[] = userHouseholds.map(uh => ({
      userId: uh.userId,
      householdId: uh.householdId,
      role: uh.role as HouseholdMember['role'],
      username: uh.user?.username
    }));

    res.json(members);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete('/:id/members/:userId', async (req, res) => {
  try {
    await prisma.userHousehold.delete({
      where: { userId_householdId: { userId: req.params.userId, householdId: req.params.id } }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Member not found' });
  }
});

router.put('/:id/members/:userId', async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ error: 'role is required' });
    }

    await prisma.userHousehold.update({
      where: { userId_householdId: { userId: req.params.userId, householdId: req.params.id } },
      data: { role }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Member not found' });
  }
});

export const householdRoutes = router;
