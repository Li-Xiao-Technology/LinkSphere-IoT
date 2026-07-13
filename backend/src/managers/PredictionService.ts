import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

export interface UsageFrequencyPrediction {
  deviceId: string;
  deviceName: string;
  currentFrequency: number;
  predictedFrequency: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  hourlyPattern: { hour: number; probability: number }[];
}

export interface EnergyTrendPrediction {
  deviceId: string;
  deviceName: string;
  currentAvgPower: number;
  predictedAvgPower: number;
  predictedDailyEnergy: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  hourlyForecast: { hour: number; predictedPower: number }[];
}

export interface StateChangePattern {
  deviceId: string;
  deviceName: string;
  patterns: {
    timePattern: { hour: number; probability: number }[];
    frequentTransitions: { from: string; to: string; count: number; probability: number }[];
  };
  stabilityScore: number;
}

export interface AnomalyWarning {
  deviceId: string;
  deviceName: string;
  type: 'high_energy' | 'unstable_state' | 'abnormal_usage' | 'potential_failure';
  severity: 'low' | 'medium' | 'high';
  message: string;
  details: Record<string, unknown>;
  predictedAt: string;
}

export class PredictionService {
  private static instance: PredictionService;

  private constructor() {}

  public static getInstance(): PredictionService {
    if (!PredictionService.instance) {
      PredictionService.instance = new PredictionService();
    }
    return PredictionService.instance;
  }

  // 设备使用频率预测
  public async predictUsageFrequency(days: number = 7): Promise<UsageFrequencyPrediction[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stateHistories = await prisma.deviceStateHistory.findMany({
      where: {
        changedAt: { gte: startDate }
      },
      orderBy: { changedAt: 'asc' }
    });

    const devices = await prisma.device.findMany();
    const predictions: UsageFrequencyPrediction[] = [];

    for (const device of devices) {
      const deviceHistory = stateHistories.filter(h => h.deviceId === device.id);
      
      if (deviceHistory.length < 5) {
        continue;
      }

      // 计算当前频率（每小时的平均状态变化次数）
      const totalHours = days * 24;
      const currentFrequency = deviceHistory.length / totalHours;

      // 基于移动平均的趋势预测
      const dailyCounts = this.groupByDay(deviceHistory, days);
      const recentTrend = this.calculateLinearTrend(dailyCounts);
      
      // 预测未来频率
      const predictedFrequency = currentFrequency * (1 + recentTrend * 0.1);
      
      // 判断趋势方向
      let trend: 'increasing' | 'decreasing' | 'stable';
      if (Math.abs(recentTrend) > 0.05) {
        trend = recentTrend > 0 ? 'increasing' : 'decreasing';
      } else {
        trend = 'stable';
      }

      // 计算置信度（基于数据量和趋势稳定性）
      const confidence = Math.min(0.95, 0.6 + (deviceHistory.length / 100) * 0.3);

      // 小时使用模式
      const hourlyPattern = this.calculateHourlyPattern(deviceHistory);

      predictions.push({
        deviceId: device.id,
        deviceName: device.name,
        currentFrequency: Math.round(currentFrequency * 100) / 100,
        predictedFrequency: Math.round(predictedFrequency * 100) / 100,
        trend,
        confidence: Math.round(confidence * 100) / 100,
        hourlyPattern
      });
    }

    logger.debug('Usage frequency predictions generated', { count: predictions.length });
    return predictions;
  }

  // 能耗趋势预测
  public async predictEnergyTrend(days: number = 7): Promise<EnergyTrendPrediction[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const energyLogs = await prisma.energyLog.findMany({
      where: {
        recordedAt: { gte: startDate }
      },
      orderBy: { recordedAt: 'asc' }
    });

    const devices = await prisma.device.findMany();
    const predictions: EnergyTrendPrediction[] = [];

    for (const device of devices) {
      const deviceLogs = energyLogs.filter(l => l.deviceId === device.id);
      
      if (deviceLogs.length < 10) {
        continue;
      }

      // 计算当前平均功率
      const currentAvgPower = deviceLogs.reduce((sum, l) => sum + l.power, 0) / deviceLogs.length;

      // 按小时分组，分析趋势
      const hourlyAvg = this.groupByHour(deviceLogs);
      const trendCoeff = this.calculatePowerTrend(hourlyAvg);

      // 预测平均功率
      const predictedAvgPower = currentAvgPower * (1 + trendCoeff * 0.05);

      // 预测日能耗
      const predictedDailyEnergy = predictedAvgPower * 24 / 1000;

      // 判断趋势方向
      let trend: 'increasing' | 'decreasing' | 'stable';
      if (Math.abs(trendCoeff) > 0.03) {
        trend = trendCoeff > 0 ? 'increasing' : 'decreasing';
      } else {
        trend = 'stable';
      }

      // 计算置信度
      const confidence = Math.min(0.9, 0.5 + (deviceLogs.length / 200) * 0.4);

      // 24小时功率预测
      const hourlyForecast = this.predictHourlyPower(hourlyAvg, predictedAvgPower);

      predictions.push({
        deviceId: device.id,
        deviceName: device.name,
        currentAvgPower: Math.round(currentAvgPower),
        predictedAvgPower: Math.round(predictedAvgPower),
        predictedDailyEnergy: Math.round(predictedDailyEnergy * 100) / 100,
        trend,
        confidence: Math.round(confidence * 100) / 100,
        hourlyForecast
      });
    }

    logger.debug('Energy trend predictions generated', { count: predictions.length });
    return predictions;
  }

  // 设备状态变化规律分析
  public async analyzeStatePatterns(days: number = 14): Promise<StateChangePattern[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stateHistories = await prisma.deviceStateHistory.findMany({
      where: {
        changedAt: { gte: startDate }
      },
      orderBy: { changedAt: 'asc' }
    });

    const devices = await prisma.device.findMany();
    const patterns: StateChangePattern[] = [];

    for (const device of devices) {
      const deviceHistory = stateHistories.filter(h => h.deviceId === device.id);
      
      if (deviceHistory.length < 3) {
        continue;
      }

      // 时间模式分析
      const timePattern = this.calculateHourlyPattern(deviceHistory);

      // 状态转换分析
      const transitions = this.analyzeTransitions(deviceHistory);

      // 稳定性评分（状态变化越少越稳定）
      const avgChangesPerDay = deviceHistory.length / days;
      const stabilityScore = Math.max(0, Math.min(1, 1 - avgChangesPerDay / 10));

      patterns.push({
        deviceId: device.id,
        deviceName: device.name,
        patterns: {
          timePattern,
          frequentTransitions: transitions.slice(0, 5)
        },
        stabilityScore: Math.round(stabilityScore * 100) / 100
      });
    }

    logger.debug('State patterns analyzed', { count: patterns.length });
    return patterns;
  }

  // 异常状态预警
  public async detectAnomalies(): Promise<AnomalyWarning[]> {
    const warnings: AnomalyWarning[] = [];

    // 获取近期数据
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 3);

    const [energyLogs, stateHistories, devices] = await Promise.all([
      prisma.energyLog.findMany({
        where: { recordedAt: { gte: startDate } },
        orderBy: { recordedAt: 'asc' }
      }),
      prisma.deviceStateHistory.findMany({
        where: { changedAt: { gte: startDate } },
        orderBy: { changedAt: 'asc' }
      }),
      prisma.device.findMany()
    ]);

    for (const device of devices) {
      const deviceLogs = energyLogs.filter(l => l.deviceId === device.id);
      const deviceStates = stateHistories.filter(h => h.deviceId === device.id);

      // 高能耗预警
      if (deviceLogs.length >= 10) {
        const avgPower = deviceLogs.reduce((sum, l) => sum + l.power, 0) / deviceLogs.length;
        const maxPower = Math.max(...deviceLogs.map(l => l.power));
        const threshold = avgPower * 2;
        
        if (maxPower > threshold && maxPower > 100) {
          warnings.push({
            deviceId: device.id,
            deviceName: device.name,
            type: 'high_energy',
            severity: maxPower > avgPower * 3 ? 'high' : 'medium',
            message: `${device.name} 功率异常偏高，峰值 ${Math.round(maxPower)}W 超过平均值 ${Math.round(avgPower)}W`,
            details: { avgPower, maxPower, threshold },
            predictedAt: new Date().toISOString()
          });
        }
      }

      // 状态不稳定预警
      if (deviceStates.length >= 5) {
        const changesPerHour = deviceStates.length / 72; // 3天 = 72小时
        if (changesPerHour > 2) {
          warnings.push({
            deviceId: device.id,
            deviceName: device.name,
            type: 'unstable_state',
            severity: changesPerHour > 5 ? 'high' : 'medium',
            message: `${device.name} 状态频繁变化，平均每小时 ${Math.round(changesPerHour * 10) / 10} 次`,
            details: { changesPerHour, totalChanges: deviceStates.length },
            predictedAt: new Date().toISOString()
          });
        }
      }

      // 异常使用模式预警
      const nightUsage = deviceStates.filter(h => {
        const hour = h.changedAt.getHours();
        return hour >= 0 && hour < 6;
      });
      
      if (nightUsage.length > deviceStates.length * 0.3 && deviceStates.length >= 10) {
        warnings.push({
          deviceId: device.id,
          deviceName: device.name,
          type: 'abnormal_usage',
          severity: 'low',
          message: `${device.name} 在深夜时段频繁活动，可能存在异常`,
          details: { nightUsageCount: nightUsage.length, totalUsage: deviceStates.length },
          predictedAt: new Date().toISOString()
        });
      }

      // 潜在故障预警（基于状态波动）
      if (deviceStates.length >= 20) {
        const recentStates = deviceStates.slice(-10);
        const previousStates = deviceStates.slice(-20, -10);
        const recentVariability = this.calculateVariability(recentStates);
        const previousVariability = this.calculateVariability(previousStates);
        
        if (recentVariability > previousVariability * 1.5) {
          warnings.push({
            deviceId: device.id,
            deviceName: device.name,
            type: 'potential_failure',
            severity: 'medium',
            message: `${device.name} 近期状态波动增大，可能存在潜在问题`,
            details: { recentVariability, previousVariability },
            predictedAt: new Date().toISOString()
          });
        }
      }
    }

    logger.info('Anomaly detection completed', { warningCount: warnings.length });
    return warnings;
  }

  // 辅助方法：按天分组
  private groupByDay(histories: { changedAt: Date }[], days: number): number[] {
    const counts: number[] = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const count = histories.filter(h => 
        h.changedAt >= dayStart && h.changedAt < dayEnd
      ).length;
      
      counts.unshift(count);
    }
    
    return counts;
  }

  // 辅助方法：按小时分组计算平均功率
  private groupByHour(logs: { recordedAt: Date; power: number }[]): Map<number, number[]> {
    const hourlyData = new Map<number, number[]>();
    
    for (const log of logs) {
      const hour = log.recordedAt.getHours();
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(log.power);
    }
    
    return hourlyData;
  }

  // 辅助方法：计算线性趋势系数
  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n - 1) * n / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n - 1) * n * (2 * n - 1) / 6;
    
    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;
    
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const meanY = sumY / n;
    
    return slope / meanY; // 相对趋势系数
  }

  // 辅助方法：计算功率趋势
  private calculatePowerTrend(hourlyData: Map<number, number[]>): number {
    const hourlyAvg: { hour: number; avg: number }[] = [];
    
    for (const [hour, powers] of hourlyData) {
      const avg = powers.reduce((a, b) => a + b, 0) / powers.length;
      hourlyAvg.push({ hour, avg });
    }
    
    if (hourlyAvg.length < 6) return 0;
    
    // 使用时间作为自变量
    hourlyAvg.sort((a, b) => a.hour - b.hour);
    const values = hourlyAvg.map(h => h.avg);
    
    return this.calculateLinearTrend(values);
  }

  // 辅助方法：计算小时使用模式
  private calculateHourlyPattern(histories: { changedAt: Date }[]): { hour: number; probability: number }[] {
    const hourlyCounts = new Map<number, number>();
    
    for (const h of histories) {
      const hour = h.changedAt.getHours();
      hourlyCounts.set(hour, (hourlyCounts.get(hour) || 0) + 1);
    }
    
    const total = histories.length;
    const pattern: { hour: number; probability: number }[] = [];
    
    for (let hour = 0; hour < 24; hour++) {
      const count = hourlyCounts.get(hour) || 0;
      pattern.push({
        hour,
        probability: Math.round(count / total * 100) / 100
      });
    }
    
    return pattern;
  }

  // 辅助方法：预测每小时功率
  private predictHourlyPower(hourlyData: Map<number, number[]>, basePower: number): { hour: number; predictedPower: number }[] {
    const forecast: { hour: number; predictedPower: number }[] = [];
    
    for (let hour = 0; hour < 24; hour++) {
      const powers = hourlyData.get(hour);
      if (powers && powers.length > 0) {
        const avg = powers.reduce((a, b) => a + b, 0) / powers.length;
        forecast.push({ hour, predictedPower: Math.round(avg) });
      } else {
        // 使用基准功率和时间因子
        const timeFactor = this.getTimeFactor(hour);
        forecast.push({ hour, predictedPower: Math.round(basePower * timeFactor) });
      }
    }
    
    return forecast;
  }

  // 辅助方法：获取时间因子（模拟典型用电模式）
  private getTimeFactor(hour: number): number {
    // 早高峰 6-9
    if (hour >= 6 && hour < 9) return 1.2;
    // 晚高峰 18-22
    if (hour >= 18 && hour < 22) return 1.4;
    // 深夜 0-5
    if (hour >= 0 && hour < 5) return 0.5;
    // 其他时段
    return 1.0;
  }

  // 辅助方法：分析状态转换
  private analyzeTransitions(histories: { status: string; state: string | null }[]): { from: string; to: string; count: number; probability: number }[] {
    const transitions = new Map<string, number>();
    
    for (let i = 1; i < histories.length; i++) {
      const prev = histories[i - 1].status;
      const curr = histories[i].status;
      const key = `${prev}->${curr}`;
      transitions.set(key, (transitions.get(key) || 0) + 1);
    }
    
    const totalTransitions = histories.length - 1;
    const result: { from: string; to: string; count: number; probability: number }[] = [];
    
    for (const [key, count] of transitions) {
      const [from, to] = key.split('->');
      result.push({
        from,
        to,
        count,
        probability: Math.round(count / totalTransitions * 100) / 100
      });
    }
    
    return result.sort((a, b) => b.count - a.count);
  }

  // 辅助方法：计算状态变化变异性
  private calculateVariability(histories: { status: string; state: string | null }[]): number {
    if (histories.length < 2) return 0;
    
    let changes = 0;
    for (let i = 1; i < histories.length; i++) {
      if (histories[i].status !== histories[i - 1].status) {
        changes++;
      }
    }
    
    return changes / histories.length;
  }
}