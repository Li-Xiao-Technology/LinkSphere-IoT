import { useState, useEffect, useMemo } from 'react';
import { PredictionReport, AnomalyWarning, EnergyTrendPrediction, UsageFrequencyPrediction, StateChangePattern } from '../types';
import { getPredictionReport } from '../api';

type TimeRange = 7 | 14 | 30;

const TIME_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 7, label: '7天' },
  { value: 14, label: '14天' },
  { value: 30, label: '30天' },
];

export function PredictionDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>(7);
  const [report, setReport] = useState<PredictionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  useEffect(() => {
    loadData(timeRange);
  }, [timeRange]);

  async function loadData(days: TimeRange) {
    setLoading(true);
    try {
      const data = await getPredictionReport(days);
      setReport(data);
    } catch (error) {
      console.error('Failed to load prediction data:', error);
    } finally {
      setLoading(false);
    }
  }

  const sortedWarnings = useMemo(() => {
    if (!report?.anomalyWarnings) return [];
    return [...report.anomalyWarnings].sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [report?.anomalyWarnings]);

  const selectedEnergyPrediction = useMemo(() => {
    if (!report?.energyPredictions || !selectedDevice) return null;
    return report.energyPredictions.find(p => p.deviceId === selectedDevice);
  }, [report?.energyPredictions, selectedDevice]);

  const selectedUsagePrediction = useMemo(() => {
    if (!report?.usagePredictions || !selectedDevice) return null;
    return report.usagePredictions.find(p => p.deviceId === selectedDevice);
  }, [report?.usagePredictions, selectedDevice]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>预测分析看板</h2>
          <p style={styles.subtitle}>基于历史数据分析设备使用趋势，预测能耗变化，智能预警异常状态</p>
        </div>
        <div style={styles.rangeSelector}>
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              style={{
                ...styles.rangeButton,
                ...(timeRange === opt.value ? styles.rangeButtonActive : {}),
              }}
              onClick={() => setTimeRange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingState}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <div style={styles.loadingText}>正在分析历史数据...</div>
        </div>
      ) : !report ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 1-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div style={styles.emptyTitle}>暂无预测数据</div>
          <div style={styles.emptyDesc}>设备积累一定历史数据后将生成预测分析</div>
        </div>
      ) : (
        <>
          {/* 异常预警卡片 */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>异常状态预警</h3>
              <span style={styles.sectionMeta}>
                {sortedWarnings.length > 0 ? `${sortedWarnings.length} 个预警` : '无预警'}
              </span>
            </div>
            {sortedWarnings.length === 0 ? (
              <div style={styles.noWarnings}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#107C10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span style={styles.noWarningsText}>所有设备运行正常</span>
              </div>
            ) : (
              <div style={styles.warningList}>
                {sortedWarnings.map((warning, index) => (
                  <WarningCard key={`${warning.deviceId}-${index}`} warning={warning} />
                ))}
              </div>
            )}
          </div>

          {/* 能耗预测 */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>能耗趋势预测</h3>
              <span style={styles.sectionMeta}>预测未来24小时能耗</span>
            </div>
            {report.energyPredictions.length === 0 ? (
              <div style={styles.emptySection}>
                <span style={styles.emptySectionText}>暂无能耗预测数据</span>
              </div>
            ) : (
              <>
                <div style={styles.deviceSelector}>
                  {report.energyPredictions.map((pred) => (
                    <button
                      key={pred.deviceId}
                      style={{
                        ...styles.deviceButton,
                        ...(selectedDevice === pred.deviceId || (!selectedDevice && pred === report.energyPredictions[0]) ? styles.deviceButtonActive : {}),
                      }}
                      onClick={() => setSelectedDevice(pred.deviceId)}
                    >
                      {pred.deviceName}
                      <span style={getDeviceTrendBadgeStyle(pred.trend)}>
                        {pred.trend === 'increasing' ? '↑' : pred.trend === 'decreasing' ? '↓' : '→'}
                      </span>
                    </button>
                  ))}
                </div>
                {(selectedEnergyPrediction || report.energyPredictions[0]) && (
                  <EnergyPredictionChart prediction={selectedEnergyPrediction || report.energyPredictions[0]} />
                )}
              </>
            )}
          </div>

          {/* 使用频率预测 */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>设备使用频率预测</h3>
              <span style={styles.sectionMeta}>基于状态变化分析</span>
            </div>
            {report.usagePredictions.length === 0 ? (
              <div style={styles.emptySection}>
                <span style={styles.emptySectionText}>暂无使用频率预测数据</span>
              </div>
            ) : (
              <div style={styles.frequencyGrid}>
                {report.usagePredictions.map((pred) => (
                  <FrequencyCard key={pred.deviceId} prediction={pred} />
                ))}
              </div>
            )}
          </div>

          {/* 状态稳定性分析 */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>设备状态稳定性</h3>
              <span style={styles.sectionMeta}>基于状态变化规律分析</span>
            </div>
            {report.statePatterns.length === 0 ? (
              <div style={styles.emptySection}>
                <span style={styles.emptySectionText}>暂无状态模式分析数据</span>
              </div>
            ) : (
              <div style={styles.stabilityList}>
                {report.statePatterns.map((pattern) => (
                  <StabilityCard key={pattern.deviceId} pattern={pattern} />
                ))}
              </div>
            )}
          </div>

          {/* 报告生成时间 */}
          <div style={styles.footer}>
            <span style={styles.footerText}>
              报告生成时间：{new Date(report.generatedAt).toLocaleString('zh-CN')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function WarningCard({ warning }: { warning: AnomalyWarning }) {
  const severityColors = {
    high: { bg: 'rgba(196, 43, 28, 0.1)', border: '#C42B1C', color: '#C42B1C' },
    medium: { bg: 'rgba(255, 140, 0, 0.1)', border: '#FF8C00', color: '#FF8C00' },
    low: { bg: 'rgba(0, 95, 184, 0.08)', border: '#005FB8', color: '#005FB8' },
  };

  const typeIcons = {
    high_energy: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    unstable_state: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
        <line x1="18.36" y1="18.36" x2="6.64" y2="6.64" />
      </svg>
    ),
    abnormal_usage: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    potential_failure: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  };

  const colors = severityColors[warning.severity];

  return (
    <div style={{ ...styles.warningCard, borderColor: colors.border, background: colors.bg }}>
      <div style={{ ...styles.warningIcon, color: colors.color }}>
        {typeIcons[warning.type]}
      </div>
      <div style={styles.warningContent}>
        <div style={styles.warningHeader}>
          <span style={{ ...styles.warningDevice, color: colors.color }}>{warning.deviceName}</span>
          <span style={{ ...styles.warningSeverity, background: colors.border }}>{warning.severity === 'high' ? '高' : warning.severity === 'medium' ? '中' : '低'}</span>
        </div>
        <div style={styles.warningMessage}>{warning.message}</div>
      </div>
    </div>
  );
}

function EnergyPredictionChart({ prediction }: { prediction: EnergyTrendPrediction }) {
  const maxPower = Math.max(...prediction.hourlyForecast.map(h => h.predictedPower), 1);

  return (
    <div style={styles.chartContainer}>
      <div style={styles.predictionStats}>
        <div style={styles.predictionStat}>
          <div style={styles.predictionStatLabel}>当前平均功率</div>
          <div style={styles.predictionStatValue}>{prediction.currentAvgPower} W</div>
        </div>
        <div style={styles.predictionStat}>
          <div style={styles.predictionStatLabel}>预测平均功率</div>
          <div style={styles.predictionStatValue}>{prediction.predictedAvgPower} W</div>
          <div style={getTrendIndicatorStyle(prediction.trend)}>
            {prediction.trend === 'increasing' ? '↑ 上升' : prediction.trend === 'decreasing' ? '↓ 下降' : '→ 稳定'}
          </div>
        </div>
        <div style={styles.predictionStat}>
          <div style={styles.predictionStatLabel}>预测日能耗</div>
          <div style={styles.predictionStatValue}>{prediction.predictedDailyEnergy} kWh</div>
        </div>
        <div style={styles.predictionStat}>
          <div style={styles.predictionStatLabel}>置信度</div>
          <div style={styles.predictionStatValue}>{Math.round(prediction.confidence * 100)}%</div>
        </div>
      </div>
      <div style={styles.chartWrap}>
        <ForecastLineChart data={prediction.hourlyForecast} maxPower={maxPower} />
      </div>
    </div>
  );
}

interface ForecastLineChartProps {
  data: { hour: number; predictedPower: number }[];
  maxPower: number;
}

function ForecastLineChart({ data, maxPower }: ForecastLineChartProps) {
  const width = 720;
  const height = 200;
  const padding = { top: 16, right: 16, bottom: 28, left: 44 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const xStep = innerWidth / (data.length - 1);
  const points = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + innerHeight - (d.predictedPower / maxPower) * innerHeight,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x},${padding.top + innerHeight} L ${points[0].x},${padding.top + innerHeight} Z`;

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxPower / yTicks) * i);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="predictionGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTickValues.map((val, i) => {
        const y = padding.top + innerHeight - (val / maxPower) * innerHeight;
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="rgba(0, 0, 0, 0.06)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text
              x={padding.left - 6}
              y={y + 3}
              fontSize="10"
              fill="#8A8A8A"
              textAnchor="end"
            >
              {Math.round(val)}
            </text>
          </g>
        );
      })}

      <path d={areaD} fill="url(#predictionGradient)" />
      <path d={pathD} fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {points.map((p, i) => {
        if (i % 4 !== 0) return null;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="#FFFFFF" stroke="#8B5CF6" strokeWidth="2" />
            <text
              x={p.x}
              y={height - padding.bottom + 16}
              fontSize="10"
              fill="#8A8A8A"
              textAnchor="middle"
            >
              {data[i].hour}:00
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function FrequencyCard({ prediction }: { prediction: UsageFrequencyPrediction }) {
  const trendIcon = prediction.trend === 'increasing' ? '↑' : prediction.trend === 'decreasing' ? '↓' : '→';
  const trendColor = prediction.trend === 'increasing' ? '#C42B1C' : prediction.trend === 'decreasing' ? '#107C10' : '#8A8A8A';

  return (
    <div style={styles.frequencyCard}>
      <div style={styles.frequencyHeader}>
        <span style={styles.frequencyName}>{prediction.deviceName}</span>
        <span style={{ ...styles.frequencyTrend, color: trendColor }}>{trendIcon}</span>
      </div>
      <div style={styles.frequencyValues}>
        <div style={styles.frequencyValueItem}>
          <span style={styles.frequencyLabel}>当前频率</span>
          <span style={styles.frequencyValue}>{prediction.currentFrequency.toFixed(2)}/h</span>
        </div>
        <div style={styles.frequencyValueItem}>
          <span style={styles.frequencyLabel}>预测频率</span>
          <span style={styles.frequencyValue}>{prediction.predictedFrequency.toFixed(2)}/h</span>
        </div>
      </div>
      <div style={styles.frequencyConfidence}>
        <span style={styles.confidenceLabel}>置信度</span>
        <div style={styles.confidenceBar}>
          <div style={{ ...styles.confidenceFill, width: `${prediction.confidence * 100}%` }} />
        </div>
        <span style={styles.confidenceValue}>{Math.round(prediction.confidence * 100)}%</span>
      </div>
    </div>
  );
}

function StabilityCard({ pattern }: { pattern: StateChangePattern }) {
  const stabilityColor = pattern.stabilityScore > 0.7 ? '#107C10' : pattern.stabilityScore > 0.4 ? '#FF8C00' : '#C42B1C';

  return (
    <div style={styles.stabilityCard}>
      <div style={styles.stabilityHeader}>
        <span style={styles.stabilityName}>{pattern.deviceName}</span>
        <span style={{ ...styles.stabilityScore, color: stabilityColor }}>
          稳定性 {Math.round(pattern.stabilityScore * 100)}%
        </span>
      </div>
      <div style={styles.stabilityBar}>
        <div style={{ ...styles.stabilityFill, width: `${pattern.stabilityScore * 100}%`, background: stabilityColor }} />
      </div>
      {pattern.patterns.frequentTransitions.length > 0 && (
        <div style={styles.transitionsWrap}>
          <span style={styles.transitionsLabel}>常见状态转换：</span>
          <div style={styles.transitionsList}>
            {pattern.patterns.frequentTransitions.slice(0, 3).map((t, i) => (
              <span key={i} style={styles.transitionBadge}>
                {t.from} → {t.to}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  section: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '18px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    marginBottom: '16px',
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
  sectionMeta: {
    fontSize: '12px',
    color: '#8A8A8A',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px',
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
    padding: '80px 24px',
  },
  emptyIcon: { marginBottom: '12px' },
  emptyTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#5B5B5B',
    marginBottom: '4px',
  },
  emptyDesc: { fontSize: '12px', color: '#8A8A8A' },
  emptySection: {
    padding: '32px',
    textAlign: 'center',
  },
  emptySectionText: {
    fontSize: '13px',
    color: '#8A8A8A',
  },
  noWarnings: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '24px',
    background: 'rgba(16, 124, 16, 0.05)',
    borderRadius: '8px',
  },
  noWarningsText: {
    fontSize: '13px',
    color: '#107C10',
    fontWeight: 500,
  },
  warningList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  warningCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid',
  },
  warningIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  warningContent: {
    flex: 1,
  },
  warningHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  warningDevice: {
    fontSize: '13px',
    fontWeight: 600,
  },
  warningSeverity: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#FFFFFF',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  warningMessage: {
    fontSize: '12px',
    color: '#5B5B5B',
  },
  deviceSelector: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  deviceButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#5B5B5B',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  deviceButtonActive: {
    background: '#005FB8',
    color: '#FFFFFF',
    border: '1px solid #005FB8',
  },
  chartContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  predictionStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '12px',
  },
  predictionStat: {
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
  },
  predictionStatLabel: {
    fontSize: '11px',
    color: '#8A8A8A',
    marginBottom: '4px',
  },
  predictionStatValue: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1A1A1A',
  },
  chartWrap: {
    width: '100%',
    overflowX: 'auto',
  },
  frequencyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '12px',
  },
  frequencyCard: {
    padding: '14px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
  },
  frequencyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  frequencyName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  frequencyTrend: {
    fontSize: '14px',
    fontWeight: 700,
  },
  frequencyValues: {
    display: 'flex',
    gap: '16px',
    marginBottom: '10px',
  },
  frequencyValueItem: {
    flex: 1,
  },
  frequencyLabel: {
    fontSize: '11px',
    color: '#8A8A8A',
    marginBottom: '2px',
  },
  frequencyValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  frequencyConfidence: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  confidenceLabel: {
    fontSize: '11px',
    color: '#8A8A8A',
  },
  confidenceBar: {
    flex: 1,
    height: '6px',
    background: 'rgba(0, 0, 0, 0.06)',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    background: '#005FB8',
    borderRadius: '999px',
  },
  confidenceValue: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#005FB8',
  },
  stabilityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  stabilityCard: {
    padding: '14px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
  },
  stabilityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  stabilityName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  stabilityScore: {
    fontSize: '12px',
    fontWeight: 600,
  },
  stabilityBar: {
    height: '8px',
    background: 'rgba(0, 0, 0, 0.06)',
    borderRadius: '999px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  stabilityFill: {
    height: '100%',
    borderRadius: '999px',
  },
  transitionsWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  transitionsLabel: {
    fontSize: '11px',
    color: '#8A8A8A',
  },
  transitionsList: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  transitionBadge: {
    fontSize: '10px',
    padding: '3px 8px',
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
    borderRadius: '4px',
  },
  footer: {
    textAlign: 'center',
    padding: '12px',
  },
  footerText: {
    fontSize: '11px',
    color: '#8A8A8A',
  },
};

function getDeviceTrendBadgeStyle(trend: string): React.CSSProperties {
  return {
    fontSize: '11px',
    fontWeight: 600,
    color: trend === 'increasing' ? '#C42B1C' : trend === 'decreasing' ? '#107C10' : '#8A8A8A',
  };
}

function getTrendIndicatorStyle(trend: string): React.CSSProperties {
  return {
    marginTop: '4px',
    fontSize: '11px',
    fontWeight: 500,
    color: trend === 'increasing' ? '#C42B1C' : trend === 'decreasing' ? '#107C10' : '#8A8A8A',
  };
}