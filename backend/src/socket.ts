import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { DeviceManager } from './managers/DeviceManager';
import { isBlacklisted } from './utils/tokenStore';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

export function setupSocket(io: Server): void {
  const deviceManager = DeviceManager.getInstance();

  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    if (isBlacklisted(token)) {
      return next(new Error('Token has been revoked'));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(new Error('JWT_SECRET is not configured'));
    }

    try {
      const decoded = jwt.verify(token, secret) as {
        userId: string;
        username: string;
      };
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log('Client connected:', socket.id, 'user:', socket.username);

    socket.on('getDevices', () => {
      const devices = deviceManager.getAllDevices();
      socket.emit('devices', devices);
    });

    socket.on('getDeviceState', async (deviceId: string) => {
      const state = await deviceManager.getDeviceState(deviceId);
      socket.emit('deviceState', { deviceId, state });
    });

    socket.on('setDeviceState', async ({ deviceId, state }: { deviceId: string; state: Record<string, unknown> }) => {
      const success = await deviceManager.setDeviceState(deviceId, state);
      socket.emit('deviceStateUpdated', { deviceId, success });

      if (success) {
        const newState = await deviceManager.getDeviceState(deviceId);
        if (newState) {
          io.emit('deviceStateChanged', { deviceId, state: newState });
        }
      }
    });

    socket.on('discoverDevices', async () => {
      const devices = await deviceManager.discoverDevices();
      socket.emit('devicesDiscovered', devices);
      io.emit('devices', devices);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id, 'user:', socket.username);
    });
  });
}
