import express from 'express';
import { prisma } from '../prisma/client';
import { ScheduleManager } from '../managers/ScheduleManager';
import { validate } from '../middleware/validate';
import { idParamSchema, scheduleCreateSchema, scheduleUpdateSchema } from '../validation/schemas';

const router = express.Router();
const scheduleManager = ScheduleManager.getInstance();

function buildScheduleActionData(actionStr: string, deviceId?: string) {
  try {
    const parsed = JSON.parse(actionStr) as { deviceId?: string; parameters?: Record<string, unknown> };
    const finalDeviceId = parsed.deviceId || deviceId;
    if (!finalDeviceId) {
      return null;
    }
    return {
      deviceId: finalDeviceId,
      params: parsed.parameters ? JSON.stringify(parsed.parameters) : null,
    };
  } catch {
    if (deviceId) {
      return { deviceId, params: null };
    }
    return null;
  }
}

router.get('/', async (req, res) => {
  try {
    const { deviceId } = req.query;
    const where = deviceId ? { deviceId: deviceId as string } : {};
    const rows = await prisma.schedule.findMany({
      where,
      include: { scheduleActions: true },
    });
    const schedules = rows.map((row) => {
      const { scheduleActions, ...rest } = row;
      return rest;
    });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await prisma.schedule.findUnique({
      where: { id: req.params.id },
      include: { scheduleActions: true },
    });
    if (!row) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    const { scheduleActions, ...rest } = row;
    res.json(rest);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', validate({ body: scheduleCreateSchema }), async (req, res) => {
  const { name, cronExpression, action, deviceId } = req.body;
  if (!name || !cronExpression || !action) {
    return res.status(400).json({ error: 'Name, cronExpression and action are required' });
  }

  try {
    const id = `schedule-${Date.now()}`;
    const schedule = await prisma.schedule.create({
      data: {
        id,
        name,
        cronExpression,
        action,
        deviceId,
        enabled: true,
      },
    });

    const actionData = buildScheduleActionData(action, deviceId);
    if (actionData) {
      await prisma.scheduleAction.create({
        data: {
          scheduleId: id,
          deviceId: actionData.deviceId,
          params: actionData.params,
        },
      });
    }

    const row = await prisma.schedule.findUnique({
      where: { id },
      include: { scheduleActions: true },
    });

    scheduleManager.addSchedule({
      id,
      name,
      cronExpression,
      action,
      deviceId,
      enabled: true,
      scheduleActions: row?.scheduleActions.map((a) => ({
        deviceId: a.deviceId,
        params: a.params || undefined,
      })) || [],
    });

    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, cronExpression, action, enabled, deviceId } = req.body;

  try {
    const schedule = await prisma.schedule.update({
      where: { id: req.params.id },
      data: {
        name,
        cronExpression,
        action,
        deviceId,
        enabled: !!enabled,
        updatedAt: new Date(),
      },
    });

    await prisma.scheduleAction.deleteMany({
      where: { scheduleId: req.params.id },
    });

    const actionData = buildScheduleActionData(action, deviceId);
    if (actionData) {
      await prisma.scheduleAction.create({
        data: {
          scheduleId: req.params.id,
          deviceId: actionData.deviceId,
          params: actionData.params,
        },
      });
    }

    const row = await prisma.schedule.findUnique({
      where: { id: req.params.id },
      include: { scheduleActions: true },
    });

    scheduleManager.updateSchedule({
      id: req.params.id,
      name,
      cronExpression,
      action,
      deviceId,
      enabled: !!enabled,
      scheduleActions: row?.scheduleActions.map((a) => ({
        deviceId: a.deviceId,
        params: a.params || undefined,
      })) || [],
    });

    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/:id', validate({ params: idParamSchema }), async (req, res) => {
  try {
    await prisma.schedule.delete({
      where: { id: req.params.id },
    });
    scheduleManager.removeSchedule(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to delete does not exist')) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/:id/toggle', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.id },
    });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const newEnabled = !schedule.enabled;
    await prisma.schedule.update({
      where: { id: req.params.id },
      data: {
        enabled: newEnabled,
        updatedAt: new Date(),
      },
    });

    if (newEnabled) {
      scheduleManager.enableSchedule(req.params.id);
    } else {
      scheduleManager.disableSchedule(req.params.id);
    }
    res.json({ success: true, enabled: newEnabled });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export const scheduleRoutes = router;
