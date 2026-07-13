import express from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { Scene, SceneTemplate } from '../types';
import { DeviceManager } from '../managers/DeviceManager';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validate';
import { idParamSchema, sceneCreateSchema, sceneUpdateSchema } from '../validation/schemas';

const router = express.Router();
const deviceManager = DeviceManager.getInstance();

function mapSceneActions(actions: Array<{ deviceId: string; action: string; params: string | null }>) {
  return actions.map((a) => ({
    deviceId: a.deviceId,
    action: a.action,
    parameters: a.params ? JSON.parse(a.params) : {},
  }));
}

router.get('/', async (req, res) => {
  try {
    const rows = await prisma.scene.findMany({
      include: { sceneActions: { orderBy: { sortOrder: 'asc' } } },
    });
    const scenes = rows.map((row) => {
      const { sceneActions, ...rest } = row;
      return {
        ...rest,
        actions: mapSceneActions(sceneActions),
      };
    });
    res.json(scenes);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:id', validate({ params: idParamSchema }), async (req, res) => {
  try {
    const row = await prisma.scene.findUnique({
      where: { id: req.params.id },
      include: { sceneActions: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    const { sceneActions, ...rest } = row;
    const scene = {
      ...rest,
      actions: mapSceneActions(sceneActions),
    };
    res.json(scene);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', requirePermission('scene.create'), validate({ body: sceneCreateSchema }), async (req, res) => {
  const { name, description, icon, actions } = req.body;
  if (!name || !actions) {
    return res.status(400).json({ error: 'Name and actions are required' });
  }

  const id = `scene-${Date.now()}`;

  try {
    const scene = await prisma.scene.create({
      data: {
        id,
        name,
        description: description || null,
        icon: icon || null,
        actions: JSON.stringify(actions),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await prisma.sceneAction.createMany({
      data: actions.map((a: { deviceId: string; action: string; parameters?: Record<string, unknown> }, idx: number) => ({
        sceneId: id,
        deviceId: a.deviceId,
        action: a.action,
        params: a.parameters ? JSON.stringify(a.parameters) : null,
        sortOrder: idx,
      })),
    });

    res.json({
      ...scene,
      actions,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:id', requirePermission('scene.edit'), validate({ body: sceneUpdateSchema, params: idParamSchema }), async (req, res) => {
  const { name, description, icon, actions } = req.body;

  try {
    const scene = await prisma.scene.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        icon,
        actions: JSON.stringify(actions),
        updatedAt: new Date(),
      },
    });
    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    await prisma.sceneAction.deleteMany({
      where: { sceneId: req.params.id },
    });

    if (actions && actions.length > 0) {
      await prisma.sceneAction.createMany({
        data: actions.map((a: { deviceId: string; action: string; parameters?: Record<string, unknown> }, idx: number) => ({
          sceneId: req.params.id,
          deviceId: a.deviceId,
          action: a.action,
          params: a.parameters ? JSON.stringify(a.parameters) : null,
          sortOrder: idx,
        })),
      });
    }

    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/:id', requirePermission('scene.delete'), validate({ params: idParamSchema }), async (req, res) => {
  try {
    const scene = await prisma.scene.delete({
      where: { id: req.params.id },
    });
    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to delete does not exist')) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/:id/activate', requirePermission('scene.execute'), validate({ params: idParamSchema }), async (req, res) => {
  try {
    const row = await prisma.scene.findUnique({
      where: { id: req.params.id },
      include: { sceneActions: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!row) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const scene: Scene = {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      icon: row.icon ?? undefined,
      actions: mapSceneActions(row.sceneActions),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };

    const results = await Promise.all(scene.actions.map(async (action) => {
      try {
        const success = await deviceManager.setDeviceState(action.deviceId, action.parameters || {});
        return { deviceId: action.deviceId, success };
      } catch (error) {
        return { deviceId: action.deviceId, success: false, error: (error as Error).message };
      }
    }));

    res.json({ success: results.every((r) => r.success), results });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Scene Template APIs

// 预置场景模板数据（生产环境为空，由用户在系统中自行创建）
const presetTemplates: SceneTemplate[] = [];

// 获取场景模板列表
router.get('/templates', async (req, res) => {
  try {
    const dbTemplates = await prisma.sceneTemplate.findMany({
      include: { templateActions: { orderBy: { sortOrder: 'asc' } } },
    });
    const templates = dbTemplates.map((row) => {
      const { templateActions, ...rest } = row;
      return {
        ...rest,
        actions: mapSceneActions(templateActions),
      };
    });

    // 合并预置模板和数据库模板（预置模板优先显示）
    const allTemplates = [...presetTemplates, ...templates.filter((t) => !t.isPreset)];
    res.json(allTemplates);
  } catch (err) {
    // 如果数据库查询失败，返回预置模板
    res.json(presetTemplates);
  }
});

const fromTemplateSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  sceneId: z.string().optional(),
  customizations: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    deviceMappings: z.record(z.string(), z.string()).optional(),
  }).optional(),
});

// 从模板创建场景
router.post('/from-template', validate({ body: fromTemplateSchema }), async (req, res) => {
  const { templateId, customizations } = req.body;

  if (!templateId) {
    return res.status(400).json({ error: 'Template ID is required' });
  }

  try {
    // 找到模板
    let template: SceneTemplate | undefined = presetTemplates.find((t) => t.id === templateId);

    if (!template) {
      const dbTemplate = await prisma.sceneTemplate.findUnique({
        where: { id: templateId },
        include: { templateActions: { orderBy: { sortOrder: 'asc' } } },
      });
      if (dbTemplate) {
        const { templateActions, ...rest } = dbTemplate;
        template = {
          id: rest.id,
          name: rest.name,
          description: rest.description ?? undefined,
          icon: rest.icon ?? undefined,
          category: rest.category,
          actions: mapSceneActions(templateActions),
          isPreset: rest.isPreset,
          createdAt: rest.createdAt.toISOString(),
          updatedAt: rest.updatedAt.toISOString(),
        };
      }
    }

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // 应用自定义配置
    let actions = template.actions;
    if (customizations?.deviceMappings) {
      actions = actions.map((action) => {
        const mappedDeviceId = customizations.deviceMappings[action.deviceId];
        return mappedDeviceId ? { ...action, deviceId: mappedDeviceId } : action;
      });
    }

    // 创建新场景
    const sceneId = `scene-${Date.now()}`;
    const scene = await prisma.scene.create({
      data: {
        id: sceneId,
        name: customizations?.name || template.name,
        description: customizations?.description || template.description || null,
        icon: template.icon || null,
        actions: JSON.stringify(actions),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await prisma.sceneAction.createMany({
      data: actions.map((a, idx) => ({
        sceneId,
        deviceId: a.deviceId,
        action: a.action,
        params: a.parameters ? JSON.stringify(a.parameters) : null,
        sortOrder: idx,
      })),
    });

    res.json({
      ...scene,
      actions,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export const sceneRoutes = router;
