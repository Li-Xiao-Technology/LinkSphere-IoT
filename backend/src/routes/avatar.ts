import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';
import { join, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';

const router = Router();

const uploadDir = join(__dirname, '../../public/uploads/avatars');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 JPEG、PNG、GIF 或 WebP 格式的图片'));
    }
  },
});

router.post('/', upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const userId = req.user?.userId;

    if (!file) {
      res.status(400).json({ error: '请选择要上传的头像图片', code: 'INVALID_FILE' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: '未授权', code: 'UNAUTHORIZED' });
      return;
    }

    const avatarUrl = `/uploads/avatars/${file.filename}`;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, username: true, avatarUrl: true },
    });

    logger.info(`User avatar updated: ${userId}`);

    res.json({
      success: true,
      message: '头像上传成功',
      data: {
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    logger.error('Avatar upload error:', err as Error);
    res.status(500).json({ error: err instanceof Error ? err.message : '上传失败', code: 'UPLOAD_ERROR' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: '未授权', code: 'UNAUTHORIZED' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    res.json({
      avatarUrl: user?.avatarUrl || null,
    });
  } catch (err) {
    logger.error('Get avatar error:', err as Error);
    res.status(500).json({ error: '获取失败', code: 'GET_ERROR' });
  }
});

router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: '未授权', code: 'UNAUTHORIZED' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    logger.info(`User avatar deleted: ${userId}`);

    res.json({
      success: true,
      message: '头像已删除',
    });
  } catch (err) {
    logger.error('Delete avatar error:', err as Error);
    res.status(500).json({ error: '删除失败', code: 'DELETE_ERROR' });
  }
});

export default router;