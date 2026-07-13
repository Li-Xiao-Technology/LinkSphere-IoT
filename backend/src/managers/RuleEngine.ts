import { CronJob } from 'cron';
import { DeviceManager } from './DeviceManager';
import { NotificationManager } from './NotificationManager';
import { AutomationRule, DeviceState, RuleCondition, SceneAction, DeviceCondition } from '../types';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';
import { webhookEvents } from '../services/webhookService';

export class RuleEngine {
  private static instance: RuleEngine;
  private rules: Map<string, { rule: AutomationRule; job?: CronJob }> = new Map();
  private deviceManager = DeviceManager.getInstance();
  private notificationManager = NotificationManager.getInstance();

  private constructor() {}

  public static getInstance(): RuleEngine {
    if (!RuleEngine.instance) {
      RuleEngine.instance = new RuleEngine();
    }
    return RuleEngine.instance;
  }

  public addRule(rule: AutomationRule): void {
    if (this.rules.has(rule.id)) {
      this.removeRule(rule.id);
    }

    let job: CronJob | undefined;
    if (rule.enabled && rule.triggerType === 'time') {
      const cronExpression = rule.triggerCondition.cronExpression;
      if (cronExpression) {
        try {
          job = new CronJob(cronExpression, async () => {
            await this.executeActions(rule.id, rule.actions);
          });
          job.start();
        } catch (error) {
          logger.error(`Invalid cron expression for rule ${rule.id}`, error as Error);
        }
      }
    }

    this.rules.set(rule.id, { rule, job });
  }

  public removeRule(id: string): void {
    const item = this.rules.get(id);
    if (item) {
      if (item.job) {
        item.job.stop();
      }
      this.rules.delete(id);
    }
  }

  public updateRule(rule: AutomationRule): void {
    this.removeRule(rule.id);
    this.addRule(rule);
  }

  public enableRule(id: string): void {
    const item = this.rules.get(id);
    if (item) {
      item.rule.enabled = true;
      if (item.rule.triggerType === 'time' && item.rule.triggerCondition.cronExpression) {
        if (!item.job) {
          try {
            item.job = new CronJob(item.rule.triggerCondition.cronExpression, async () => {
              await this.executeActions(id, item.rule.actions);
            });
          } catch (error) {
            logger.error(`Invalid cron expression for rule ${id}`, error as Error);
          }
        }
        item.job?.start();
      }
    }
  }

  public disableRule(id: string): void {
    const item = this.rules.get(id);
    if (item) {
      item.rule.enabled = false;
      if (item.job) {
        item.job.stop();
      }
    }
  }

  public getAllRules(): AutomationRule[] {
    return Array.from(this.rules.values()).map(item => item.rule);
  }

  public async checkDeviceStateChange(deviceId: string, state: DeviceState): Promise<void> {
    for (const item of this.rules.values()) {
      const { rule } = item;
      if (!rule.enabled || rule.triggerType !== 'device_state') {
        continue;
      }

      const condition = rule.triggerCondition;

      // 新的多设备联动条件
      if (condition.conditions && condition.conditions.length > 0) {
        // 检查是否有任何条件涉及当前设备
        const hasRelevantCondition = condition.conditions.some(c => c.deviceId === deviceId);
        if (!hasRelevantCondition) {
          continue;
        }

        // 检查多设备联动条件是否全部满足
        if (await this.checkMultiDeviceConditions(condition.conditions, condition.logic || 'AND')) {
          await this.executeActions(rule.id, rule.actions);
        }
      }
      // 旧的单设备条件（向后兼容）
      else if (condition.deviceId) {
        if (condition.deviceId !== deviceId) {
          continue;
        }

        if (this.matchCondition(state, condition)) {
          await this.executeActions(rule.id, rule.actions);
        }
      }
    }
  }

  private matchCondition(state: DeviceState, condition: RuleCondition): boolean {
    if (!condition.property || condition.operator === undefined) {
      return false;
    }

    const stateValue = state[condition.property];
    const targetValue = condition.value;

    switch (condition.operator) {
      case '==':
        return stateValue === targetValue;
      case '!=':
        return stateValue !== targetValue;
      case '>':
        return typeof stateValue === 'number' && typeof targetValue === 'number' && stateValue > targetValue;
      case '<':
        return typeof stateValue === 'number' && typeof targetValue === 'number' && stateValue < targetValue;
      case '>=':
        return typeof stateValue === 'number' && typeof targetValue === 'number' && stateValue >= targetValue;
      case '<=':
        return typeof stateValue === 'number' && typeof targetValue === 'number' && stateValue <= targetValue;
      case 'changes':
        return stateValue !== undefined;
      default:
        return false;
    }
  }

  /**
   * 检查多设备联动条件
   * @param conditions 设备条件列表
   * @param logic 逻辑运算符（AND/OR）
   * @returns 是否满足所有条件
   */
  private async checkMultiDeviceConditions(conditions: DeviceCondition[], logic: 'AND' | 'OR'): Promise<boolean> {
    const results = await Promise.all(
      conditions.map(async (condition) => {
        try {
          const deviceState = await this.deviceManager.getDeviceState(condition.deviceId);
          if (!deviceState) return false;
          return this.matchSingleDeviceCondition(deviceState, condition);
        } catch (error) {
          logger.error(`Failed to get state for device ${condition.deviceId}`, error as Error);
          return false;
        }
      })
    );

    if (logic === 'AND') {
      return results.every(result => result);
    } else {
      return results.some(result => result);
    }
  }

  /**
   * 匹配单个设备条件
   * @param state 设备状态
   * @param condition 设备条件
   * @returns 是否匹配
   */
  private matchSingleDeviceCondition(state: DeviceState, condition: DeviceCondition): boolean {
    const stateValue = state[condition.property];
    const targetValue = condition.value;

    switch (condition.operator) {
      case '==':
        return stateValue === targetValue;
      case '!=':
        return stateValue !== targetValue;
      case '>':
        return typeof stateValue === 'number' && typeof targetValue === 'number' && stateValue > targetValue;
      case '<':
        return typeof stateValue === 'number' && typeof targetValue === 'number' && stateValue < targetValue;
      case '>=':
        return typeof stateValue === 'number' && typeof targetValue === 'number' && stateValue >= targetValue;
      case '<=':
        return typeof stateValue === 'number' && typeof targetValue === 'number' && stateValue <= targetValue;
      case 'changes':
        return stateValue !== undefined;
      default:
        return false;
    }
  }

  private async executeActions(ruleId: string, actions: SceneAction[]): Promise<void> {
    const rule = this.rules.get(ruleId)?.rule;
    const ruleName = rule?.name || ruleId;
    let successCount = 0;
    let failedCount = 0;

    for (const action of actions) {
      try {
        await this.deviceManager.setDeviceState(action.deviceId, action.parameters || {});
        successCount++;
      } catch (error) {
          logger.error(`Failed to execute action for device ${action.deviceId}`, error as Error);
          failedCount++;
        }
    }

    try {
      const status = failedCount === 0 ? 'success' : failedCount === actions.length ? 'failed' : 'partial';
      const message = `成功执行 ${successCount} 个动作${failedCount > 0 ? `，失败 ${failedCount} 个` : ''}`;

      await prisma.ruleExecutionHistory.create({
        data: {
          id: `${ruleId}-${Date.now()}`,
          ruleId,
          status,
          message,
        },
      });

      logger.info(`Rule ${ruleId} executed: ${status}`, { successCount, failedCount });
    } catch (error) {
      logger.error(`Failed to save rule execution history for ${ruleId}`, error as Error);
    }

    try {
      await this.notificationManager.create(
        'rule_triggered',
        `规则已触发: ${ruleName}`,
        `已执行 ${successCount}/${actions.length} 个动作`,
      );
    } catch (error) {
      logger.error('Failed to create rule_triggered notification', error as Error);
    }

    try {
      await webhookEvents.ruleTriggered(ruleId, ruleName);
    } catch (error) {
      logger.error('Failed to trigger rule webhook', error as Error);
    }
  }
}
