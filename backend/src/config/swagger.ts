import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LinkSphere API',
      version: '1.0.0',
      description: 'LinkSphere 智能设备互联管理平台 API 文档',
      contact: {
        name: 'LinkSphere Team',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3001/api',
        description: process.env.NODE_ENV === 'production' ? '生产环境' : '开发环境',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Device: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            brand: { type: 'string' },
            type: { type: 'string' },
            status: { type: 'string' },
            ipAddress: { type: 'string' },
            roomId: { type: 'string' },
          },
        },
        Rule: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            conditions: { type: 'array' },
            actions: { type: 'array' },
            enabled: { type: 'boolean' },
          },
        },
        Scene: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            actions: { type: 'array' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/auth.ts',
    './src/routes/user.ts',
    './src/routes/device.ts',
    './src/routes/modbus.ts',
    './src/routes/room.ts',
    './src/routes/rule.ts',
    './src/routes/scene.ts',
    './src/routes/schedule.ts',
    './src/routes/energy.ts',
    './src/routes/prediction.ts',
    './src/routes/notification.ts',
    './src/routes/household.ts',
    './src/routes/permission.ts',
    './src/routes/deviceShare.ts',
    './src/routes/search.ts',
    './src/routes/chat.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
