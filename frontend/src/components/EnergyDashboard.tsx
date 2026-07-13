import { useState, useEffect, useMemo, useRef } from 'react';
import { EnergySummary } from '../types';
import {
  getEnergySummary,
  getTotalEnergy,
  exportEnergyCSV,
  getEnergyTrend,
  getEnergyDistribution,
  getEnergyBarChart,
  getEnergyComparison,
  getEnergyAnomalies
} from '../api';

type Range = 'today' | 'week' | 'month';
type BarChartType = 'daily' | 'weekly' | 'monthly';

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];

const BAR_CHART_OPTIONS: { value: BarChartType; label: string }[] = [
  { value: 'daily', label: '近7天' },
  { value: 'weekly', label: '近4周' },
  { value: 'monthly', label: '近6月' },
];

const PIE_COLORS = ['#005FB8', '#107C10', '#8B5CF6', '#FF8C00', '#C42B1C', '#1975C5', '#FFA07A', '#20B2AA'];

export function EnergyDashboard() {
  const [range, setRange] = useState<Range>('today');
  const [barChartType, setBarChartType] = useState<BarChartType>('daily');
  const [summary, setSummary] = useState<EnergySummary[]>([]);
  const [total, setTotal] = useState<{ totalEnergy: number; totalPower: number; avgPower: number; deviceCount: number }>({
    totalEnergy: 0, totalPower: 0, avgPower: 0, deviceCount: 0,
  });
  const [trendData, setTrendData] = useState<{ time: string; power: number; energy: number }[]>([]);
  const [distributionData, setDistributionData] = useState<{ deviceId: string; deviceName: string; energy: number; percentage: number }[]>([]);
  const [barChartData, setBarChartData] = useState<{ label: string; energy: number; date: string }[]>([]);
  const [comparisonData, setComparisonData] = useState<{
    current: { energy: number; period: string };
    lastPeriod: { energy: number; period: string };
    lastYear: { energy: number; period: string };
    periodChange: number;
    yearChange: number;
  }>({
    current: { energy: 0, period: '' },
    lastPeriod: { energy: 0, period: '' },
    lastYear: { energy: 0, period: '' },
    periodChange: 0,
    yearChange: 0
  });
  const [anomalies, setAnomalies] = useState<{
    deviceId: string;
    deviceName: string;
    type: 'high' | 'low' | 'spike';
    message: string;
    value: number;
    threshold: number;
    timestamp: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData(range);
  }, [range]);

  useEffect(() => {
    loadBarChartData(barChartType);
  }, [barChartType]);

  async function loadData(r: Range) {
    setLoading(true);
    try {
      const [summaryData, totalData, trend, distribution, comparison, anomalyData] = await Promise.all([
        getEnergySummary(r),
        getTotalEnergy(r),
        getEnergyTrend(r),
        getEnergyDistribution(r),
        getEnergyComparison(),
        getEnergyAnomalies(),
      ]);
      setSummary(summaryData);
      setTotal(totalData);
      setTrendData(trend);
      setDistributionData(distribution);
      setComparisonData(comparison);
      setAnomalies(anomalyData);
    } catch (error) {
      console.error('Failed to load energy data:', error);
      setTrendData([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadBarChartData(type: BarChartType) {
    try {
      const data = await getEnergyBarChart(type);
      setBarChartData(data);
    } catch (error) {
      console.error('Failed to load bar chart data:', error);
      setBarChartData([]);
    }
  }

  const totalSummaryPower = useMemo(
    () => summary.reduce((acc, s) => acc + (s.avgPower ?? 0), 0),
    [summary]
  );

  const sortedSummary = useMemo(() => {
    const safeSummary = Array.isArray(summary) ? summary : [];
    return [...safeSummary].sort((a, b) => (b.avgPower ?? 0) - (a.avgPower ?? 0));
  }, [summary]);

  function handleExportChartImage(chartId: string, filename: string) {
    const canvas = document.getElementById(chartId) as HTMLCanvasElement;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function handleExportAllData() {
    const allData = {
      summary: sortedSummary,
      total,
      trend: trendData,
      distribution: distributionData,
      barChart: barChartData,
      comparison: comparisonData,
      anomalies,
      exportTime: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `能耗完整报告_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>能耗看板</h2>
          <p style={styles.subtitle}>实时监控设备能耗，洞察用电趋势，节能省电</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button style={styles.exportBtn} onClick={handleExportAllData} title="导出完整数据">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            导出报告
          </button>
          <button style={styles.csvBtn} onClick={() => exportEnergyCSV(range)} title="导出CSV">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            CSV
          </button>
          <div style={styles.rangeSelector}>
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                style={{
                  ...styles.rangeButton,
                  ...(range === opt.value ? styles.rangeButtonActive : {}),
                }}
                onClick={() => setRange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 异常预警 */}
      {anomalies.length > 0 && (
        <div style={styles.alertSection}>
          <div style={styles.alertHeader}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C42B1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h3 style={styles.alertTitle}>能耗异常预警</h3>
            <span style={styles.alertCount}>{anomalies.length} 条</span>
          </div>
          <div style={styles.alertList}>
            {anomalies.map((anomaly, index) => (
              <div key={index} style={styles.alertItem}>
                <div style={styles.alertIconWrap}>
                  {anomaly.type === 'high' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C42B1C" strokeWidth="2">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  )}
                  {anomaly.type === 'spike' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  )}
                </div>
                <div style={styles.alertContent}>
                  <div style={styles.alertDevice}>{anomaly.deviceName}</div>
                  <div style={styles.alertMessage}>{anomaly.message}</div>
                </div>
                <div style={styles.alertValue}>
                  {anomaly.value}W
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIconWrap, color: '#005FB8', background: 'rgba(0, 95, 184, 0.08)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div style={styles.statInfo}>
            <div style={styles.statLabel}>总功耗</div>
            <div style={styles.statValue}>
              {loading ? '--' : (total.totalPower ?? 0).toFixed(1)}
              <span style={styles.statUnit}>W</span>
            </div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIconWrap, color: '#107C10', background: 'rgba(16, 124, 16, 0.08)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1.06 6.7 2.82L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </div>
          <div style={styles.statInfo}>
            <div style={styles.statLabel}>{range === 'today' ? '今日能耗' : range === 'week' ? '本周能耗' : '本月能耗'}</div>
            <div style={styles.statValue}>
              {loading ? '--' : (total.totalEnergy ?? 0).toFixed(2)}
              <span style={styles.statUnit}>kWh</span>
            </div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIconWrap, color: '#8B5CF6', background: 'rgba(139, 92, 246, 0.1)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div style={styles.statInfo}>
            <div style={styles.statLabel}>设备数</div>
            <div style={styles.statValue}>
              {loading ? '--' : total.deviceCount ?? 0}
              <span style={styles.statUnit}>台</span>
            </div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIconWrap, color: '#FF8C00', background: 'rgba(255, 140, 0, 0.1)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div style={styles.statInfo}>
            <div style={styles.statLabel}>平均功耗</div>
            <div style={styles.statValue}>
              {loading ? '--' : (total.avgPower ?? 0).toFixed(1)}
              <span style={styles.statUnit}>W</span>
            </div>
          </div>
        </div>
      </div>

      {/* 第一行图表 */}
      <div style={styles.chartRow}>
        {/* 功率趋势图 */}
        <div style={{ ...styles.chartSection, flex: 2 }}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>{range === 'today' ? '24小时' : range === 'week' ? '近7天' : '近30天'}功率趋势</h3>
            <div style={styles.sectionActions}>
              <span style={styles.sectionMeta}>单位：W</span>
              <button style={styles.chartExportBtn} onClick={() => handleExportChartImage('trendCanvas', '功率趋势')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
            </div>
          </div>
          <div style={styles.chartCanvasWrap}>
            <TrendLineChartCanvas id="trendCanvas" data={trendData} loading={loading} />
          </div>
        </div>

        {/* 设备能耗饼图 */}
        <div style={{ ...styles.chartSection, flex: 1 }}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>设备能耗占比</h3>
            <div style={styles.sectionActions}>
              <button style={styles.chartExportBtn} onClick={() => handleExportChartImage('pieCanvas', '能耗占比')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
            </div>
          </div>
          <div style={styles.chartCanvasWrap}>
            <PieChartCanvas id="pieCanvas" data={distributionData} loading={loading} />
          </div>
        </div>
      </div>

      {/* 第二行图表 */}
      <div style={styles.chartRow}>
        {/* 柱状图 */}
        <div style={{ ...styles.chartSection, flex: 2 }}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>能耗统计</h3>
            <div style={styles.sectionActions}>
              <div style={styles.barChartSelector}>
                {BAR_CHART_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    style={{
                      ...styles.barChartBtn,
                      ...(barChartType === opt.value ? styles.barChartBtnActive : {}),
                    }}
                    onClick={() => setBarChartType(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button style={styles.chartExportBtn} onClick={() => handleExportChartImage('barCanvas', '能耗统计')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
            </div>
          </div>
          <div style={styles.chartCanvasWrap}>
            <BarChartCanvas id="barCanvas" data={barChartData} loading={loading} />
          </div>
        </div>

        {/* 能耗对比 */}
        <div style={{ ...styles.chartSection, flex: 1 }}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>能耗对比分析</h3>
            <span style={styles.sectionMeta}>环比 / 同比</span>
          </div>
          <div style={styles.comparisonWrap}>
            <ComparisonCard data={comparisonData} loading={loading} />
          </div>
        </div>
      </div>

      {/* 设备能耗排行 */}
      <div style={styles.chartSection}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>设备能耗排行</h3>
          <span style={styles.sectionMeta}>平均功耗排序</span>
        </div>
        {loading ? (
          <div style={styles.loadingState}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <div style={styles.loadingText}>加载数据中...</div>
          </div>
        ) : sortedSummary.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div style={styles.emptyTitle}>暂无能耗数据</div>
            <div style={styles.emptyDesc}>设备开始上报能耗后这里会显示统计排行</div>
          </div>
        ) : (
          <div style={styles.barList}>
            {sortedSummary.slice(0, 8).map((item, index) => {
              const avgPower = item.avgPower ?? 0;
              const percent = totalSummaryPower > 0 ? (avgPower / totalSummaryPower) * 100 : 0;
              const color = PIE_COLORS[index % PIE_COLORS.length];
              return (
                <div key={item.deviceId} style={styles.barRow}>
                  <div style={styles.barHeader}>
                    <div style={styles.barNameRow}>
                      <span style={styles.barRank}>{index + 1}</span>
                      <span style={styles.barName}>{item.deviceName}</span>
                    </div>
                    <div style={styles.barValueRow}>
                      <span style={styles.barPower}>{avgPower.toFixed(1)} W</span>
                      <span style={styles.barPercent}>{percent.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div style={styles.barTrack}>
                    <div
                      style={{
                        ...styles.barFill,
                        width: `${percent}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Canvas 折线图组件
interface TrendLineChartCanvasProps {
  id: string;
  data: { time: string; power: number; energy: number }[];
  loading: boolean;
}

function TrendLineChartCanvas({ id, data, loading }: TrendLineChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || loading || data.length === 0) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = 220 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = '220px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, 220);

    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const width = rect.width - padding.left - padding.right;
    const height = 220 - padding.top - padding.bottom;

    const maxPower = Math.max(...data.map(d => d.power), 1);
    const minPower = Math.min(...data.map(d => d.power), 0);
    const rangePower = maxPower - minPower || maxPower;

    // 绘制网格线
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (height / 4) * i;
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(padding.left, y);
      ctx.lineTo(rect.width - padding.right, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 绘制Y轴刻度
    ctx.fillStyle = '#8A8A8A';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = maxPower - (rangePower / 4) * i;
      const y = padding.top + (height / 4) * i;
      ctx.fillText(Math.round(val).toString(), padding.left - 6, y + 3);
    }

    // 绘制区域填充
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + height);
    gradient.addColorStop(0, 'rgba(0, 95, 184, 0.32)');
    gradient.addColorStop(1, 'rgba(0, 95, 184, 0)');

    ctx.beginPath();
    data.forEach((d, i) => {
      const x = padding.left + (width / (data.length - 1 || 1)) * i;
      const y = padding.top + height - ((d.power - minPower) / rangePower) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + width, padding.top + height);
    ctx.lineTo(padding.left, padding.top + height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 绘制折线
    ctx.beginPath();
    ctx.strokeStyle = '#005FB8';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    data.forEach((d, i) => {
      const x = padding.left + (width / (data.length - 1 || 1)) * i;
      const y = padding.top + height - ((d.power - minPower) / rangePower) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 绘制数据点和X轴标签
    ctx.fillStyle = '#8A8A8A';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const labelStep = Math.ceil(data.length / 8);
    data.forEach((d, i) => {
      const x = padding.left + (width / (data.length - 1 || 1)) * i;
      const y = padding.top + height - ((d.power - minPower) / rangePower) * height;

      if (i % labelStep === 0 || i === data.length - 1) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#005FB8';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#8A8A8A';
        ctx.fillText(d.time, x, 220 - padding.bottom + 16);
      }
    });
  }, [data, loading]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} id={id} />
    </div>
  );
}

// Canvas 饼图组件
interface PieChartCanvasProps {
  id: string;
  data: { deviceId: string; deviceName: string; energy: number; percentage: number }[];
  loading: boolean;
}

function PieChartCanvas({ id, data, loading }: PieChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loading) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 360 * dpr;
    canvas.height = 280 * dpr;
    canvas.style.width = '360px';
    canvas.style.height = '280px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, 360, 280);

    const centerX = 130;
    const centerY = 140;
    const radius = 90;

    if (data.length === 0) {
      ctx.fillStyle = '#B0B0B0';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无数据', centerX, centerY);
      return;
    }

    let startAngle = -Math.PI / 2;
    const total = data.reduce((sum, d) => sum + d.percentage, 0);

    data.forEach((d, i) => {
      const sliceAngle = (d.percentage / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length];
      ctx.fill();

      startAngle = endAngle;
    });

    // 中心空白圆
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 中心文字
    ctx.fillStyle = '#1A1A1A';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(data.reduce((sum, d) => sum + d.energy, 0)) + ' kWh', centerX, centerY + 6);

    // 图例
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    const legendStartY = 20;
    data.slice(0, 6).forEach((d, i) => {
      const y = legendStartY + i * 20;
      const x = 250;

      ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length];
      ctx.fillRect(x, y - 6, 12, 12);

      ctx.fillStyle = '#1A1A1A';
      const name = d.deviceName.length > 8 ? d.deviceName.slice(0, 8) + '...' : d.deviceName;
      ctx.fillText(`${name} ${d.percentage.toFixed(1)}%`, x + 16, y);
    });
  }, [data, loading]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <canvas ref={canvasRef} id={id} />
    </div>
  );
}

// Canvas 柱状图组件
interface BarChartCanvasProps {
  id: string;
  data: { label: string; energy: number; date: string }[];
  loading: boolean;
}

function BarChartCanvas({ id, data, loading }: BarChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || loading || data.length === 0) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = 220 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = '220px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, 220);

    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const width = rect.width - padding.left - padding.right;
    const height = 220 - padding.top - padding.bottom;

    const maxEnergy = Math.max(...data.map(d => d.energy), 1);
    const barWidth = Math.max(20, (width / data.length) - 12);
    const gap = (width - barWidth * data.length) / (data.length + 1);

    // 绘制网格线
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (height / 4) * i;
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(padding.left, y);
      ctx.lineTo(rect.width - padding.right, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 绘制Y轴刻度
    ctx.fillStyle = '#8A8A8A';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = maxEnergy - (maxEnergy / 4) * i;
      const y = padding.top + (height / 4) * i;
      ctx.fillText(Math.round(val).toString(), padding.left - 6, y + 3);
    }

    // 绘制柱子
    data.forEach((d, i) => {
      const x = padding.left + gap + i * (barWidth + gap);
      const barHeight = (d.energy / maxEnergy) * height;
      const y = padding.top + height - barHeight;

      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, '#005FB8');
      gradient.addColorStop(1, '#005FB8CC');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      ctx.fill();

      // X轴标签
      ctx.fillStyle = '#8A8A8A';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barWidth / 2, 220 - padding.bottom + 16);
    });
  }, [data, loading]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} id={id} />
    </div>
  );
}

// 能耗对比卡片组件
interface ComparisonCardProps {
  data: {
    current: { energy: number; period: string };
    lastPeriod: { energy: number; period: string };
    lastYear: { energy: number; period: string };
    periodChange: number;
    yearChange: number;
  };
  loading: boolean;
}

function ComparisonCard({ data, loading }: ComparisonCardProps) {
  if (loading) {
    return (
      <div style={styles.comparisonLoading}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  return (
    <div style={styles.comparisonContent}>
      <div style={styles.comparisonItem}>
        <div style={styles.comparisonLabel}>当前</div>
        <div style={styles.comparisonValue}>{data.current.energy} kWh</div>
        <div style={styles.comparisonPeriod}>{data.current.period}</div>
      </div>

      <div style={styles.comparisonArrow}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>

      <div style={styles.comparisonItem}>
        <div style={styles.comparisonLabel}>环比</div>
        <div style={{ ...styles.comparisonChange, color: data.periodChange > 0 ? '#C42B1C' : '#107C10' }}>
          {data.periodChange > 0 ? '+' : ''}{data.periodChange.toFixed(1)}%
        </div>
        <div style={styles.comparisonSub}>{data.lastPeriod.period}</div>
        <div style={styles.comparisonSubValue}>{data.lastPeriod.energy} kWh</div>
      </div>

      <div style={styles.comparisonArrow}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>

      <div style={styles.comparisonItem}>
        <div style={styles.comparisonLabel}>同比</div>
        <div style={{ ...styles.comparisonChange, color: data.yearChange > 0 ? '#C42B1C' : '#107C10' }}>
          {data.yearChange > 0 ? '+' : ''}{data.yearChange.toFixed(1)}%
        </div>
        <div style={styles.comparisonSub}>{data.lastYear.period}</div>
        <div style={styles.comparisonSubValue}>{data.lastYear.energy} kWh</div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#1A1A1A',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  subtitle: {
    fontSize: '13px',
    color: '#5B5B5B',
    marginTop: '4px',
    margin: 0,
  },
  rangeSelector: {
    display: 'flex',
    background: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '8px',
    padding: '3px',
  },
  rangeButton: {
    padding: '6px 14px',
    background: 'transparent',
    border: 'none',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
  },
  rangeButtonActive: {
    background: '#005FB8',
    color: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0, 95, 184, 0.2)',
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    background: '#005FB8',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  csvBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    background: '#FFFFFF',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#5B5B5B',
    cursor: 'pointer',
  },
  alertSection: {
    background: 'rgba(196, 43, 28, 0.08)',
    border: '1px solid rgba(196, 43, 28, 0.2)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },
  alertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  alertTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#C42B1C',
    margin: 0,
  },
  alertCount: {
    fontSize: '12px',
    background: '#C42B1C',
    color: '#FFFFFF',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  alertList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  alertItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#FFFFFF',
    padding: '10px 12px',
    borderRadius: '8px',
  },
  alertIconWrap: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(196, 43, 28, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
  },
  alertDevice: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  alertMessage: {
    fontSize: '12px',
    color: '#5B5B5B',
    marginTop: '2px',
  },
  alertValue: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#C42B1C',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '14px',
    marginBottom: '20px',
  },
  statCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  statIconWrap: {
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statInfo: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    fontSize: '12px',
    color: '#8A8A8A',
    marginBottom: '4px',
  },
  statValue: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#1A1A1A',
    letterSpacing: '-0.02em',
  },
  statUnit: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#8A8A8A',
    marginLeft: '4px',
  },
  chartRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  chartSection: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '18px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    marginBottom: '16px',
    minWidth: '320px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  sectionActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionMeta: {
    fontSize: '12px',
    color: '#8A8A8A',
  },
  chartExportBtn: {
    padding: '4px 8px',
    background: 'transparent',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#5B5B5B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCanvasWrap: {
    width: '100%',
    overflowX: 'auto',
  },
  barChartSelector: {
    display: 'flex',
    gap: '4px',
    background: 'rgba(0, 0, 0, 0.04)',
    borderRadius: '6px',
    padding: '2px',
  },
  barChartBtn: {
    padding: '4px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    color: '#5B5B5B',
    cursor: 'pointer',
  },
  barChartBtnActive: {
    background: '#005FB8',
    color: '#FFFFFF',
  },
  comparisonWrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px 0',
  },
  comparisonLoading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
  },
  comparisonContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  comparisonItem: {
    textAlign: 'center',
    minWidth: '80px',
  },
  comparisonLabel: {
    fontSize: '11px',
    color: '#8A8A8A',
    marginBottom: '4px',
  },
  comparisonValue: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#1A1A1A',
  },
  comparisonPeriod: {
    fontSize: '10px',
    color: '#5B5B5B',
    marginTop: '2px',
  },
  comparisonChange: {
    fontSize: '16px',
    fontWeight: 700,
  },
  comparisonSub: {
    fontSize: '10px',
    color: '#8A8A8A',
    marginTop: '2px',
  },
  comparisonSubValue: {
    fontSize: '12px',
    color: '#5B5B5B',
  },
  comparisonArrow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  loadingText: {
    marginTop: '12px',
    fontSize: '13px',
    color: '#5B5B5B',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  emptyIcon: { marginBottom: '12px' },
  emptyTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#5B5B5B',
    marginBottom: '4px',
  },
  emptyDesc: { fontSize: '12px', color: '#8A8A8A' },
  barList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  barRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  barHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  barRank: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
    fontSize: '11px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  barName: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#1A1A1A',
  },
  barValueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  barPower: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  barPercent: {
    fontSize: '12px',
    color: '#8A8A8A',
    minWidth: '48px',
    textAlign: 'right',
  },
  barTrack: {
    width: '100%',
    height: '8px',
    background: 'rgba(0, 0, 0, 0.04)',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.4s ease',
  },
};