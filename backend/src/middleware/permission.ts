import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        role: string;
      };
      permissions?: Set<string>;
    }
  }
}

// 权限检查中间件
export function requirePermission(permissionName: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
        return;
      }

      const userId = req.user.userId;

      // 获取用户信息和家庭角色
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userHouseholds: true
        }
      });

      if (!user) {
        res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        return;
      }

      // 获取用户在家庭中的角色
      const householdRole = user.userHouseholds.length > 0 
        ? user.userHouseholds[0].role 
        : 'member';

      // 查找权限定义
      const permission = await prisma.permission.findFirst({
        where: { name: permissionName }
      });

      if (!permission) {
        // 权限不存在，默认拒绝
        res.status(403).json({ 
          error: 'Permission not defined', 
          code: 'PERMISSION_NOT_DEFINED',
          permission: permissionName 
        });
        return;
      }

      // 查找角色权限
      const rolePermission = await prisma.rolePermission.findFirst({
        where: {
          role: householdRole,
          permissionId: permission.id
        }
      });

      // 查找用户自定义权限（覆盖角色权限）
      const userPermission = await prisma.userPermission.findFirst({
        where: {
          userId,
          permissionId: permission.id
        }
      });

      // 决定权限：用户自定义权限优先
      let allowed = false;
      if (userPermission) {
        allowed = userPermission.allowed;
      } else if (rolePermission) {
        allowed = rolePermission.allowed;
      }

      if (!allowed) {
        res.status(403).json({ 
          error: 'Insufficient permissions', 
          code: 'FORBIDDEN',
          requiredPermission: permissionName,
          currentRole: householdRole
        });
        return;
      }

      // 加载用户所有权限到请求对象（可选，用于后续检查）
      if (!req.permissions) {
        req.permissions = new Set<string>();
        const allRolePermissions = await prisma.rolePermission.findMany({
          where: { role: householdRole },
          include: { permission: true }
        });
        allRolePermissions.forEach(rp => {
          if (rp.allowed) {
            req.permissions!.add(rp.permission.name);
          }
        });

        const allUserPermissions = await prisma.userPermission.findMany({
          where: { userId },
          include: { permission: true }
        });
        allUserPermissions.forEach(up => {
          if (up.allowed) {
            req.permissions!.add(up.permission.name);
          } else {
            req.permissions!.delete(up.permission.name);
          }
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed', code: 'PERMISSION_CHECK_ERROR' });
    }
  };
}

// 批量权限检查中间件（需要满足任一权限）
export function requireAnyPermission(...permissionNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
        return;
      }

      const userId = req.user.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userHouseholds: true }
      });

      if (!user) {
        res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        return;
      }

      const householdRole = user.userHouseholds.length > 0 
        ? user.userHouseholds[0].role 
        : 'member';

      // 检查是否有任一权限
      for (const permName of permissionNames) {
        const permission = await prisma.permission.findFirst({
          where: { name: permName }
        });

        if (!permission) continue;

        const userPermission = await prisma.userPermission.findFirst({
          where: { userId, permissionId: permission.id }
        });

        if (userPermission && userPermission.allowed) {
          next();
          return;
        }

        const rolePermission = await prisma.rolePermission.findFirst({
          where: { role: householdRole, permissionId: permission.id }
        });

        if (rolePermission && rolePermission.allowed) {
          next();
          return;
        }
      }

      res.status(403).json({ 
        error: 'Insufficient permissions', 
        code: 'FORBIDDEN',
        requiredPermissions: permissionNames,
        currentRole: householdRole
      });
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed', code: 'PERMISSION_CHECK_ERROR' });
    }
  };
}

// 检查是否是家庭所有者或管理员
export function requireHouseholdAdmin() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
        return;
      }

      const userId = req.user.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userHouseholds: true }
      });

      if (!user) {
        res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        return;
      }

      // 检查是否是所有者或管理员
      const isAdmin = user.userHouseholds.some(uh => 
        uh.role === 'owner' || uh.role === 'admin'
      );

      if (!isAdmin) {
        res.status(403).json({ 
          error: 'Household admin privileges required', 
          code: 'FORBIDDEN'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Household admin check error:', error);
      res.status(500).json({ error: 'Permission check failed', code: 'PERMISSION_CHECK_ERROR' });
    }
  };
}