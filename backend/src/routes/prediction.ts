import express from 'express';
import { PredictionService } from '../managers/PredictionService';

const router = express.Router();
const predictionService = PredictionService.getInstance();

// 获取设备使用频率预测
router.get('/usage-frequency', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 7;
    const predictions = await predictionService.predictUsageFrequency(days);
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取能耗趋势预测
router.get('/energy-trend', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 7;
    const predictions = await predictionService.predictEnergyTrend(days);
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取设备状态变化规律分析
router.get('/state-patterns', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 14;
    const patterns = await predictionService.analyzeStatePatterns(days);
    res.json(patterns);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取异常状态预警
router.get('/anomalies', async (req, res) => {
  try {
    const warnings = await predictionService.detectAnomalies();
    res.json(warnings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取综合预测报告
router.get('/report', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 7;
    
    const [usagePredictions, energyPredictions, statePatterns, anomalyWarnings] = await Promise.all([
      predictionService.predictUsageFrequency(days),
      predictionService.predictEnergyTrend(days),
      predictionService.analyzeStatePatterns(days),
      predictionService.detectAnomalies()
    ]);
    
    res.json({
      usagePredictions,
      energyPredictions,
      statePatterns,
      anomalyWarnings,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export const predictionRoutes = router;