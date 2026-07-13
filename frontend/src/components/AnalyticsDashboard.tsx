import { useState, useEffect, useRef } from 'react';
import {
  getAnalyticsSummary,
  getDeviceUsage,
  getUserActivity,
  getActivityTimeline,
  getDevices,
  AnalyticsSummary,
  DeviceUsageItem,
  UserActivityItem,
  TimelineItem,
} from '../api';
import { Device } from '../types';

const REFRESH_INTERVAL = 30000;

export function AnalyticsDashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary>({ totalUsers: 0, totalDevices: 0, totalRules: 0, totalScenes: 0, activeRules: 0 });
  const [deviceUsage, setDeviceUsage] = useState<DeviceUsageItem[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivityItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadAll();
    timerRef.current = setInterval(loadAll, REFRESH_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setError('');
    try {
      const [sum, usage, activity, tl, devList] = await Promise.all([
        getAnalyticsSummary(),
        getDeviceUsage(),
        getUserActivity(),
        getActivityTimeline(),
        getDevices(),
      ]);
      setSummary(sum || { totalUsers: 0, totalDevices: 0, totalRules: 0, totalScenes: 0, activeRules: 0 });
      setDeviceUsage(usage);
      setUserActivity(activity);
      setTimeline(tl);
      setDevices(devList);
      setLastUpdated(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载分析数据失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const deviceNameMap = new Map<string, string>();
  for (const d of devices) deviceNameMap.set(d.id, d.name);

  const topDevices = deviceUsage.slice(0, 10);
  const topUsers = userActivity.slice(0, 10);
  const maxTimeline = timeline.reduce((m, t) => Math.max(m, t.count), 0);

  if (loading) {
    return (
      <div style={styles.loadingState}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <div style={styles.loadingText}>加载分析数据中...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>活动分析</h2>
          <p style={styles.subtitle}>
            用户活动与设备使用情况
            {lastUpdated && <span style={styles.updatedTime}> · 最近更新 {lastUpdated.toLocaleTimeString('zh-CN')} · 每 30 秒自动刷新</span>}
          </p>
        </div>
        <button style={styles.refreshButton} onClick={loadAll}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          刷新
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.summaryGrid}>
        <SummaryCard label="总用户数" value={summary.totalUsers} color="#005FB8" icon={userIcon} />
        <SummaryCard label="总设备数" value={summary.totalDevices} color="#107C10" icon={deviceIcon} />
        <SummaryCard label="总规则数" value={summary.totalRules} color="#8B5CF6" icon={ruleIcon} />
        <SummaryCard label="启用规则" value={summary.activeRules} color="#FF8C00" icon={activeIcon} />
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeaderRow}>
          <h3 style={styles.cardTitle}>30 天活动趋势</h3>
          <span style={styles.cardHint}>每日操作次数</span>
        </div>
        {timeline.length === 0 ? (
          <div style={styles.emptyInline}>暂无活动数据</div>
        ) : (
          <div style={styles.timelineChart}>
            {timeline.map((item) => {
              const heightPct = maxTimeline > 0 ? Math.max((item.count / maxTimeline) * 100, 2) : 2;
              return (
                <div key={item.date} style={styles.barWrap} title={`${item.date}: ${item.count} 次`}>
                  <div style={styles.barTrack}>
                    <div
                      style={{
                        ...styles.bar,
                        height: `${heightPct}%`,
                        background: item.count > 0 ? '#005FB8' : 'rgba(0, 0, 0, 0.08)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={styles.timelineAxis}>
          <span style={styles.axisLabel}>{timeline[0]?.date.slice(5) ?? ''}</span>
          <span style={styles.axisLabel}>{timeline[Math.floor(timeline.length / 2)]?.date.slice(5) ?? ''}</span>
          <span style={styles.axisLabel}>{timeline[timeline.length - 1]?.date.slice(5) ?? ''}</span>
        </div>
      </div>

      <div style={styles.tablesGrid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>设备使用 Top 10</h3>
          {topDevices.length === 0 ? (
            <div style={styles.emptyInline}>暂无设备使用数据</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>排名</th>
                    <th style={styles.th}>设备</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>操作次数</th>
                  </tr>
                </thead>
                <tbody>
                  {topDevices.map((item, idx) => (
                    <tr key={item.deviceId} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={styles.rankBadge}>{idx + 1}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.cellMain}>{deviceNameMap.get(item.deviceId) || '未知设备'}</div>
                        <div style={styles.cellSub}>{item.deviceId.slice(0, 12)}</div>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <span style={styles.countBadge}>{item.count}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>用户活动 Top 10</h3>
          {topUsers.length === 0 ? (
            <div style={styles.emptyInline}>暂无用户活动数据</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>排名</th>
                    <th style={styles.th}>用户</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>操作次数</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map((item, idx) => (
                    <tr key={item.userId} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={styles.rankBadge}>{idx + 1}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.cellMain}>用户 {item.userId.slice(0, 8)}</div>
                        <div style={styles.cellSub}>{item.userId.slice(0, 16)}</div>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <span style={styles.countBadge}>{item.count}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div style={styles.summaryCard}>
      <div style={{ ...styles.summaryIcon, background: `${color}14`, color }}>{icon}</div>
      <div>
        <div style={styles.summaryValue}>{value}</div>
        <div style={styles.summaryLabel}>{label}</div>
      </div>
    </div>
  );
}

const userIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const deviceIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);
const ruleIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const activeIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

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
  updatedTime: {
    color: '#8A8A8A',
  },
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: '1px solid rgba(0, 95, 184, 0.15)',
    color: '#005FB8',
    cursor: 'pointer',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
  },
  errorBox: {
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
    border: '1px solid rgba(196, 43, 28, 0.15)',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '14px',
    marginBottom: '16px',
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '18px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
  },
  summaryIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1A1A1A',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#8A8A8A',
    marginTop: '2px',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '18px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    marginBottom: '16px',
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: '0 0 14px 0',
    letterSpacing: '-0.01em',
  },
  cardHint: {
    fontSize: '12px',
    color: '#8A8A8A',
  },
  timelineChart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '3px',
    height: '160px',
    padding: '0 2px',
  },
  barWrap: {
    flex: 1,
    height: '100%',
    display: 'flex',
    alignItems: 'flex-end',
    minWidth: 0,
  },
  barTrack: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: '3px 3px 0 0',
    minHeight: '2px',
    transition: 'height 0.3s ease',
  },
  timelineAxis: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
    padding: '0 2px',
  },
  axisLabel: {
    fontSize: '11px',
    color: '#8A8A8A',
  },
  tablesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#8A8A8A',
    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
  },
  tr: {
    borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
  },
  td: {
    padding: '10px',
    color: '#1A1A1A',
    verticalAlign: 'middle',
  },
  rankBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
    fontSize: '11px',
    fontWeight: 700,
  },
  cellMain: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  cellSub: {
    fontSize: '11px',
    color: '#8A8A8A',
    marginTop: '2px',
  },
  countBadge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '999px',
    background: 'rgba(16, 124, 16, 0.1)',
    color: '#107C10',
    fontSize: '12px',
    fontWeight: 700,
  },
  emptyInline: {
    padding: '24px',
    textAlign: 'center',
    color: '#8A8A8A',
    fontSize: '13px',
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
};
