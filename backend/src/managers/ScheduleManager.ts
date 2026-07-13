import { Schedule } from '../types';
import { CronJob } from 'cron';
import { DeviceManager } from './DeviceManager';
import { logger } from '../utils/logger';
import { webhookEvents } from '../services/webhookService';

export class ScheduleManager {
  private static instance: ScheduleManager;
  private schedules: Map<string, { schedule: Schedule; job: CronJob }> = new Map();
  private deviceManager = DeviceManager.getInstance();

  private constructor() {}

  public static getInstance(): ScheduleManager {
    if (!ScheduleManager.instance) {
      ScheduleManager.instance = new ScheduleManager();
    }
    return ScheduleManager.instance;
  }

  public addSchedule(schedule: Schedule): void {
    if (this.schedules.has(schedule.id)) {
      this.removeSchedule(schedule.id);
    }

    const job = new CronJob(schedule.cronExpression, async () => {
      const item = this.schedules.get(schedule.id);
      if (item) {
        await this.executeSchedule(item.schedule);
      }
    });

    if (schedule.enabled) {
      job.start();
    }

    this.schedules.set(schedule.id, { schedule, job });
  }

  public removeSchedule(id: string): void {
    const item = this.schedules.get(id);
    if (item) {
      item.job.stop();
      this.schedules.delete(id);
    }
  }

  public updateSchedule(schedule: Schedule): void {
    this.addSchedule(schedule);
  }

  public enableSchedule(id: string): void {
    const item = this.schedules.get(id);
    if (item) {
      item.schedule.enabled = true;
      item.job.start();
    }
  }

  public disableSchedule(id: string): void {
    const item = this.schedules.get(id);
    if (item) {
      item.schedule.enabled = false;
      item.job.stop();
    }
  }

  public getAllSchedules(): Schedule[] {
    return Array.from(this.schedules.values()).map((item) => item.schedule);
  }

  private async executeSchedule(schedule: Schedule): Promise<void> {
    if (!schedule.scheduleActions || schedule.scheduleActions.length === 0) {
      return;
    }

    for (const action of schedule.scheduleActions) {
      try {
        const params = action.params ? JSON.parse(action.params) : {};
        await this.deviceManager.setDeviceState(action.deviceId, params);
      } catch (error) {
        logger.error('Failed to execute scheduled action:', error as Error);
      }
    }

    webhookEvents.scheduleExecuted(schedule.id, schedule.name).catch((e) => logger.error('webhook scheduleExecuted failed', e as Error));
  }
}
