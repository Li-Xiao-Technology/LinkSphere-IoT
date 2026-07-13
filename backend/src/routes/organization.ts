import { Router } from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

router.use(authMiddleware);
router.use(requirePermission('organization.manage'));

router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const organizations = await prisma.organization.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      include: {
        members: true,
        children: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(organizations.map(o => ({
      id: o.id,
      name: o.name,
      description: o.description,
      type: o.type,
      parentId: o.parentId,
      ownerId: o.ownerId,
      memberCount: o.members.length,
      childrenCount: o.children.length,
      members: o.members.map(m => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString()
      })),
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString()
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        members: true,
        children: { include: { members: true } },
        parent: true
      }
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({
      id: organization.id,
      name: organization.name,
      description: organization.description,
      type: organization.type,
      parentId: organization.parentId,
      parentName: organization.parent?.name,
      ownerId: organization.ownerId,
      memberCount: organization.members.length,
      childrenCount: organization.children.length,
      members: organization.members.map(m => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString()
      })),
      children: organization.children.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        memberCount: c.members.length,
        createdAt: c.createdAt.toISOString()
      })),
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { name, description, type = 'company', parentId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const validTypes = ['company', 'department', 'project'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    const organization = await prisma.organization.create({
      data: {
        name,
        description,
        type,
        parentId,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'admin'
          }
        }
      }
    });

    res.status(201).json({
      id: organization.id,
      name: organization.name,
      description: organization.description,
      type: organization.type,
      parentId: organization.parentId,
      ownerId: organization.ownerId,
      memberCount: 1,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, type, parentId } = req.body;

    const organization = await prisma.organization.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(type && { type }),
        ...(parentId && { parentId })
      }
    });

    res.json({
      id: organization.id,
      name: organization.name,
      description: organization.description,
      type: organization.type,
      parentId: organization.parentId,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.organization.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

router.get('/:id/members', async (req, res) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, email: true }
            }
          }
        }
      }
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({
      organizationId: organization.id,
      organizationName: organization.name,
      members: organization.members.map(m => ({
        userId: m.userId,
        username: m.user?.username,
        email: m.user?.email,
        role: m.role,
        joinedAt: m.joinedAt.toISOString()
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organization members' });
  }
});

router.post('/:id/members', async (req, res) => {
  try {
    const { userId, role = 'member' } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const validRoles = ['admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const member = await prisma.orgMember.create({
      data: {
        orgId: req.params.id,
        userId,
        role
      }
    });

    res.status(201).json({
      success: true,
      memberId: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add member to organization' });
  }
});

router.put('/:id/members/:memberId', async (req, res) => {
  try {
    const { role } = req.body;

    const validRoles = ['admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const member = await prisma.orgMember.update({
      where: { id: req.params.memberId },
      data: { role }
    });

    res.json({
      success: true,
      memberId: member.id,
      role: member.role
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    await prisma.orgMember.delete({
      where: { id: req.params.memberId }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member from organization' });
  }
});

router.get('/:id/children', async (req, res) => {
  try {
    const children = await prisma.organization.findMany({
      where: { parentId: req.params.id },
      include: { members: true }
    });

    res.json(children.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      type: c.type,
      memberCount: c.members.length,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString()
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organization children' });
  }
});

export default router;