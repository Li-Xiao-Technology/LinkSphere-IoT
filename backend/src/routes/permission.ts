import express from 'express';
import { prisma } from '../prisma/client';

const router = express.Router();

// 获取所有权限列表
router.get('/', async (req, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取用户的权限（合并角色权限和自定义权限）
router.get('/users/:id/permissions', async (req, res) => {
  try {
    const userId = req.params.id;

    // 获取用户信息和家庭角色
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userHouseholds: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 获取用户在家庭中的角色
    const householdRole = user.userHouseholds.length > 0 
      ? user.userHouseholds[0].role 
      : 'member';

    // 获取角色权限
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role: householdRole },
      include: { permission: true }
    });

    // 获取用户自定义权限
    const userPermissions = await prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true }
    });

    // 合并权限：自定义权限覆盖角色权限
    const permissionMap = new Map<string, { 
      id: string;
      name: string;
      displayName: string;
      category: string;
      allowed: boolean;
      source: 'role' | 'user';
    }>();

    // 先添加角色权限
    rolePermissions.forEach(rp => {
      permissionMap.set(rp.permissionId, {
        id: rp.permission.id,
        name: rp.permission.name,
        displayName: rp.permission.displayName,
        category: rp.permission.category,
        allowed: rp.allowed,
        source: 'role'
      });
    });

    // 用自定义权限覆盖
    userPermissions.forEach(up => {
      permissionMap.set(up.permissionId, {
        id: up.permission.id,
        name: up.permission.name,
        displayName: up.permission.displayName,
        category: up.permission.category,
        allowed: up.allowed,
        source: 'user'
      });
    });

    const permissions = Array.from(permissionMap.values());

    res.json({
      userId,
      role: householdRole,
      permissions
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 设置用户自定义权限
router.put('/users/:id/permissions', async (req, res) => {
  try {
    const userId = req.params.id;
    const { permissions } = req.body; // permissions: { permissionId: string, allowed: boolean }[]

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array' });
    }

    // 删除用户现有的所有自定义权限
    await prisma.userPermission.deleteMany({
      where: { userId }
    });

    // 批量创建新的权限设置
    const createPromises = permissions.map(p => {
      if (!p.permissionId || typeof p.allowed !== 'boolean') {
        return null;
      }
      return prisma.userPermission.create({
        data: {
          id: `userperm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId,
          permissionId: p.permissionId,
          allowed: p.allowed
        }
      });
    }).filter(Boolean);

    await Promise.all(createPromises);

    // 返回更新后的权限
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userHouseholds: true }
    });

    const householdRole = user?.userHouseholds.length ?? 0 > 0 
      ? user?.userHouseholds[0].role ?? 'member'
      : 'member';

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role: householdRole },
      include: { permission: true }
    });

    const userPermissions = await prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true }
    });

    const permissionMap = new Map<string, any>();
    rolePermissions.forEach(rp => {
      permissionMap.set(rp.permissionId, {
        id: rp.permission.id,
        name: rp.permission.name,
        displayName: rp.permission.displayName,
        category: rp.permission.category,
        allowed: rp.allowed,
        source: 'role'
      });
    });

    userPermissions.forEach(up => {
      permissionMap.set(up.permissionId, {
        id: up.permission.id,
        name: up.permission.name,
        displayName: up.permission.displayName,
        category: up.permission.category,
        allowed: up.allowed,
        source: 'user'
      });
    });

    res.json({
      userId,
      role: householdRole,
      permissions: Array.from(permissionMap.values())
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取角色权限配置
router.get('/roles/:role', async (req, res) => {
  try {
    const role = req.params.role;
    const validRoles = ['owner', 'admin', 'member', 'guest'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role },
      include: { permission: true }
    });

    res.json({
      role,
      permissions: rolePermissions.map(rp => ({
        id: rp.permission.id,
        name: rp.permission.name,
        displayName: rp.permission.displayName,
        category: rp.permission.category,
        allowed: rp.allowed
      }))
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 更新角色权限（仅限管理员）
router.put('/roles/:role', async (req, res) => {
  try {
    const role = req.params.role;
    const { permissions } = req.body; // permissions: { permissionId: string, allowed: boolean }[]
    const validRoles = ['owner', 'admin', 'member', 'guest'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array' });
    }

    // 更新或创建角色权限
    const updatePromises = permissions.map(async (p) => {
      if (!p.permissionId || typeof p.allowed !== 'boolean') {
        return null;
      }

      const existing = await prisma.rolePermission.findFirst({
        where: { role, permissionId: p.permissionId }
      });

      if (existing) {
        return prisma.rolePermission.update({
          where: { id: existing.id },
          data: { allowed: p.allowed }
        });
      } else {
        return prisma.rolePermission.create({
          data: {
            id: `roleperm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role,
            permissionId: p.permissionId,
            allowed: p.allowed
          }
        });
      }
    });

    await Promise.all(updatePromises.filter(Boolean));

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role },
      include: { permission: true }
    });

    res.json({
      role,
      permissions: rolePermissions.map(rp => ({
        id: rp.permission.id,
        name: rp.permission.name,
        displayName: rp.permission.displayName,
        category: rp.permission.category,
        allowed: rp.allowed
      }))
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 初始化权限数据（仅当权限表为空时执行）
router.post('/initialize', async (req, res) => {
  try {
    const existingPermissions = await prisma.permission.count();
    if (existingPermissions > 0) {
      return res.json({ message: 'Permissions already initialized', count: existingPermissions });
    }

    // 定义默认权限
    const defaultPermissions = [
      // 设备权限
      { id: 'perm-device-view', name: 'device.view', displayName: '查看设备', category: 'device', description: '查看设备列表和详情' },
      { id: 'perm-device-control', name: 'device.control', displayName: '控制设备', category: 'device', description: '控制设备开关和状态' },
      { id: 'perm-device-add', name: 'device.add', displayName: '添加设备', category: 'device', description: '添加新设备' },
      { id: 'perm-device-edit', name: 'device.edit', displayName: '编辑设备', category: 'device', description: '编辑设备信息' },
      { id: 'perm-device-delete', name: 'device.delete', displayName: '删除设备', category: 'device', description: '删除设备' },
      
      // 场景权限
      { id: 'perm-scene-view', name: 'scene.view', displayName: '查看场景', category: 'scene', description: '查看场景列表' },
      { id: 'perm-scene-execute', name: 'scene.execute', displayName: '执行场景', category: 'scene', description: '执行场景' },
      { id: 'perm-scene-create', name: 'scene.create', displayName: '创建场景', category: 'scene', description: '创建新场景' },
      { id: 'perm-scene-edit', name: 'scene.edit', displayName: '编辑场景', category: 'scene', description: '编辑场景' },
      { id: 'perm-scene-delete', name: 'scene.delete', displayName: '删除场景', category: 'scene', description: '删除场景' },
      
      // 规则权限
      { id: 'perm-rule-view', name: 'rule.view', displayName: '查看规则', category: 'rule', description: '查看自动化规则' },
      { id: 'perm-rule-create', name: 'rule.create', displayName: '创建规则', category: 'rule', description: '创建自动化规则' },
      { id: 'perm-rule-edit', name: 'rule.edit', displayName: '编辑规则', category: 'rule', description: '编辑自动化规则' },
      { id: 'perm-rule-delete', name: 'rule.delete', displayName: '删除规则', category: 'rule', description: '删除自动化规则' },
      
      // 定时任务权限
      { id: 'perm-schedule-view', name: 'schedule.view', displayName: '查看定时任务', category: 'schedule', description: '查看定时任务列表' },
      { id: 'perm-schedule-create', name: 'schedule.create', displayName: '创建定时任务', category: 'schedule', description: '创建定时任务' },
      { id: 'perm-schedule-edit', name: 'schedule.edit', displayName: '编辑定时任务', category: 'schedule', description: '编辑定时任务' },
      { id: 'perm-schedule-delete', name: 'schedule.delete', displayName: '删除定时任务', category: 'schedule', description: '删除定时任务' },
      
      // 家庭管理权限
      { id: 'perm-household-view', name: 'household.view', displayName: '查看家庭信息', category: 'household', description: '查看家庭信息' },
      { id: 'perm-household-manage', name: 'household.manage', displayName: '管理家庭', category: 'household', description: '管理家庭设置和成员' },
      { id: 'perm-household-invite', name: 'household.invite', displayName: '邀请成员', category: 'household', description: '邀请新成员加入家庭' },
      { id: 'perm-household-remove', name: 'household.remove', displayName: '移除成员', category: 'household', description: '移除家庭成员' },
      
      // 系统权限
      { id: 'perm-system-settings', name: 'system.settings', displayName: '系统设置', category: 'system', description: '修改系统设置' },
      { id: 'perm-permission-manage', name: 'permission.manage', displayName: '权限管理', category: 'system', description: '管理权限设置' },
    ];

    // 创建权限
    await prisma.permission.createMany({
      data: defaultPermissions
    });

    // 为不同角色设置默认权限
    const roleDefaultPermissions = {
      owner: defaultPermissions.map(p => ({ permissionId: p.id, allowed: true })),
      admin: [
        { permissionId: 'perm-device-view', allowed: true },
        { permissionId: 'perm-device-control', allowed: true },
        { permissionId: 'perm-device-add', allowed: true },
        { permissionId: 'perm-device-edit', allowed: true },
        { permissionId: 'perm-device-delete', allowed: true },
        { permissionId: 'perm-scene-view', allowed: true },
        { permissionId: 'perm-scene-execute', allowed: true },
        { permissionId: 'perm-scene-create', allowed: true },
        { permissionId: 'perm-scene-edit', allowed: true },
        { permissionId: 'perm-scene-delete', allowed: true },
        { permissionId: 'perm-rule-view', allowed: true },
        { permissionId: 'perm-rule-create', allowed: true },
        { permissionId: 'perm-rule-edit', allowed: true },
        { permissionId: 'perm-rule-delete', allowed: true },
        { permissionId: 'perm-schedule-view', allowed: true },
        { permissionId: 'perm-schedule-create', allowed: true },
        { permissionId: 'perm-schedule-edit', allowed: true },
        { permissionId: 'perm-schedule-delete', allowed: true },
        { permissionId: 'perm-household-view', allowed: true },
        { permissionId: 'perm-household-manage', allowed: true },
        { permissionId: 'perm-household-invite', allowed: true },
        { permissionId: 'perm-household-remove', allowed: true },
      ],
      member: [
        { permissionId: 'perm-device-view', allowed: true },
        { permissionId: 'perm-device-control', allowed: true },
        { permissionId: 'perm-scene-view', allowed: true },
        { permissionId: 'perm-scene-execute', allowed: true },
        { permissionId: 'perm-rule-view', allowed: true },
        { permissionId: 'perm-schedule-view', allowed: true },
        { permissionId: 'perm-household-view', allowed: true },
      ],
      guest: [
        { permissionId: 'perm-device-view', allowed: true },
        { permissionId: 'perm-scene-view', allowed: true },
        { permissionId: 'perm-household-view', allowed: true },
      ]
    };

    // 创建角色权限
    const rolePermissionData: any[] = [];
    Object.entries(roleDefaultPermissions).forEach(([role, perms]) => {
      perms.forEach(p => {
        rolePermissionData.push({
          id: `rp-${role}-${p.permissionId}`,
          role,
          permissionId: p.permissionId,
          allowed: p.allowed
        });
      });
    });

    await prisma.rolePermission.createMany({
      data: rolePermissionData
    });

    res.json({ 
      message: 'Permissions initialized successfully',
      permissions: defaultPermissions.length,
      rolePermissions: rolePermissionData.length
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export const permissionRoutes = router;