import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export const deviceIdParamSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const authLoginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(255),
  password: z.string().min(1, 'Password is required').max(255),
});

export const authRegisterSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  password: z.string().min(6, 'Password must be at least 6 characters').max(255),
  email: z.string().email('Invalid email address').optional(),
  agreeAgreements: z.boolean(),
}).refine((data) => data.agreeAgreements, {
  message: 'You must agree to the user agreement, privacy policy and terms of service',
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const deviceNameSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

export const deviceControlSchema = z.object({
  power: z.boolean().optional(),
  brightness: z.number().int().min(0).max(100).optional(),
  temperature: z.number().optional(),
  mode: z.string().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one control parameter must be provided' }
);

export const sceneCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  actions: z.array(
    z.object({
      deviceId: z.string().min(1),
      action: z.string().min(1),
      parameters: z.record(z.string(), z.any()).optional(),
    })
  ).min(1, 'At least one action is required'),
});

export const sceneUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  actions: z.array(
    z.object({
      deviceId: z.string().min(1),
      action: z.string().min(1),
      parameters: z.record(z.string(), z.any()).optional(),
    })
  ).min(1).optional(),
});

export const ruleCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  triggerType: z.enum(['device_state', 'time', 'manual']),
  triggerCondition: z.record(z.string(), z.any()),
  actions: z.array(
    z.object({
      deviceId: z.string().min(1),
      action: z.string().min(1),
      parameters: z.record(z.string(), z.any()).optional(),
    })
  ).min(1, 'At least one action is required'),
  enabled: z.boolean().optional(),
});

export const ruleUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  triggerType: z.enum(['device_state', 'time', 'manual']).optional(),
  triggerCondition: z.record(z.string(), z.any()).optional(),
  actions: z.array(
    z.object({
      deviceId: z.string().min(1),
      action: z.string().min(1),
      parameters: z.record(z.string(), z.any()).optional(),
    })
  ).min(1).optional(),
  enabled: z.boolean().optional(),
});

export const scheduleCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  cronExpression: z.string().min(5, 'Cron expression is required').max(100),
  action: z.string().min(1, 'Action is required'),
  enabled: z.boolean().optional(),
});

export const scheduleUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  cronExpression: z.string().min(5).max(100).optional(),
  action: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

export const roomCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  icon: z.string().max(50).optional(),
});

export const householdCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  address: z.string().max(255).optional(),
});

export const modbusWriteSchema = z.object({
  address: z.number().int().min(0, 'Address must be >= 0'),
  value: z.union([z.number(), z.array(z.number())]),
});

export const modbusRegisterConfigSchema = z.object({
  name: z.string().min(1),
  address: z.number().int().min(0),
  type: z.enum(['holding', 'input', 'coil', 'discrete']),
  unit: z.string().optional(),
  readOnly: z.boolean().optional(),
  scale: z.number().optional(),
});

export const modbusDeviceCreateSchema = z.object({
  name: z.string().min(1),
  ip: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IP address'),
  port: z.number().int().min(1).max(65535),
  slaveId: z.number().int().min(1).max(247).optional(),
  registers: z.array(modbusRegisterConfigSchema).min(1),
});
