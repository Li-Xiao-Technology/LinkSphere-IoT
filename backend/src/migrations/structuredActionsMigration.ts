import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

/**
 * One-time migration: move JSON action/condition blobs into structured relation tables.
 * Safe to run multiple times (skips already-migrated rows).
 */
export async function migrateStructuredActions(): Promise<void> {
  // 1. Migrate Scene actions
  const scenesToMigrate = await prisma.scene.findMany({
    where: {
      actions: { not: '' },
      sceneActions: { none: {} },
    },
  });

  for (const scene of scenesToMigrate) {
    try {
      const actions = JSON.parse(scene.actions || '[]') as Array<{
        deviceId: string;
        action: string;
        parameters?: Record<string, unknown>;
      }>;
      if (Array.isArray(actions) && actions.length > 0) {
        await prisma.sceneAction.createMany({
          data: actions.map((a, idx) => ({
            sceneId: scene.id,
            deviceId: a.deviceId,
            action: a.action,
            params: a.parameters ? JSON.stringify(a.parameters) : null,
            sortOrder: idx,
          })),
        });
      }
    } catch (e) {
      logger.error(`Failed to migrate scene ${scene.id}`, e as Error);
    }
  }
  if (scenesToMigrate.length > 0) {
    logger.info(`Migrated ${scenesToMigrate.length} scenes to structured actions`);
  }

  // 2. Migrate SceneTemplate actions
  const templatesToMigrate = await prisma.sceneTemplate.findMany({
    where: {
      actions: { not: '' },
      templateActions: { none: {} },
    },
  });

  for (const template of templatesToMigrate) {
    try {
      const actions = JSON.parse(template.actions || '[]') as Array<{
        deviceId: string;
        action: string;
        parameters?: Record<string, unknown>;
      }>;
      if (Array.isArray(actions) && actions.length > 0) {
        await prisma.sceneTemplateAction.createMany({
          data: actions.map((a, idx) => ({
            templateId: template.id,
            deviceId: a.deviceId,
            action: a.action,
            params: a.parameters ? JSON.stringify(a.parameters) : null,
            sortOrder: idx,
          })),
        });
      }
    } catch (e) {
      logger.error(`Failed to migrate scene template ${template.id}`, e as Error);
    }
  }
  if (templatesToMigrate.length > 0) {
    logger.info(`Migrated ${templatesToMigrate.length} scene templates to structured actions`);
  }

  // 3. Migrate Rule conditions and actions
  const rulesToMigrate = await prisma.rule.findMany({
    where: {
      OR: [
        { triggerCondition: { not: '' }, ruleConditions: { none: {} } },
        { actions: { not: '' }, ruleActions: { none: {} } },
      ],
    },
  });

  for (const rule of rulesToMigrate) {
    try {
      // Migrate triggerCondition
      const condition = JSON.parse(rule.triggerCondition || '{}') as Record<string, unknown>;

      if (rule.triggerType === 'time') {
        const cron = condition.cronExpression as string | undefined;
        if (cron) {
          await prisma.rule.update({
            where: { id: rule.id },
            data: { cronExpression: cron },
          });
        }
      } else if (rule.triggerType === 'device_state') {
        // Multi-device grouped conditions
        const conditions = condition.conditions as Array<{
          deviceId: string;
          property: string;
          operator: string;
          value: unknown;
        }> | undefined;
        const logic = (condition.logic as string) || 'AND';

        if (Array.isArray(conditions) && conditions.length > 0) {
          await prisma.ruleCondition.createMany({
            data: conditions.map((c, idx) => ({
              ruleId: rule.id,
              deviceId: c.deviceId,
              property: c.property,
              operator: c.operator,
              value: JSON.stringify(c.value),
              logic,
              sortOrder: idx,
            })),
          });
        } else if (condition.deviceId) {
          // Legacy single condition
          await prisma.ruleCondition.create({
            data: {
              ruleId: rule.id,
              deviceId: condition.deviceId as string,
              property: condition.property as string,
              operator: condition.operator as string,
              value: JSON.stringify(condition.value),
              sortOrder: 0,
            },
          });
        }
      }

      // Migrate actions
      const actions = JSON.parse(rule.actions || '[]') as Array<{
        deviceId: string;
        action: string;
        parameters?: Record<string, unknown>;
      }>;
      if (Array.isArray(actions) && actions.length > 0) {
        await prisma.ruleAction.createMany({
          data: actions.map((a, idx) => ({
            ruleId: rule.id,
            deviceId: a.deviceId,
            action: a.action,
            params: a.parameters ? JSON.stringify(a.parameters) : null,
            sortOrder: idx,
          })),
        });
      }
    } catch (e) {
      logger.error(`Failed to migrate rule ${rule.id}`, e as Error);
    }
  }
  if (rulesToMigrate.length > 0) {
    logger.info(`Migrated ${rulesToMigrate.length} rules to structured conditions/actions`);
  }

  // 4. Migrate Schedule actions
  const schedulesToMigrate = await prisma.schedule.findMany({
    where: {
      action: { not: '' },
      scheduleActions: { none: {} },
    },
  });

  for (const schedule of schedulesToMigrate) {
    try {
      const action = JSON.parse(schedule.action || '{}') as {
        deviceId?: string;
        parameters?: Record<string, unknown>;
      };
      const deviceId = action.deviceId || schedule.deviceId;
      if (deviceId) {
        await prisma.scheduleAction.create({
          data: {
            scheduleId: schedule.id,
            deviceId,
            params: action.parameters ? JSON.stringify(action.parameters) : null,
          },
        });
      }
    } catch (e) {
      logger.error(`Failed to migrate schedule ${schedule.id}`, e as Error);
    }
  }
  if (schedulesToMigrate.length > 0) {
    logger.info(`Migrated ${schedulesToMigrate.length} schedules to structured actions`);
  }
}
