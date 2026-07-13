import express from 'express';
import { randomBytes } from 'crypto';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

// GET /export — Export all config as JSON
router.get('/export', authMiddleware, async (_req, res) => {
  try {
    const [devices, rules, scenes, schedules, rooms, webhooks, thresholds] = await Promise.all([
      prisma.device.findMany({
        include: {
          tags: { include: { tag: true } },
          thresholds: true,
        },
      }),
      prisma.rule.findMany({
        include: {
          ruleConditions: { orderBy: { sortOrder: 'asc' } },
          ruleActions: { orderBy: { sortOrder: 'asc' } },
        },
      }),
      prisma.scene.findMany({
        include: { sceneActions: { orderBy: { sortOrder: 'asc' } } },
      }),
      prisma.schedule.findMany({
        include: { scheduleActions: true },
      }),
      prisma.room.findMany(),
      prisma.webhookConfig.findMany(),
      prisma.alertThreshold.findMany(),
    ]);

    res.json({
      devices: devices.map((d) => ({
        ...d,
        tags: d.tags.map((t) => t.tag),
        thresholds: d.thresholds.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
        lastSyncTime: d.lastSyncTime?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
      rules: rules.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        ruleConditions: r.ruleConditions.map((c) => ({ ...c })),
        ruleActions: r.ruleActions.map((a) => ({ ...a })),
      })),
      scenes: scenes.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        sceneActions: s.sceneActions.map((a) => ({ ...a })),
      })),
      schedules: schedules.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        scheduleActions: s.scheduleActions.map((a) => ({ ...a })),
      })),
      rooms: rooms.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      webhooks: webhooks.map((w) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
      thresholds: thresholds.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error('Failed to export config', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /import — Import config from JSON body
router.post('/import', authMiddleware, async (req, res) => {
  const { devices, rules, scenes, schedules, rooms, webhooks, thresholds } = req.body || {};
  const imported = {
    devices: 0,
    rules: 0,
    scenes: 0,
    schedules: 0,
    rooms: 0,
    webhooks: 0,
    thresholds: 0,
  };

  try {
    await prisma.$transaction(async (tx) => {
      const deviceIdMap = new Map<string, string>();
      const roomIdMap = new Map<string, string>();
      const tagIdMap = new Map<string, string>();

      // Rooms
      if (Array.isArray(rooms)) {
        for (const room of rooms) {
          const newRoomId = newId('room');
          roomIdMap.set(room.id, newRoomId);
          await tx.room.create({
            data: {
              id: newRoomId,
              name: room.name,
              icon: room.icon || 'home',
              sortIndex: room.sortIndex || 0,
            },
          });
          imported.rooms++;
        }
      }

      // Devices (with tags and thresholds)
      if (Array.isArray(devices)) {
        for (const device of devices) {
          const newDeviceId = newId('device');
          deviceIdMap.set(device.id, newDeviceId);
          await tx.device.create({
            data: {
              id: newDeviceId,
              name: device.name,
              brand: device.brand,
              type: device.type,
              model: device.model || null,
              status: device.status || 'offline',
              connectionType: device.connectionType,
              ipAddress: device.ipAddress || null,
              macAddress: device.macAddress || null,
              firmwareVersion: device.firmwareVersion || null,
              config: device.config || null,
              roomId: device.roomId ? (roomIdMap.get(device.roomId) || device.roomId) : null,
              powerConsumption: device.powerConsumption || 0,
              networkName: device.networkName || null,
              networkStrength: device.networkStrength || null,
              sn: device.sn || null,
            },
          });

          // Tags (find or create by name)
          if (Array.isArray(device.tags)) {
            for (const tag of device.tags) {
              let newTagId = tagIdMap.get(tag.id);
              if (!newTagId) {
                const existing = await tx.deviceTag.findUnique({ where: { name: tag.name } });
                if (existing) {
                  newTagId = existing.id;
                } else {
                  newTagId = newId('tag');
                  await tx.deviceTag.create({
                    data: {
                      id: newTagId,
                      name: tag.name,
                      color: tag.color || '#005FB8',
                    },
                  });
                }
                tagIdMap.set(tag.id, newTagId);
              }
              const existing = await tx.deviceTagRelation.findUnique({
                where: { deviceId_tagId: { deviceId: newDeviceId, tagId: newTagId } },
              });
              if (!existing) {
                await tx.deviceTagRelation.create({
                  data: { deviceId: newDeviceId, tagId: newTagId },
                });
              }
            }
          }

          // Nested thresholds
          if (Array.isArray(device.thresholds)) {
            for (const th of device.thresholds) {
              await tx.alertThreshold.create({
                data: {
                  deviceId: newDeviceId,
                  property: th.property,
                  minValue: th.minValue ?? null,
                  maxValue: th.maxValue ?? null,
                  enabled: th.enabled ?? true,
                },
              });
            }
          }

          imported.devices++;
        }
      }

      // Rules (with conditions and actions)
      if (Array.isArray(rules)) {
        for (const rule of rules) {
          const newRuleId = newId('rule');
          await tx.rule.create({
            data: {
              id: newRuleId,
              name: rule.name,
              enabled: rule.enabled ?? true,
              triggerType: rule.triggerType,
              triggerCondition: rule.triggerCondition || '{}',
              actions: rule.actions || '[]',
              cronExpression: rule.cronExpression || null,
            },
          });

          if (Array.isArray(rule.ruleConditions)) {
            for (const c of rule.ruleConditions) {
              await tx.ruleCondition.create({
                data: {
                  ruleId: newRuleId,
                  deviceId: c.deviceId ? (deviceIdMap.get(c.deviceId) || c.deviceId) : null,
                  property: c.property || null,
                  operator: c.operator || null,
                  value: c.value || null,
                  logic: c.logic || 'AND',
                  sortOrder: c.sortOrder || 0,
                },
              });
            }
          }

          if (Array.isArray(rule.ruleActions)) {
            for (const a of rule.ruleActions) {
              await tx.ruleAction.create({
                data: {
                  ruleId: newRuleId,
                  deviceId: deviceIdMap.get(a.deviceId) || a.deviceId,
                  action: a.action,
                  params: a.params || null,
                  delay: a.delay || 0,
                  sortOrder: a.sortOrder || 0,
                },
              });
            }
          }

          imported.rules++;
        }
      }

      // Scenes (with actions)
      if (Array.isArray(scenes)) {
        for (const scene of scenes) {
          const newSceneId = newId('scene');
          await tx.scene.create({
            data: {
              id: newSceneId,
              name: scene.name,
              description: scene.description || null,
              icon: scene.icon || null,
              actions: scene.actions || '[]',
            },
          });

          if (Array.isArray(scene.sceneActions)) {
            for (const a of scene.sceneActions) {
              await tx.sceneAction.create({
                data: {
                  sceneId: newSceneId,
                  deviceId: deviceIdMap.get(a.deviceId) || a.deviceId,
                  action: a.action,
                  params: a.params || null,
                  sortOrder: a.sortOrder || 0,
                },
              });
            }
          }

          imported.scenes++;
        }
      }

      // Schedules (with actions)
      if (Array.isArray(schedules)) {
        for (const schedule of schedules) {
          const newScheduleId = newId('schedule');
          await tx.schedule.create({
            data: {
              id: newScheduleId,
              name: schedule.name,
              cronExpression: schedule.cronExpression,
              action: schedule.action || '{}',
              enabled: schedule.enabled ?? true,
              deviceId: schedule.deviceId ? (deviceIdMap.get(schedule.deviceId) || schedule.deviceId) : null,
            },
          });

          if (Array.isArray(schedule.scheduleActions)) {
            for (const a of schedule.scheduleActions) {
              await tx.scheduleAction.create({
                data: {
                  scheduleId: newScheduleId,
                  deviceId: deviceIdMap.get(a.deviceId) || a.deviceId,
                  params: a.params || null,
                },
              });
            }
          }

          imported.schedules++;
        }
      }

      // Webhooks
      if (Array.isArray(webhooks)) {
        for (const webhook of webhooks) {
          await tx.webhookConfig.create({
            data: {
              name: webhook.name,
              url: webhook.url,
              method: webhook.method || 'POST',
              headers: webhook.headers || null,
              events: webhook.events || '[]',
              enabled: webhook.enabled ?? true,
            },
          });
          imported.webhooks++;
        }
      }

      // Top-level thresholds
      if (Array.isArray(thresholds)) {
        for (const th of thresholds) {
          await tx.alertThreshold.create({
            data: {
              deviceId: deviceIdMap.get(th.deviceId) || th.deviceId,
              property: th.property,
              minValue: th.minValue ?? null,
              maxValue: th.maxValue ?? null,
              enabled: th.enabled ?? true,
            },
          });
          imported.thresholds++;
        }
      }
    });

    res.json({ success: true, imported });
  } catch (err) {
    logger.error('Failed to import config', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
