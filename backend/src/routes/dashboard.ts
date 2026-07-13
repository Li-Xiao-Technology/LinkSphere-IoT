import { Router } from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const dashboards = await prisma.dashboard.findMany({
      where: { userId },
      include: { widgets: true },
      orderBy: { createdAt: 'asc' }
    });

    res.json(dashboards.map(d => ({
      id: d.id,
      name: d.name,
      isDefault: d.isDefault,
      layout: JSON.parse(d.layout || '[]'),
      widgets: d.widgets.map(w => ({
        id: w.id,
        type: w.type,
        config: JSON.parse(w.config || '{}'),
        position: {
          x: w.positionX,
          y: w.positionY,
          w: w.width,
          h: w.height
        }
      })),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString()
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboards' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const dashboard = await prisma.dashboard.findUnique({
      where: { id: req.params.id, userId },
      include: { widgets: true }
    });

    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    res.json({
      id: dashboard.id,
      name: dashboard.name,
      isDefault: dashboard.isDefault,
      layout: JSON.parse(dashboard.layout || '[]'),
      widgets: dashboard.widgets.map(w => ({
        id: w.id,
        type: w.type,
        config: JSON.parse(w.config || '{}'),
        position: {
          x: w.positionX,
          y: w.positionY,
          w: w.width,
          h: w.height
        }
      })),
      createdAt: dashboard.createdAt.toISOString(),
      updatedAt: dashboard.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { name = '默认仪表盘', widgets = [], layout = [] } = req.body;

    if (widgets.length > 0 && !Array.isArray(widgets)) {
      return res.status(400).json({ error: 'widgets must be an array' });
    }

    const existingDefault = await prisma.dashboard.findFirst({
      where: { userId, isDefault: true }
    });

    const dashboard = await prisma.dashboard.create({
      data: {
        name,
        userId,
        isDefault: !existingDefault && widgets.length === 0,
        layout: JSON.stringify(layout),
        widgets: {
          create: widgets.map((w: any, index: number) => ({
            type: w.type,
            config: JSON.stringify(w.config || {}),
            positionX: w.position?.x || 0,
            positionY: w.position?.y || index,
            width: w.position?.w || 1,
            height: w.position?.h || 1
          }))
        }
      },
      include: { widgets: true }
    });

    res.status(201).json({
      id: dashboard.id,
      name: dashboard.name,
      isDefault: dashboard.isDefault,
      layout: JSON.parse(dashboard.layout || '[]'),
      widgets: dashboard.widgets.map(w => ({
        id: w.id,
        type: w.type,
        config: JSON.parse(w.config || '{}'),
        position: {
          x: w.positionX,
          y: w.positionY,
          w: w.width,
          h: w.height
        }
      })),
      createdAt: dashboard.createdAt.toISOString(),
      updatedAt: dashboard.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create dashboard' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { name, layout } = req.body;

    const dashboard = await prisma.dashboard.update({
      where: { id: req.params.id, userId },
      data: {
        ...(name && { name }),
        ...(layout && { layout: JSON.stringify(layout) })
      }
    });

    res.json({
      id: dashboard.id,
      name: dashboard.name,
      isDefault: dashboard.isDefault,
      layout: JSON.parse(dashboard.layout || '[]'),
      createdAt: dashboard.createdAt.toISOString(),
      updatedAt: dashboard.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update dashboard' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const dashboard = await prisma.dashboard.findUnique({
      where: { id: req.params.id, userId }
    });

    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    if (dashboard.isDefault) {
      return res.status(400).json({ error: 'Cannot delete default dashboard' });
    }

    await prisma.dashboard.delete({
      where: { id: req.params.id, userId }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete dashboard' });
  }
});

router.post('/:id/widgets', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { type, config = {}, position } = req.body;

    const dashboard = await prisma.dashboard.findUnique({
      where: { id: req.params.id, userId }
    });

    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    const widget = await prisma.dashboardWidget.create({
      data: {
        dashboardId: req.params.id,
        type,
        config: JSON.stringify(config),
        positionX: position?.x || 0,
        positionY: position?.y || 0,
        width: position?.w || 1,
        height: position?.h || 1
      }
    });

    res.status(201).json({
      id: widget.id,
      type: widget.type,
      config: JSON.parse(widget.config || '{}'),
      position: {
        x: widget.positionX,
        y: widget.positionY,
        w: widget.width,
        h: widget.height
      },
      createdAt: widget.createdAt.toISOString(),
      updatedAt: widget.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create widget' });
  }
});

router.put('/:id/widgets/:widgetId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { type, config, position } = req.body;

    const widget = await prisma.dashboardWidget.findFirst({
      where: { id: req.params.widgetId },
      include: { dashboard: true }
    });

    if (!widget || widget.dashboard.userId !== userId) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    const updated = await prisma.dashboardWidget.update({
      where: { id: req.params.widgetId },
      data: {
        ...(type && { type }),
        ...(config && { config: JSON.stringify(config) }),
        ...(position && {
          positionX: position.x,
          positionY: position.y,
          width: position.w,
          height: position.h
        })
      }
    });

    res.json({
      id: updated.id,
      type: updated.type,
      config: JSON.parse(updated.config || '{}'),
      position: {
        x: updated.positionX,
        y: updated.positionY,
        w: updated.width,
        h: updated.height
      },
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update widget' });
  }
});

router.delete('/:id/widgets/:widgetId', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const widget = await prisma.dashboardWidget.findFirst({
      where: { id: req.params.widgetId },
      include: { dashboard: true }
    });

    if (!widget || widget.dashboard.userId !== userId) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    await prisma.dashboardWidget.delete({
      where: { id: req.params.widgetId }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete widget' });
  }
});

router.post('/:id/set-default', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    await prisma.dashboard.updateMany({
      where: { userId },
      data: { isDefault: false }
    });

    const dashboard = await prisma.dashboard.update({
      where: { id: req.params.id, userId },
      data: { isDefault: true }
    });

    res.json({
      success: true,
      id: dashboard.id,
      name: dashboard.name,
      isDefault: dashboard.isDefault
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set default dashboard' });
  }
});

export default router;