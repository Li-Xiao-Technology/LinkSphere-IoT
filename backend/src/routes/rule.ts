import express from 'express';
import { prisma } from '../prisma/client';
import { RuleEngine } from '../managers/RuleEngine';
import { DeviceManager } from '../managers/DeviceManager';
import { AutomationRule, RuleCondition, SceneAction, TriggerType } from '../types';
import { validate } from '../middleware/validate';
import { idParamSchema, ruleCreateSchema, ruleUpdateSchema } from '../validation/schemas';

const router = express.Router();
const ruleEngine = RuleEngine.getInstance();

function mapRuleRow(row: {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  triggerCondition: string;
  actions: string;
  cronExpression: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  ruleConditions: Array<{
    deviceId: string | null;
    property: string | null;
    operator: string | null;
    value: string | null;
    logic: string | null;
  }>;
  ruleActions: Array<{
    deviceId: string;
    action: string;
    params: string | null;
  }>;
}): AutomationRule {
  let triggerCondition: RuleCondition;
  if (row.triggerType === 'time') {
    triggerCondition = { cronExpression: row.cronExpression || undefined };
  } else if (row.triggerType === 'device_state' && row.ruleConditions.length > 0) {
    triggerCondition = {
      conditions: row.ruleConditions.map((c) => ({
        deviceId: c.deviceId!,
        property: c.property!,
        operator: c.operator as '>' | '<' | '==' | '>=' | '<=' | '!=' | 'changes',
        value: c.value ? (() => { try { return JSON.parse(c.value); } catch { return c.value; } })() : undefined,
      })),
      logic: (row.ruleConditions[0]?.logic as 'AND' | 'OR') || 'AND',
    };
  } else {
    triggerCondition = JSON.parse(row.triggerCondition || '{}') as RuleCondition;
  }

  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    triggerType: row.triggerType as TriggerType,
    triggerCondition,
    actions: row.ruleActions.length > 0
      ? row.ruleActions.map((a) => ({
          deviceId: a.deviceId,
          action: a.action,
          parameters: a.params ? JSON.parse(a.params) : {},
        }))
      : (JSON.parse(row.actions || '[]') as SceneAction[]),
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

router.get('/', async (req, res) => {
  try {
    const rows = await prisma.rule.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        ruleConditions: { orderBy: { sortOrder: 'asc' } },
        ruleActions: { orderBy: { sortOrder: 'asc' } },
      },
    });
    res.json(rows.map(mapRuleRow));
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', validate({ body: ruleCreateSchema }), async (req, res) => {
  const { name, triggerType, triggerCondition, actions } = req.body;
  if (!name || !triggerType || !triggerCondition || !actions) {
    return res.status(400).json({ error: 'name, triggerType, triggerCondition and actions are required' });
  }

  const id = `rule-${Date.now()}`;

  try {
    const cronExpression = triggerType === 'time' ? triggerCondition.cronExpression : null;

    const rule = await prisma.rule.create({
      data: {
        id,
        name,
        enabled: true,
        triggerType,
        triggerCondition: JSON.stringify(triggerCondition),
        actions: JSON.stringify(actions),
        cronExpression,
      },
    });

    if (triggerType === 'device_state' && triggerCondition.conditions && triggerCondition.conditions.length > 0) {
      await prisma.ruleCondition.createMany({
        data: triggerCondition.conditions.map((c: { deviceId: string; property: string; operator: string; value: unknown }, idx: number) => ({
          ruleId: id,
          deviceId: c.deviceId,
          property: c.property,
          operator: c.operator,
          value: JSON.stringify(c.value),
          logic: triggerCondition.logic || 'AND',
          sortOrder: idx,
        })),
      });
    }

    if (actions.length > 0) {
      await prisma.ruleAction.createMany({
        data: actions.map((a: { deviceId: string; action: string; parameters?: Record<string, unknown> }, idx: number) => ({
          ruleId: id,
          deviceId: a.deviceId,
          action: a.action,
          params: a.parameters ? JSON.stringify(a.parameters) : null,
          sortOrder: idx,
        })),
      });
    }

    const automationRule: AutomationRule = {
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      triggerType: rule.triggerType as TriggerType,
      triggerCondition,
      actions,
    };

    ruleEngine.addRule(automationRule);
    res.json(automationRule);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, triggerType, triggerCondition, actions, enabled } = req.body;

  try {
    const cronExpression = triggerType === 'time' ? triggerCondition?.cronExpression : null;

    const rule = await prisma.rule.update({
      where: { id: req.params.id },
      data: {
        name,
        triggerType,
        triggerCondition: JSON.stringify(triggerCondition),
        actions: JSON.stringify(actions),
        enabled,
        cronExpression,
        updatedAt: new Date(),
      },
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // Delete old conditions and actions
    await prisma.ruleCondition.deleteMany({ where: { ruleId: req.params.id } });
    await prisma.ruleAction.deleteMany({ where: { ruleId: req.params.id } });

    // Recreate conditions
    if (triggerType === 'device_state' && triggerCondition?.conditions && triggerCondition.conditions.length > 0) {
      await prisma.ruleCondition.createMany({
        data: triggerCondition.conditions.map((c: { deviceId: string; property: string; operator: string; value: unknown }, idx: number) => ({
          ruleId: req.params.id,
          deviceId: c.deviceId,
          property: c.property,
          operator: c.operator,
          value: JSON.stringify(c.value),
          logic: triggerCondition.logic || 'AND',
          sortOrder: idx,
        })),
      });
    }

    // Recreate actions
    if (actions && actions.length > 0) {
      await prisma.ruleAction.createMany({
        data: actions.map((a: { deviceId: string; action: string; parameters?: Record<string, unknown> }, idx: number) => ({
          ruleId: req.params.id,
          deviceId: a.deviceId,
          action: a.action,
          params: a.parameters ? JSON.stringify(a.parameters) : null,
          sortOrder: idx,
        })),
      });
    }

    const automationRule: AutomationRule = {
      id: req.params.id,
      name,
      enabled: !!enabled,
      triggerType,
      triggerCondition,
      actions,
    };

    ruleEngine.updateRule(automationRule);
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const rule = await prisma.rule.delete({
      where: { id: req.params.id },
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    ruleEngine.removeRule(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to delete does not exist')) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/:id/toggle', async (req, res) => {
  try {
    const row = await prisma.rule.findUnique({
      where: { id: req.params.id },
    });

    if (!row) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const newEnabled = !row.enabled;

    await prisma.rule.update({
      where: { id: req.params.id },
      data: {
        enabled: newEnabled,
        updatedAt: new Date(),
      },
    });

    if (newEnabled) {
      ruleEngine.enableRule(req.params.id);
    } else {
      ruleEngine.disableRule(req.params.id);
    }

    res.json({ success: true, enabled: newEnabled });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/:id/test', validate({ params: idParamSchema }), async (req, res) => {
  try {
    const row = await prisma.rule.findUnique({
      where: { id: req.params.id },
      include: {
        ruleConditions: { orderBy: { sortOrder: 'asc' } },
        ruleActions: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!row) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const rule = mapRuleRow(row);
    const deviceManager = DeviceManager.getInstance();
    const results = await Promise.all(rule.actions.map(async (action) => {
      try {
        const success = await deviceManager.setDeviceState(action.deviceId, action.parameters || {});
        return { deviceId: action.deviceId, success };
      } catch (error) {
        return { deviceId: action.deviceId, success: false, error: (error as Error).message };
      }
    }));

    res.json({ success: results.every((r) => r.success), results });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:id/history', async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate, limit = 100 } = req.query;

  const where: {
    ruleId: string;
    executedAt?: {
      gte?: Date;
      lte?: Date;
    };
  } = { ruleId: id };

  if (startDate) {
    where.executedAt = where.executedAt || {};
    where.executedAt.gte = new Date(startDate as string);
  }
  if (endDate) {
    where.executedAt = where.executedAt || {};
    where.executedAt.lte = new Date(endDate as string);
  }

  try {
    const history = await prisma.ruleExecutionHistory.findMany({
      where,
      orderBy: { executedAt: 'desc' },
      take: parseInt(limit as string, 10),
      include: { rule: { select: { name: true } } },
    });

    res.json(history);
  } catch (error) {
    console.error('Failed to get rule execution history:', error);
    res.status(500).json({ error: 'Failed to get rule execution history' });
  }
});

router.get('/history', async (req, res) => {
  const { startDate, endDate, limit = 100, ruleId } = req.query;

  const where: {
    ruleId?: string;
    executedAt?: {
      gte?: Date;
      lte?: Date;
    };
  } = {};

  if (ruleId) {
    where.ruleId = ruleId as string;
  }
  if (startDate) {
    where.executedAt = where.executedAt || {};
    where.executedAt.gte = new Date(startDate as string);
  }
  if (endDate) {
    where.executedAt = where.executedAt || {};
    where.executedAt.lte = new Date(endDate as string);
  }

  try {
    const history = await prisma.ruleExecutionHistory.findMany({
      where,
      orderBy: { executedAt: 'desc' },
      take: parseInt(limit as string, 10),
      include: { rule: { select: { id: true, name: true } } },
    });

    res.json(history);
  } catch (error) {
    console.error('Failed to get rule execution history:', error);
    res.status(500).json({ error: 'Failed to get rule execution history' });
  }
});

export const ruleRoutes = router;
