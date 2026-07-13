export interface Device {
  id: string;
  name: string;
  brand: string;
  type: string;
  model?: string;
  sn?: string;
  status: 'online' | 'offline' | 'standby';
  connectionType: 'wifi' | 'bluetooth' | 'ethernet';
  networkName?: string;
  networkStrength?: number;
  ipAddress?: string;
  macAddress?: string;
  lastSyncTime?: string;
  firmwareVersion?: string;
  config?: string;
  roomId?: string;
  powerConsumption?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceState {
  deviceId: string;
  power?: boolean;
  brightness?: number;
  temperature?: number;
  humidity?: number;
  color?: string;
  mode?: string;
  value?: number;
  ct?: number;
  rgb?: number;
  colorTemp?: number;
  delayOff?: number;
  [key: string]: unknown;
}

export interface Scene {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  actions: SceneAction[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SceneAction {
  deviceId: string;
  action: string;
  parameters?: Record<string, unknown>;
}

export interface SceneTemplate {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  category: string;
  actions: SceneAction[];
  isPreset: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Schedule {
  id: string;
  name: string;
  cronExpression: string;
  action: string;
  enabled: boolean;
  deviceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type DeviceType = 'light' | 'switch' | 'sensor' | 'airconditioner' | 'waterheater' | 'airpurifier' | 'refrigerator' | 'plc';

export type ConnectionType = 'wifi' | 'bluetooth' | 'ethernet';

export type Brand = 'mijia' | 'haier' | 'midea';

export interface Room {
  id: string;
  name: string;
  icon: string;
  sortIndex: number;
  createdAt?: string;
}

export type NotificationType = 'device_offline' | 'device_online' | 'warning' | 'info' | 'rule_triggered' | 'firmware_update' | 'schedule_executed';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  deviceId?: string;
  read: boolean;
  createdAt?: string;
}

export interface EnergyLog {
  id: string;
  deviceId: string;
  power: number;
  recordedAt: string;
}

export interface EnergySummary {
  deviceId: string;
  deviceName: string;
  totalEnergy: number;
  avgPower: number;
  maxPower: number;
}

export type TriggerType = 'device_state' | 'time' | 'manual';
export type LogicOperator = 'AND' | 'OR';

// 单个设备条件（用于简单条件和组合条件中的子条件）
export interface DeviceCondition {
  deviceId: string;
  property: string;
  operator: '>' | '<' | '==' | '>=' | '<=' | '!=' | 'changes';
  value: unknown;
}

export interface RuleCondition {
  // 单设备条件（向后兼容）
  deviceId?: string;
  property?: string;
  operator?: '>' | '<' | '==' | '>=' | '<=' | '!=' | 'changes';
  value?: unknown;
  cronExpression?: string;

  // 多设备联动条件
  conditions?: DeviceCondition[];
  logic?: LogicOperator;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: TriggerType;
  triggerCondition: RuleCondition;
  actions: SceneAction[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Household {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: string;
}

export interface HouseholdMember {
  userId: string;
  householdId: string;
  role: 'admin' | 'member' | 'viewer';
  username?: string;
}

export type DeviceSharePermission = 'read' | 'control';

export interface DeviceShare {
  id: string;
  deviceId: string;
  ownerId: string;
  sharedWithId: string;
  permission: DeviceSharePermission;
  createdAt?: string;
  device?: Device;
  sharedWith?: User;
}

export interface ModbusRegisterMapping {
  property: string;
  type: 'coil' | 'discrete' | 'holding' | 'input';
  address: number;
  quantity: number;
  dataType: 'bool' | 'int16' | 'uint16' | 'float32' | 'string';
  writable: boolean;
  scale?: number;
  unit?: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'admin' | 'member' | 'viewer';
  householdId?: string;
  createdAt?: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
}

// 预测分析类型
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
    timePattern: { hour: number; changeProbability: number }[];
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

export interface PredictionReport {
  usagePredictions: UsageFrequencyPrediction[];
  energyPredictions: EnergyTrendPrediction[];
  statePatterns: StateChangePattern[];
  anomalyWarnings: AnomalyWarning[];
  generatedAt: string;
}
