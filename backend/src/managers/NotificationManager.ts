import { EventEmitter } from 'events';
import { prisma } from '../prisma/client';
import { AppNotification, NotificationType } from '../types';
import { logger } from '../utils/logger';

export class NotificationManager {
  private static instance: NotificationManager;
  private emitter: EventEmitter = new EventEmitter();

  private constructor() {}

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  public async create(
    type: NotificationType,
    title: string,
    body?: string,
    deviceId?: string
  ): Promise<AppNotification | null> {
    const id = `notification-${Date.now()}`;
    const createdAt = new Date();

    try {
      const notification = await prisma.notification.create({
        data: {
          id,
          type,
          title,
          body,
          deviceId,
          read: false,
          createdAt
        }
      });

      const appNotification: AppNotification = {
        id: notification.id,
        type: notification.type as NotificationType,
        title: notification.title,
        body: notification.body ?? undefined,
        deviceId: notification.deviceId ?? undefined,
        read: notification.read,
        createdAt: notification.createdAt.toISOString()
      };

      this.emitter.emit('notification', appNotification);
      return appNotification;
    } catch (error) {
      logger.error('Failed to create notification', error as Error);
      return null;
    }
  }

  public async getAll(): Promise<AppNotification[]> {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return notifications.map(n => ({
      id: n.id,
      type: n.type as NotificationType,
      title: n.title,
      body: n.body ?? undefined,
      deviceId: n.deviceId ?? undefined,
      read: n.read,
      createdAt: n.createdAt.toISOString()
    }));
  }

  public async getUnread(): Promise<AppNotification[]> {
    const notifications = await prisma.notification.findMany({
      where: { read: false },
      orderBy: { createdAt: 'desc' }
    });

    return notifications.map(n => ({
      id: n.id,
      type: n.type as NotificationType,
      title: n.title,
      body: n.body ?? undefined,
      deviceId: n.deviceId ?? undefined,
      read: n.read,
      createdAt: n.createdAt.toISOString()
    }));
  }

  public async markAsRead(id: string): Promise<void> {
    try {
      await prisma.notification.update({
        where: { id },
        data: { read: true }
      });
    } catch (error) {
      logger.error(`Failed to mark notification ${id} as read`, error as Error);
    }
  }

  public async markAllAsRead(): Promise<void> {
    try {
      await prisma.notification.updateMany({
        where: { read: false },
        data: { read: true }
      });
    } catch (error) {
      logger.error('Failed to mark all notifications as read', error as Error);
    }
  }

  public async delete(id: string): Promise<void> {
    try {
      await prisma.notification.delete({
        where: { id }
      });
    } catch (error) {
      logger.error(`Failed to delete notification ${id}`, error as Error);
    }
  }

  public on(event: string, listener: Function): void {
    this.emitter.on(event, listener as (...args: any[]) => void);
  }
}
