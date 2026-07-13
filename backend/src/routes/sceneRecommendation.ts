import { Router } from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { randomUUID } from 'crypto';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const recommendations = await prisma.sceneRecommendation.findMany({
      where: { userId },
      orderBy: { confidence: 'desc' }
    });

    res.json(recommendations.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      icon: r.icon,
      devices: JSON.parse(r.devices || '[]'),
      confidence: r.confidence,
      applied: r.applied,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scene recommendations' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const recommendation = await prisma.sceneRecommendation.findUnique({
      where: { id: req.params.id, userId }
    });

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    res.json({
      id: recommendation.id,
      name: recommendation.name,
      description: recommendation.description,
      icon: recommendation.icon,
      devices: JSON.parse(recommendation.devices || '[]'),
      confidence: recommendation.confidence,
      applied: recommendation.applied,
      createdAt: recommendation.createdAt.toISOString(),
      updatedAt: recommendation.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scene recommendation' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const devices = await prisma.device.findMany({});
    if (devices.length === 0) {
      return res.status(400).json({ error: 'No devices found to generate recommendations' });
    }

    const recommendations = generateRecommendations(devices);

    const savedRecommendations = [];
    for (const rec of recommendations) {
      const existing = await prisma.sceneRecommendation.findFirst({
        where: { userId, name: rec.name }
      });

      if (!existing) {
        const saved = await prisma.sceneRecommendation.create({
          data: {
            userId,
            name: rec.name,
            description: rec.description,
            icon: rec.icon,
            devices: JSON.stringify(rec.devices),
            confidence: rec.confidence
          }
        });
        savedRecommendations.push(saved);
      }
    }

    res.json({
      success: true,
      count: savedRecommendations.length,
      recommendations: savedRecommendations.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        icon: r.icon,
        devices: JSON.parse(r.devices || '[]'),
        confidence: r.confidence,
        applied: r.applied,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate scene recommendations' });
  }
});

router.post('/:id/apply', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const recommendation = await prisma.sceneRecommendation.findUnique({
      where: { id: req.params.id, userId }
    });

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    const devices = JSON.parse(recommendation.devices || '[]');
    const sceneActions = devices.map((d: any) => ({
      deviceId: d.deviceId,
      action: d.action,
      params: d.params ? JSON.stringify(d.params) : null
    }));

    const scene = await prisma.scene.create({
      data: {
        id: randomUUID(),
        name: recommendation.name,
        description: recommendation.description,
        icon: recommendation.icon,
        actions: JSON.stringify(sceneActions),
        sceneActions: {
          create: sceneActions.map((a: any, i: number) => ({
            deviceId: a.deviceId,
            action: a.action,
            params: a.params,
            sortOrder: i
          }))
        }
      }
    });

    await prisma.sceneRecommendation.update({
      where: { id: req.params.id },
      data: { applied: true }
    });

    res.json({
      success: true,
      sceneId: scene.id,
      sceneName: scene.name,
      message: 'Scene created successfully from recommendation'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply scene recommendation' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    await prisma.sceneRecommendation.delete({
      where: { id: req.params.id, userId }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete scene recommendation' });
  }
});

function generateRecommendations(devices: any[]): any[] {
  const recommendations: any[] = [];
  const lightDevices = devices.filter(d => d.type === 'light');
  const switchDevices = devices.filter(d => d.type === 'switch');
  const airconDevices = devices.filter(d => d.type === 'airconditioner');
  const sensorDevices = devices.filter(d => d.type === 'sensor');

  if (lightDevices.length >= 2) {
    recommendations.push({
      name: '晚安模式',
      description: '关闭所有灯光和电器，进入睡眠状态',
      icon: 'moon',
      devices: [
        ...lightDevices.slice(0, 3).map(d => ({
          deviceId: d.id,
          action: 'power',
          params: { power: false }
        })),
        ...switchDevices.slice(0, 2).map(d => ({
          deviceId: d.id,
          action: 'power',
          params: { power: false }
        }))
      ],
      confidence: 0.95
    });
  }

  if (lightDevices.length >= 1) {
    recommendations.push({
      name: '回家模式',
      description: '打开所有灯光，欢迎回家',
      icon: 'home',
      devices: lightDevices.slice(0, 3).map(d => ({
        deviceId: d.id,
        action: 'power',
        params: { power: true, brightness: 80 }
      })),
      confidence: 0.9
    });
  }

  if (airconDevices.length >= 1) {
    recommendations.push({
      name: '舒适模式',
      description: '设置空调到舒适温度',
      icon: 'thermometer',
      devices: airconDevices.slice(0, 2).map(d => ({
        deviceId: d.id,
        action: 'power',
        params: { power: true, temperature: 25, mode: 'auto' }
      })),
      confidence: 0.85
    });
  }

  if (lightDevices.length >= 1 && sensorDevices.length >= 1) {
    recommendations.push({
      name: '离家模式',
      description: '关闭所有设备，确保安全',
      icon: 'log-out',
      devices: [
        ...lightDevices.map(d => ({
          deviceId: d.id,
          action: 'power',
          params: { power: false }
        })),
        ...switchDevices.map(d => ({
          deviceId: d.id,
          action: 'power',
          params: { power: false }
        }))
      ],
      confidence: 0.8
    });
  }

  if (lightDevices.length >= 2) {
    recommendations.push({
      name: '影院模式',
      description: '调暗灯光，营造影院氛围',
      icon: 'film',
      devices: lightDevices.slice(0, 3).map(d => ({
        deviceId: d.id,
        action: 'power',
        params: { power: true, brightness: 20 }
      })),
      confidence: 0.75
    });
  }

  if (lightDevices.length >= 1 && switchDevices.length >= 1) {
    recommendations.push({
      name: '聚会模式',
      description: '打开所有灯光和电器，准备聚会',
      icon: 'party-popper',
      devices: [
        ...lightDevices.map(d => ({
          deviceId: d.id,
          action: 'power',
          params: { power: true, brightness: 100 }
        })),
        ...switchDevices.map(d => ({
          deviceId: d.id,
          action: 'power',
          params: { power: true }
        }))
      ],
      confidence: 0.7
    });
  }

  return recommendations;
}

export default router;