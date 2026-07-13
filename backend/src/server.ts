import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { setupDatabase } from './database';
import { prisma } from './prisma/client';
import { DeviceState } from './types';
import { deviceRoutes } from './routes/device';
import { sceneRoutes } from './routes/scene';
import { scheduleRoutes } from './routes/schedule';
import { authRoutes } from './routes/auth';
import { roomRoutes } from './routes/room';
import { notificationRoutes } from './routes/notification';
import { ruleRoutes } from './routes/rule';
import { energyRoutes } from './routes/energy';
import { householdRoutes } from './routes/household';
import { userRoutes } from './routes/user';
import { searchRoutes } from './routes/search';
import { predictionRoutes } from './routes/prediction';
import { permissionRoutes } from './routes/permission';
import { deviceShareRoutes } from './routes/deviceShare';
import { chatRoutes } from './routes/chat';
import modbusRoutes from './routes/modbus';
import plcHistoryRoutes from './routes/plcHistory';
import mqttRoutes from './routes/mqtt';
import yeelightRoutes from './routes/yeelight';
import yeelightBleRoutes from './routes/yeelightBle';
import healthRoutes from './routes/health';
import auditLogRoutes from './routes/auditLog';
import deviceTagRoutes from './routes/deviceTag';
import webhookRoutes from './routes/webhook';
import thresholdRoutes from './routes/threshold';
import exportRoutes from './routes/export';
import systemRoutes from './routes/system';
import configRoutes from './routes/config';
import analyticsRoutes from './routes/analytics';
import firmwareRoutes from './routes/firmware';
import pluginRoutes from './routes/plugins';
import avatarRoutes from './routes/avatar';
import deviceGroupRoutes from './routes/deviceGroup';
import dashboardRoutes from './routes/dashboard';
import notificationChannelRoutes from './routes/notificationChannel';
import batchRoutes from './routes/batch';
import firmwareCenterRoutes from './routes/firmwareCenter';
import sceneRecommendationRoutes from './routes/sceneRecommendation';
import organizationRoutes from './routes/organization';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { requestLoggerMiddleware } from './middleware/requestLogger';
import { errorHandlerMiddleware, notFoundMiddleware } from './middleware/errorHandler';
import { setupSocket } from './socket';
import { DeviceManager } from './managers/DeviceManager';
import { NotificationManager } from './managers/NotificationManager';
import { RuleEngine } from './managers/RuleEngine';
import { EnergyManager } from './managers/EnergyManager';
import { logger } from './utils/logger';
import { migrateStructuredActions } from './migrations/structuredActionsMigration';

dotenv.config();

// 启动时检查关键环境变量
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is not set! Server cannot start securely.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  logger.warn('JWT_SECRET is too short (recommended: 32+ characters). Consider using a longer secret.');
}

// 支持通过 FRONTEND_URL 配置多个前端来源（逗号分隔），便于多环境部署
const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = rawFrontendUrl
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOrigin: string | string[] = allowedOrigins.length > 1 ? allowedOrigins : allowedOrigins[0];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...(Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin])],
    },
  },
}));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(requestLoggerMiddleware);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use('/api/auth', rateLimitMiddleware, authRoutes);
app.use('/api/devices', rateLimitMiddleware, authMiddleware, deviceRoutes);
app.use('/api/scenes', rateLimitMiddleware, authMiddleware, sceneRoutes);
app.use('/api/schedules', rateLimitMiddleware, authMiddleware, scheduleRoutes);
app.use('/api/rooms', rateLimitMiddleware, authMiddleware, roomRoutes);
app.use('/api/notifications', rateLimitMiddleware, authMiddleware, notificationRoutes);
app.use('/api/rules', rateLimitMiddleware, authMiddleware, ruleRoutes);
app.use('/api/energy', rateLimitMiddleware, authMiddleware, energyRoutes);
app.use('/api/household', rateLimitMiddleware, authMiddleware, householdRoutes);
app.use('/api/user', rateLimitMiddleware, authMiddleware, userRoutes);
app.use('/api/search', rateLimitMiddleware, authMiddleware, searchRoutes);
app.use('/api/predictions', rateLimitMiddleware, authMiddleware, predictionRoutes);
app.use('/api/permissions', rateLimitMiddleware, authMiddleware, permissionRoutes);
app.use('/api/device-shares', rateLimitMiddleware, authMiddleware, deviceShareRoutes);
app.use('/api/chat', rateLimitMiddleware, authMiddleware, chatRoutes);
app.use('/api/modbus', rateLimitMiddleware, authMiddleware, modbusRoutes);
app.use('/api/plc', rateLimitMiddleware, authMiddleware, plcHistoryRoutes);
app.use('/api/mqtt', rateLimitMiddleware, authMiddleware, mqttRoutes);
app.use('/api/yeelight', rateLimitMiddleware, authMiddleware, yeelightRoutes);
app.use('/api/yeelight-ble', rateLimitMiddleware, authMiddleware, yeelightBleRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/audit-logs', rateLimitMiddleware, authMiddleware, auditLogRoutes);
app.use('/api/device-tags', rateLimitMiddleware, authMiddleware, deviceTagRoutes);
app.use('/api/webhooks', rateLimitMiddleware, authMiddleware, webhookRoutes);
app.use('/api/thresholds', rateLimitMiddleware, authMiddleware, thresholdRoutes);
app.use('/api/export', rateLimitMiddleware, authMiddleware, exportRoutes);
app.use('/api/system', rateLimitMiddleware, authMiddleware, systemRoutes);
app.use('/api/config', rateLimitMiddleware, authMiddleware, configRoutes);
app.use('/api/analytics', rateLimitMiddleware, authMiddleware, analyticsRoutes);
app.use('/api/firmware', rateLimitMiddleware, authMiddleware, firmwareRoutes);
app.use('/api/plugins', rateLimitMiddleware, authMiddleware, pluginRoutes);
app.use('/api/avatar', rateLimitMiddleware, authMiddleware, avatarRoutes);
app.use('/api/device-groups', rateLimitMiddleware, authMiddleware, deviceGroupRoutes);
app.use('/api/dashboards', rateLimitMiddleware, authMiddleware, dashboardRoutes);
app.use('/api/notification-channels', rateLimitMiddleware, authMiddleware, notificationChannelRoutes);
app.use('/api/batch', rateLimitMiddleware, authMiddleware, batchRoutes);
app.use('/api/firmware-center', rateLimitMiddleware, authMiddleware, firmwareCenterRoutes);
app.use('/api/scene-recommendations', rateLimitMiddleware, authMiddleware, sceneRecommendationRoutes);
app.use('/api/organizations', rateLimitMiddleware, authMiddleware, organizationRoutes);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

async function startServer() {
  setupDatabase();
  setupSocket(io);

  const deviceManager = DeviceManager.getInstance();
  deviceManager.startDiscovery();

  const notificationManager = NotificationManager.getInstance();
  const ruleEngine = RuleEngine.getInstance();
  const energyManager = EnergyManager.getInstance();

  try {
    await migrateStructuredActions();
  } catch (error) {
    logger.error('Failed to run structured actions migration', error as Error);
  }

  try {
    const rules = await prisma.rule.findMany({
      include: {
        ruleConditions: { orderBy: { sortOrder: 'asc' } },
        ruleActions: { orderBy: { sortOrder: 'asc' } }
      }
    });
    rules.forEach((rule) => {
      try {
        let triggerCondition: Record<string, unknown>;
        if (rule.triggerType === 'time') {
          triggerCondition = { cronExpression: rule.cronExpression };
        } else if (rule.triggerType === 'device_state') {
          triggerCondition = {
            conditions: rule.ruleConditions.map((c) => ({
              deviceId: c.deviceId,
              property: c.property,
              operator: c.operator,
              value: c.value ? (() => { try { return JSON.parse(c.value); } catch { return c.value; } })() : undefined,
            })),
            logic: rule.ruleConditions[0]?.logic || 'AND',
          };
        } else {
          triggerCondition = {};
        }

        ruleEngine.addRule({
          id: rule.id,
          name: rule.name,
          enabled: rule.enabled,
          triggerType: rule.triggerType as 'device_state' | 'time' | 'manual',
          triggerCondition,
          actions: rule.ruleActions.map((a) => ({
            deviceId: a.deviceId,
            action: a.action,
            parameters: a.params ? JSON.parse(a.params) : {},
          })),
        });
      } catch {
        // skip invalid rules
      }
    });
    logger.info(`Loaded ${rules.length} rules from database`, { count: rules.length });
  } catch (error) {
    logger.error('Failed to load rules', error as Error);
  }

  notificationManager.on('notification', (notification: unknown) => {
    io.emit('notification', notification);
  });

  deviceManager.on('deviceStateChanged', (data: { deviceId: string; state: unknown }) => {
    ruleEngine.checkDeviceStateChange(data.deviceId, data.state as DeviceState);
  });

  energyManager.startLogging();

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    logger.info('LinkSphere Backend started', { port: PORT, environment: process.env.NODE_ENV || 'development' });
  });
}

startServer().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
