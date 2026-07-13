import express from 'express';
import { NotificationManager } from '../managers/NotificationManager';

const router = express.Router();
const notificationManager = NotificationManager.getInstance();

router.get('/', async (req, res) => {
  try {
    const notifications = await notificationManager.getAll();
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/unread', async (req, res) => {
  try {
    const notifications = await notificationManager.getUnread();
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:id/read', async (req, res) => {
  try {
    await notificationManager.markAsRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/read-all', async (req, res) => {
  try {
    await notificationManager.markAllAsRead();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await notificationManager.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export const notificationRoutes = router;
