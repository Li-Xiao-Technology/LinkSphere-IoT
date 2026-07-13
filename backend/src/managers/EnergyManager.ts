import { prisma } from '../prisma/client';
import { EnergyLog, EnergySummary } from '../types';
import { DeviceManager } from './DeviceManager';
import { logger } from '../utils/logger';
import { webhookEvents } from '../services/webhookService';

export class EnergyManager {
  private static instance: EnergyManager;
  private loggingInterval: NodeJS.Timeout | undefined;
  private deviceManager = DeviceManager.getInstance();

  private constructor() {}

  public static getInstance(): EnergyManager {
    if (!EnergyManager.instance) {
      EnergyManager.instance = new EnergyManager();
    }
    return EnergyManager.instance;
  }

  public startLogging(): void {
    if (this.loggingInterval) {
      return;
    }
    this.logAllDevicesPower();
    this.loggingInterval = setInterval(() => {
      this.logAllDevicesPower();
    }, 60 * 60 * 1000);
  }

  public stopLogging(): void {
    if (this.loggingInterval) {
      clearInterval(this.loggingInterval);
      this.loggingInterval = undefined;
    }
  }

  private extractPowerFromState(state: Record<string, unknown>): number | null {
    const powerKeys = [
      'activePower',
      'power',
      'powerW',
      'activePowerW',
      'totalActivePower',
      'loadPower',
      'instantaneousPower',
      'p',
      'w',
      ' watt',
    ];
    for (const key of powerKeys) {
      if (key in state && typeof state[key] === 'number') {
        const value = state[key] as number;
        if (value >= 0) return value;
      }
    }
    // Fallback: scan all numeric keys for power-related names
    for (const [key, value] of Object.entries(state)) {
      if (typeof value === 'number' && value >= 0) {
        const lower = key.toLowerCase();
        if (lower.includes('power') || lower.includes('watt') || lower.includes('p_')) {
          return value;
        }
      }
    }
    return null;
  }

  private async logAllDevicesPower(): Promise<void> {
    const devices = this.deviceManager.getAllDevices();
    for (const device of devices) {
      let power = 0;
      try {
        const state = await this.deviceManager.getDeviceState(device.id);
        if (state) {
          const statePower = this.extractPowerFromState(state as Record<string, unknown>);
          if (statePower !== null) {
            power = statePower;
          } else if (device.powerConsumption && device.powerConsumption > 0) {
            power = device.powerConsumption;
          }
        } else if (device.powerConsumption && device.powerConsumption > 0) {
          power = device.powerConsumption;
        }
      } catch {
        // 无法读取状态时回退到设备记录的功率
        if (device.powerConsumption && device.powerConsumption > 0) {
          power = device.powerConsumption;
        }
      }
      await this.logDevicePower(device.id, power);
    }
  }

  public async logDevicePower(deviceId: string, power: number): Promise<void> {
    const id = `energy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const recordedAt = new Date();

    await prisma.energyLog.create({
      data: {
        id,
        deviceId,
        power,
        recordedAt
      }
    });
  }

  public async getDeviceEnergy(deviceId: string, hours: number): Promise<EnergyLog[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const rows = await prisma.energyLog.findMany({
      where: {
        deviceId,
        recordedAt: {
          gte: since
        }
      },
      orderBy: {
        recordedAt: 'asc'
      }
    });

    return rows.map(row => ({
      id: row.id,
      deviceId: row.deviceId,
      power: row.power,
      recordedAt: row.recordedAt.toISOString()
    }));
  }

  public async getEnergySummary(): Promise<EnergySummary[]> {
    const summaries = await prisma.energyLog.groupBy({
      by: ['deviceId'],
      _sum: {
        power: true
      },
      _avg: {
        power: true
      },
      _max: {
        power: true
      }
    });

    const deviceIds = summaries.map(s => s.deviceId);
    const devices = await prisma.device.findMany({
      where: { id: { in: deviceIds } },
      select: { id: true, name: true }
    });
    const deviceNameMap = new Map(devices.map(d => [d.id, d.name]));

    const result: EnergySummary[] = summaries.map(summary => ({
      deviceId: summary.deviceId,
      deviceName: deviceNameMap.get(summary.deviceId) || summary.deviceId,
      totalEnergy: summary._sum.power || 0,
      avgPower: summary._avg.power || 0,
      maxPower: summary._max.power || 0
    }));

    return result;
  }

  public async getTotalEnergy(): Promise<{ totalEnergy: number; totalPower: number; avgPower: number; deviceCount: number }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalResult, todayResult, avgResult, devices] = await Promise.all([
      prisma.energyLog.aggregate({
        _sum: {
          power: true
        }
      }),
      prisma.energyLog.aggregate({
        _sum: {
          power: true
        },
        where: {
          recordedAt: {
            gte: todayStart
          }
        }
      }),
      prisma.energyLog.aggregate({
        _avg: {
          power: true
        }
      }),
      prisma.device.count()
    ]);

    return {
      totalEnergy: (totalResult._sum.power || 0) / 1000,
      totalPower: todayResult._sum.power || 0,
      avgPower: avgResult._avg.power || 0,
      deviceCount: devices
    };
  }

  public async exportCSV(start: Date, end: Date): Promise<{ csv: string; filename: string }> {
    const logs = await prisma.energyLog.findMany({
      where: {
        recordedAt: { gte: start, lte: end }
      },
      include: { device: true },
      orderBy: { recordedAt: 'asc' }
    });

    const headers = ['时间', '设备ID', '设备名称', '品牌', '类型', '功率(W)', '能耗(kWh)'];
    const rows = logs.map((log) => [
      log.recordedAt.toISOString(),
      log.deviceId,
      log.device?.name || '',
      log.device?.brand || '',
      log.device?.type || '',
      log.power.toFixed(2),
      (log.power / 1000).toFixed(4),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const dateStr = start.toISOString().slice(0, 10);
    const filename = `能耗报告_${dateStr}.csv`;

    return { csv, filename };
  }

  public async exportDeviceCSV(deviceId: string, start: Date, end: Date): Promise<{ csv: string; filename: string }> {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    const logs = await prisma.energyLog.findMany({
      where: {
        deviceId,
        recordedAt: { gte: start, lte: end }
      },
      orderBy: { recordedAt: 'asc' }
    });

    const headers = ['时间', '功率(W)', '能耗(kWh)'];
    const rows = logs.map((log) => [
      log.recordedAt.toISOString(),
      log.power.toFixed(2),
      (log.power / 1000).toFixed(4),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const dateStr = start.toISOString().slice(0, 10);
    const deviceName = device?.name || deviceId;
    const filename = `${deviceName}_能耗报告_${dateStr}.csv`;

    return { csv, filename };
  }

  // 获取趋势数据
  public async getTrendData(range: 'today' | 'week' | 'month'): Promise<{ time: string; power: number; energy: number }[]> {
    const now = new Date();
    let since: Date;
    let groupBy: 'hour' | 'day';

    switch (range) {
      case 'today':
        since = new Date(now);
        since.setHours(0, 0, 0, 0);
        groupBy = 'hour';
        break;
      case 'week':
        since = new Date(now);
        since.setDate(since.getDate() - 7);
        since.setHours(0, 0, 0, 0);
        groupBy = 'day';
        break;
      case 'month':
        since = new Date(now);
        since.setMonth(since.getMonth() - 1);
        since.setHours(0, 0, 0, 0);
        groupBy = 'day';
        break;
    }

    const logs = await prisma.energyLog.findMany({
      where: {
        recordedAt: { gte: since }
      },
      orderBy: { recordedAt: 'asc' }
    });

    const grouped: Map<string, { powerSum: number; count: number; energySum: number }> = new Map();

    for (const log of logs) {
      const date = new Date(log.recordedAt);
      let key: string;

      if (groupBy === 'hour') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }

      const existing = grouped.get(key) || { powerSum: 0, count: 0, energySum: 0 };
      existing.powerSum += log.power;
      existing.count += 1;
      existing.energySum += log.power / 1000;
      grouped.set(key, existing);
    }

    const result: { time: string; power: number; energy: number }[] = [];
    grouped.forEach((value, key) => {
      result.push({
        time: key,
        power: Math.round(value.powerSum / value.count),
        energy: Math.round(value.energySum * 100) / 100
      });
    });

    return result.sort((a, b) => a.time.localeCompare(b.time));
  }

  // 获取设备能耗占比
  public async getDeviceEnergyDistribution(range: 'today' | 'week' | 'month'): Promise<{ deviceId: string; deviceName: string; energy: number; percentage: number }[]> {
    const now = new Date();
    let since: Date;

    switch (range) {
      case 'today':
        since = new Date(now);
        since.setHours(0, 0, 0, 0);
        break;
      case 'week':
        since = new Date(now);
        since.setDate(since.getDate() - 7);
        break;
      case 'month':
        since = new Date(now);
        since.setMonth(since.getMonth() - 1);
        break;
    }

    const logs = await prisma.energyLog.findMany({
      where: {
        recordedAt: { gte: since }
      },
      include: { device: true }
    });

    const deviceEnergy: Map<string, { name: string; energy: number }> = new Map();
    let totalEnergy = 0;

    for (const log of logs) {
      const deviceName = log.device?.name || log.deviceId;
      const existing = deviceEnergy.get(log.deviceId) || { name: deviceName, energy: 0 };
      existing.energy += log.power / 1000;
      deviceEnergy.set(log.deviceId, existing);
      totalEnergy += log.power / 1000;
    }

    const result: { deviceId: string; deviceName: string; energy: number; percentage: number }[] = [];
    deviceEnergy.forEach((value, deviceId) => {
      result.push({
        deviceId,
        deviceName: value.name,
        energy: Math.round(value.energy * 100) / 100,
        percentage: totalEnergy > 0 ? Math.round((value.energy / totalEnergy) * 10000) / 100 : 0
      });
    });

    return result.sort((a, b) => b.energy - a.energy);
  }

  // 获取每日/每周/每月能耗柱状图数据
  public async getBarChartData(type: 'daily' | 'weekly' | 'monthly'): Promise<{ label: string; energy: number; date: string }[]> {
    const now = new Date();
    const result: { label: string; energy: number; date: string }[] = [];

    switch (type) {
      case 'daily': {
        // 过去7天
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          const logs = await prisma.energyLog.findMany({
            where: {
              recordedAt: { gte: date, lt: nextDate }
            }
          });

          const energy = logs.reduce((sum, log) => sum + log.power / 1000, 0);
          result.push({
            label: `${date.getMonth() + 1}/${date.getDate()}`,
            energy: Math.round(energy * 100) / 100,
            date: date.toISOString().slice(0, 10)
          });
        }
        break;
      }
      case 'weekly': {
        // 过去4周
        for (let i = 3; i >= 0; i--) {
          const endDate = new Date(now);
          endDate.setDate(endDate.getDate() - (i * 7));
          endDate.setHours(23, 59, 59, 999);
          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);

          const logs = await prisma.energyLog.findMany({
            where: {
              recordedAt: { gte: startDate, lte: endDate }
            }
          });

          const energy = logs.reduce((sum, log) => sum + log.power / 1000, 0);
          result.push({
            label: `第${4 - i}周`,
            energy: Math.round(energy * 100) / 100,
            date: startDate.toISOString().slice(0, 10)
          });
        }
        break;
      }
      case 'monthly': {
        // 过去6个月
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

          const logs = await prisma.energyLog.findMany({
            where: {
              recordedAt: { gte: date, lt: nextMonth }
            }
          });

          const energy = logs.reduce((sum, log) => sum + log.power / 1000, 0);
          result.push({
            label: `${date.getMonth() + 1}月`,
            energy: Math.round(energy * 100) / 100,
            date: date.toISOString().slice(0, 7)
          });
        }
        break;
      }
    }

    return result;
  }

  // 获取能耗对比数据（环比、同比）
  public async getComparisonData(): Promise<{
    current: { energy: number; period: string };
    lastPeriod: { energy: number; period: string };
    lastYear: { energy: number; period: string };
    periodChange: number;
    yearChange: number;
  }> {
    const now = new Date();
    
    // 当前月份
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthLogs = await prisma.energyLog.findMany({
      where: { recordedAt: { gte: currentMonthStart } }
    });
    const currentEnergy = currentMonthLogs.reduce((sum, log) => sum + log.power / 1000, 0);

    // 上个月
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthLogs = await prisma.energyLog.findMany({
      where: { recordedAt: { gte: lastMonthStart, lte: lastMonthEnd } }
    });
    const lastMonthEnergy = lastMonthLogs.reduce((sum, log) => sum + log.power / 1000, 0);

    // 去年同期
    const lastYearStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0);
    const lastYearLogs = await prisma.energyLog.findMany({
      where: { recordedAt: { gte: lastYearStart, lte: lastYearEnd } }
    });
    const lastYearEnergy = lastYearLogs.reduce((sum, log) => sum + log.power / 1000, 0);

    const periodChange = lastMonthEnergy > 0 ? ((currentEnergy - lastMonthEnergy) / lastMonthEnergy) * 100 : 0;
    const yearChange = lastYearEnergy > 0 ? ((currentEnergy - lastYearEnergy) / lastYearEnergy) * 100 : 0;

    return {
      current: {
        energy: Math.round(currentEnergy * 100) / 100,
        period: `${now.getFullYear()}年${now.getMonth() + 1}月`
      },
      lastPeriod: {
        energy: Math.round(lastMonthEnergy * 100) / 100,
        period: `${now.getFullYear()}年${now.getMonth()}月`
      },
      lastYear: {
        energy: Math.round(lastYearEnergy * 100) / 100,
        period: `${now.getFullYear() - 1}年${now.getMonth() + 1}月`
      },
      periodChange: Math.round(periodChange * 100) / 100,
      yearChange: Math.round(yearChange * 100) / 100
    };
  }

  // 检测能耗异常
  public async getAnomalies(): Promise<{
    deviceId: string;
    deviceName: string;
    type: 'high' | 'low' | 'spike';
    message: string;
    value: number;
    threshold: number;
    timestamp: string;
  }[]> {
    const anomalies: {
      deviceId: string;
      deviceName: string;
      type: 'high' | 'low' | 'spike';
      message: string;
      value: number;
      threshold: number;
      timestamp: string;
    }[] = [];

    const summaries = await this.getEnergySummary();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    for (const summary of summaries) {
      const recentLogs = await prisma.energyLog.findMany({
        where: {
          deviceId: summary.deviceId,
          recordedAt: { gte: oneHourAgo }
        },
        orderBy: { recordedAt: 'desc' },
        take: 10
      });

      if (recentLogs.length === 0) continue;

      const avgRecent = recentLogs.reduce((sum, log) => sum + log.power, 0) / recentLogs.length;
      const maxThreshold = summary.avgPower * 2;
      const minThreshold = summary.avgPower * 0.1;

      // 高功耗异常
      if (avgRecent > maxThreshold && avgRecent > 100) {
        anomalies.push({
          deviceId: summary.deviceId,
          deviceName: summary.deviceName,
          type: 'high',
          message: `设备功耗异常偏高，当前平均 ${avgRecent.toFixed(1)}W，超过正常值 ${Math.round((avgRecent / summary.avgPower - 1) * 100)}%`,
          value: Math.round(avgRecent),
          threshold: Math.round(maxThreshold),
          timestamp: now.toISOString()
        });
      }

      // 功耗突增检测
      if (recentLogs.length >= 2) {
        const latest = recentLogs[0].power;
        const previous = recentLogs[1].power;
        if (latest > previous * 3 && latest > 100) {
          anomalies.push({
            deviceId: summary.deviceId,
            deviceName: summary.deviceName,
            type: 'spike',
            message: `设备功耗突增，从 ${previous.toFixed(1)}W 飙升至 ${latest.toFixed(1)}W`,
            value: Math.round(latest),
            threshold: Math.round(previous * 3),
            timestamp: recentLogs[0].recordedAt.toISOString()
          });
        }
      }
    }

    // 触发能耗异常 webhook
    for (const anomaly of anomalies) {
      webhookEvents.energyAnomaly(anomaly.deviceId, anomaly.deviceName, anomaly.type, anomaly.value, anomaly.threshold)
        .catch((e) => logger.error('webhook energyAnomaly failed', e as Error));
    }

    return anomalies;
  }
}
