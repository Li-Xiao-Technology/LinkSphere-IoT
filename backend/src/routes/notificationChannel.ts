import { Router } from 'express';
import { prisma } from '../prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const channels = await prisma.notificationChannel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(channels.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      config: JSON.parse(c.config || '{}'),
      enabled: c.enabled,
      events: JSON.parse(c.events || '[]'),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString()
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notification channels' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const channel = await prisma.notificationChannel.findUnique({
      where: { id: req.params.id, userId }
    });

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      config: JSON.parse(channel.config || '{}'),
      enabled: channel.enabled,
      events: JSON.parse(channel.events || '[]'),
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notification channel' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { name, type, config = {}, enabled = true, events = [] } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const validTypes = ['email', 'sms', 'dingtalk', 'wework', 'telegram'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    const channel = await prisma.notificationChannel.create({
      data: {
        name,
        type,
        config: JSON.stringify(config),
        enabled,
        events: JSON.stringify(events),
        userId
      }
    });

    res.status(201).json({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      config: JSON.parse(channel.config || '{}'),
      enabled: channel.enabled,
      events: JSON.parse(channel.events || '[]'),
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create notification channel' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { name, type, config, enabled, events } = req.body;

    const channel = await prisma.notificationChannel.update({
      where: { id: req.params.id, userId },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(config && { config: JSON.stringify(config) }),
        ...(enabled !== undefined && { enabled }),
        ...(events && { events: JSON.stringify(events) })
      }
    });

    res.json({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      config: JSON.parse(channel.config || '{}'),
      enabled: channel.enabled,
      events: JSON.parse(channel.events || '[]'),
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification channel' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    await prisma.notificationChannel.delete({
      where: { id: req.params.id, userId }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete notification channel' });
  }
});

router.post('/:id/test', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { message = 'This is a test notification from LinkSphere' } = req.body;

    const channel = await prisma.notificationChannel.findUnique({
      where: { id: req.params.id, userId }
    });

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const config = JSON.parse(channel.config || '{}');
    let success = false;
    let responseMessage = '';

    switch (channel.type) {
      case 'dingtalk':
        try {
          if (config.webhookUrl) {
            const result = await fetch(config.webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                msgtype: 'text',
                text: { content: message }
              })
            });
            success = result.ok;
            responseMessage = success ? 'Test message sent successfully' : 'Failed to send';
          } else {
            success = false;
            responseMessage = 'Webhook URL not configured';
          }
        } catch {
          success = false;
          responseMessage = 'Failed to connect to DingTalk';
        }
        break;

      case 'wework':
        try {
          if (config.webhookUrl) {
            const result = await fetch(config.webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                msgtype: 'text',
                text: { content: message }
              })
            });
            success = result.ok;
            responseMessage = success ? 'Test message sent successfully' : 'Failed to send';
          } else {
            success = false;
            responseMessage = 'Webhook URL not configured';
          }
        } catch {
          success = false;
          responseMessage = 'Failed to connect to WeWork';
        }
        break;

      case 'email':
        try {
          if (config.recipient) {
            success = true;
            responseMessage = `Would send email to ${config.recipient}: ${message}`;
          } else {
            success = false;
            responseMessage = 'Recipient email not configured';
          }
        } catch {
          success = false;
          responseMessage = 'Failed to send email';
        }
        break;

      case 'telegram':
        try {
          if (config.botToken && config.chatId) {
            const result = await fetch(
              `https://api.telegram.org/bot${config.botToken}/sendMessage`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: config.chatId,
                  text: message
                })
              }
            );
            success = result.ok;
            responseMessage = success ? 'Test message sent successfully' : 'Failed to send';
          } else {
            success = false;
            responseMessage = 'Bot token or chat ID not configured';
          }
        } catch {
          success = false;
          responseMessage = 'Failed to connect to Telegram';
        }
        break;

      default:
        success = false;
        responseMessage = `Unsupported channel type: ${channel.type}`;
    }

    res.json({
      success,
      message: responseMessage,
      channelType: channel.type
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to test notification channel' });
  }
});

export default router;