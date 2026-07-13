import express from 'express';
import { ProtocolManager } from '../protocols/ProtocolManager';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// 获取已注册的协议适配器列表
router.get('/', authMiddleware, (_req, res) => {
  const pm = ProtocolManager.getInstance();
  const plugins = pm.getPluginInfo();
  res.json(plugins);
});

// 获取支持的品牌列表
router.get('/brands', authMiddleware, (_req, res) => {
  const pm = ProtocolManager.getInstance();
  res.json(pm.getSupportedBrands());
});

export default router;
