import express from 'express';
import { EnergyManager } from '../managers/EnergyManager';

const router = express.Router();
const energyManager = EnergyManager.getInstance();

function parseRange(range?: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    default:
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

router.get('/summary', async (req, res) => {
  try {
    const summary = await energyManager.getEnergySummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/total', async (req, res) => {
  try {
    const total = await energyManager.getTotalEnergy();
    res.json(total);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/device/:id', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string, 10) || 24;
    const logs = await energyManager.getDeviceEnergy(req.params.id, hours);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const range = req.query.range as string | undefined;
    const { start, end } = parseRange(range);
    const { csv, filename } = await energyManager.exportCSV(start, end);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));
    res.send('\ufeff' + csv);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/devices/:deviceId/export/csv', async (req, res) => {
  try {
    const range = req.query.range as string | undefined;
    const { start, end } = parseRange(range);
    const { csv, filename } = await energyManager.exportDeviceCSV(req.params.deviceId, start, end);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));
    res.send('\ufeff' + csv);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取趋势数据
router.get('/trend', async (req, res) => {
  try {
    const range = (req.query.range as 'today' | 'week' | 'month') || 'today';
    const data = await energyManager.getTrendData(range);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取设备能耗分布
router.get('/distribution', async (req, res) => {
  try {
    const range = (req.query.range as 'today' | 'week' | 'month') || 'today';
    const data = await energyManager.getDeviceEnergyDistribution(range);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取柱状图数据
router.get('/bar-chart', async (req, res) => {
  try {
    const type = (req.query.type as 'daily' | 'weekly' | 'monthly') || 'daily';
    const data = await energyManager.getBarChartData(type);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取能耗对比数据
router.get('/comparison', async (req, res) => {
  try {
    const data = await energyManager.getComparisonData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取能耗异常
router.get('/anomalies', async (req, res) => {
  try {
    const data = await energyManager.getAnomalies();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export const energyRoutes = router;
