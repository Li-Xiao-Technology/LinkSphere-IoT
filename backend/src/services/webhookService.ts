import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

type EventType =
  | 'device.offline'
  | 'device.online'
  | 'energy.anomaly'
  | 'rule.triggered'
  | 'threshold.exceeded'
  | 'schedule.executed'
  | 'firmware.updated'
  | 'device.controlled';

interface WebhookPayload {
  event: EventType;
  timestamp: string;
  data: Record<string, unknown>;
}

const SUPPRESSION_WINDOW = 5 * 60 * 1000; // 5 minutes
const suppressionMap = new Map<string, number>(); // key: webhookId:event:resourceId -> timestamp

function shouldSuppress(webhookId: string, event: string, resourceId?: string): boolean {
  const key = `${webhookId}:${event}:${resourceId || ''}`;
  const now = Date.now();
  const lastSent = suppressionMap.get(key);
  if (lastSent && now - lastSent < SUPPRESSION_WINDOW) {
    return true;
  }
  suppressionMap.set(key, now);
  return false;
}

// Periodic cleanup of old suppression entries
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of suppressionMap.entries()) {
    if (now - timestamp > SUPPRESSION_WINDOW * 2) {
      suppressionMap.delete(key);
    }
  }
}, 10 * 60 * 1000);

async function deliverWebhook(
  webhookId: string,
  url: string,
  method: string,
  headers: Record<string, string>,
  payload: WebhookPayload
): Promise<void> {
  const payloadStr = JSON.stringify(payload);
  let statusCode = 0;
  let responseBody = '';
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = response.status;
    responseBody = await response.text().catch(() => '');
    success = response.status >= 200 && response.status < 300;

    if (!success) {
      logger.warn(`Webhook ${webhookId} returned ${statusCode}`, { url, event: payload.event });
    }
  } catch (err) {
    logger.error(`Webhook ${webhookId} delivery failed`, err as Error, { url, event: payload.event });
    responseBody = (err as Error).message;
  }

  // Record delivery
  try {
    await prisma.webhookDelivery.create({
      data: {
        webhookId,
        event: payload.event,
        payload: payloadStr,
        statusCode: statusCode || null,
        response: responseBody.slice(0, 2000),
        success,
      },
    });
  } catch (e) {
    logger.error('Failed to record webhook delivery', e as Error);
  }
}

export async function triggerWebhookEvent(
  event: EventType,
  data: Record<string, unknown>,
  resourceId?: string
): Promise<void> {
  try {
    const webhooks = await prisma.webhookConfig.findMany({
      where: { enabled: true },
    });

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const deliveries: Promise<void>[] = [];

    for (const webhook of webhooks) {
      // Check if this webhook is subscribed to this event
      try {
        const events: string[] = JSON.parse(webhook.events || '[]');
        if (events.length > 0 && !events.includes(event) && !events.includes('*')) {
          continue;
        }
      } catch {
        // If events parsing fails, send to all
      }

      // Check suppression
      if (shouldSuppress(webhook.id, event, resourceId)) {
        logger.debug(`Webhook ${webhook.id} suppressed for event ${event}`);
        continue;
      }

      // Parse headers
      let headers: Record<string, string> = {};
      try {
        headers = JSON.parse(webhook.headers || '{}');
      } catch {
        // ignore
      }

      deliveries.push(deliverWebhook(webhook.id, webhook.url, webhook.method, headers, payload));
    }

    await Promise.allSettled(deliveries);
  } catch (err) {
    logger.error('triggerWebhookEvent failed', err as Error, { event });
  }
}

// Convenience helpers
export const webhookEvents = {
  deviceOffline: (deviceId: string, deviceName: string) =>
    triggerWebhookEvent('device.offline', { deviceId, deviceName }, deviceId),

  deviceOnline: (deviceId: string, deviceName: string) =>
    triggerWebhookEvent('device.online', { deviceId, deviceName }, deviceId),

  energyAnomaly: (deviceId: string, deviceName: string, type: string, value: number, threshold: number) =>
    triggerWebhookEvent('energy.anomaly', { deviceId, deviceName, type, value, threshold }, deviceId),

  ruleTriggered: (ruleId: string, ruleName: string, deviceId?: string) =>
    triggerWebhookEvent('rule.triggered', { ruleId, ruleName, deviceId }, ruleId),

  thresholdExceeded: (deviceId: string, property: string, value: number, limit: number) =>
    triggerWebhookEvent('threshold.exceeded', { deviceId, property, value, limit }, `${deviceId}:${property}`),

  scheduleExecuted: (scheduleId: string, scheduleName: string) =>
    triggerWebhookEvent('schedule.executed', { scheduleId, scheduleName }, scheduleId),

  firmwareUpdated: (deviceId: string, version: string) =>
    triggerWebhookEvent('firmware.updated', { deviceId, version }, deviceId),

  deviceControlled: (deviceId: string, deviceName: string, action: string, userId?: string) =>
    triggerWebhookEvent('device.controlled', { deviceId, deviceName, action, userId }, `${deviceId}:${action}`),
};
