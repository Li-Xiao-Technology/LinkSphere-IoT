import express from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// GET / — List all webhook configs
router.get('/', authMiddleware, async (req, res) => {
  try {
    const webhooks = await prisma.webhookConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(webhooks);
  } catch (err) {
    logger.error('Failed to list webhook configs', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST / — Create webhook config { name, url, method?, headers?, events? }
router.post('/', authMiddleware, async (req, res) => {
  const { name, url, method, headers, events } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'name and url are required' });
  }

  try {
    const webhook = await prisma.webhookConfig.create({
      data: {
        name,
        url,
        method: method || 'POST',
        headers: headers ? JSON.stringify(headers) : null,
        events: events ? JSON.stringify(events) : '[]',
        enabled: true,
      },
    });
    res.json(webhook);
  } catch (err) {
    logger.error('Failed to create webhook config', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /:id — Update webhook config
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, url, method, headers, events, enabled } = req.body;

  const data: {
    name?: string;
    url?: string;
    method?: string;
    headers?: string | null;
    events?: string;
    enabled?: boolean;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (name !== undefined) data.name = name;
  if (url !== undefined) data.url = url;
  if (method !== undefined) data.method = method;
  if (headers !== undefined) data.headers = headers ? JSON.stringify(headers) : null;
  if (events !== undefined) data.events = JSON.stringify(events);
  if (enabled !== undefined) data.enabled = Boolean(enabled);

  try {
    const webhook = await prisma.webhookConfig.update({
      where: { id: req.params.id },
      data,
    });
    res.json(webhook);
  } catch (err) {
    if ((err as Error).message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'Webhook config not found' });
    }
    logger.error('Failed to update webhook config', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /:id — Delete webhook config
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.webhookDelivery.deleteMany({
      where: { webhookId: req.params.id },
    });
    await prisma.webhookConfig.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message.includes('Record to delete does not exist')) {
      return res.status(404).json({ error: 'Webhook config not found' });
    }
    logger.error('Failed to delete webhook config', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /:id/test — Send a test payload to the webhook
router.post('/:id/test', authMiddleware, async (req, res) => {
  try {
    const webhook = await prisma.webhookConfig.findUnique({
      where: { id: req.params.id },
    });
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook config not found' });
    }

    const payload = JSON.stringify({
      event: 'test',
      timestamp: new Date().toISOString(),
      message: 'Test payload from IoT backend',
    });

    let parsedHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      if (webhook.headers) {
        parsedHeaders = { ...parsedHeaders, ...JSON.parse(webhook.headers) };
      }
    } catch {
      // keep default headers
    }

    const startTime = Date.now();
    let statusCode: number | null = null;
    let responseText = '';
    let success = false;

    try {
      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers: parsedHeaders,
        body: webhook.method !== 'GET' && webhook.method !== 'HEAD' ? payload : undefined,
      });
      statusCode = response.status;
      responseText = await response.text();
      success = response.ok;
    } catch (fetchErr) {
      responseText = (fetchErr as Error).message;
      success = false;
    }

    const duration = Date.now() - startTime;

    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: 'test',
        payload,
        statusCode,
        response: responseText,
        success,
      },
    });

    res.json({
      success,
      statusCode,
      durationMs: duration,
      deliveryId: delivery.id,
    });
  } catch (err) {
    logger.error('Failed to test webhook', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /:id/deliveries — Get delivery history for a webhook (paginated)
router.get('/:id/deliveries', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [total, deliveries] = await Promise.all([
      prisma.webhookDelivery.count({ where: { webhookId: req.params.id } }),
      prisma.webhookDelivery.findMany({
        where: { webhookId: req.params.id },
        skip,
        take,
        orderBy: { deliveredAt: 'desc' },
      }),
    ]);

    const data = deliveries.map((d) => ({
      ...d,
      deliveredAt: d.deliveredAt.toISOString(),
    }));

    res.json({ data, total, page, pageSize });
  } catch (err) {
    logger.error('Failed to list webhook deliveries', err as Error);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
