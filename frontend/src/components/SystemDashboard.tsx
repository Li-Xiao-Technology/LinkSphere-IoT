import { useState, useEffect, useCallback } from 'react';
import {
  SystemStatus,
  DeviceSummary,
  DatabaseStatus,
  getSystemStatus,
  getDeviceSummary,
  getRecentSystemNotifications,
  getDatabaseStatus,
} from '../api';
import { AppNotification } from '../types';

const REFRESH_INTERVAL = 10000;

const NOTIFICATION_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  device_offline: { label: '设备离线', color: '#C42B1C', bg: 'rgba(196, 43, 28, 0.1)' },
  device_online: { label: '设备上线', color: '#107C10', bg: 'rgba(16, 124, 16, 0.1)' },
  warning: { label: '警告', color: '#D83B01', bg: 'rgba(216, 59, 1, 0.1)' },
  info: { label: '信息', color: '#005FB8', bg: 'rgba(0, 95, 184, 0.1)' },
  rule_triggered: { label: '规则触发', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' },
  firmware_update: { label: '固件更新', color: '#038387', bg: 'rgba(3, 131, 135, 0.1)' },
  schedule_executed: { label: '定时执行', color: '#5B5B5B', bg: 'rgba(91, 91, 91, 0.1)' },
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function formatBytes(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export function SystemDashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [deviceSummary, setDeviceSummary] = useState<DeviceSummary | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [s, ds, ns, dbs] = await Promise.all([
        getSystemStatus(),
        getDeviceSummary(),
        getRecentSystemNotifications(),
        getDatabaseStatus(),
      ]);
      setStatus(s);
      setDeviceSummary(ds);
      setNotifications(ns);
      setDbStatus(dbs);
      setLastRefresh(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载系统状态失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [loadAll]);

  const onlineCount = deviceSummary
    ? deviceSummary.byStatus.find((s) => s.status === 'online')?.count ?? 0
    : 0;
  const totalDevices = deviceSummary?.total ?? 0;
  const onlinePercent = totalDevices > 0 ? Math.round((onlineCount / totalDevices) * 100) : 0;

  const rssMb = status ? formatBytes(status.memory.rss) : 0;
  const heapUsedMb = status ? formatBytes(status.memory.heapUsed) : 0;
  const heapTotalMb = status ? formatBytes(status.memory.heapTotal) : 0;
  const heapPercent = heapTotalMb > 0 ? Math.round((heapUsedMb / heapTotalMb) * 100) : 0;

  const dbOk = dbStatus?.status === 'ok';
  const recentNotifications = notifications.slice(0, 5);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>系统状态</h2>
          <p style={styles.subtitle}>
            实时监控系统运行状态
            {lastRefresh && <span style={styles.refreshTime}> · 上次刷新 {formatTime(lastRefresh.toISOString())}</span>}
          </p>
        </div>
        <button style={styles.refreshButton} onClick={loadAll} disabled={loading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={loading ? { animation: 'spin 0.8s linear infinite' } : undefined}>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span>刷新</span>
        </button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {loading && !status ? (
        <div style={styles.loadingState}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <div style={styles.loadingText}>加载中...</div>
        </div>
      ) : (
        <>
          <div style={styles.cardGrid}>
            {/* 运行时间 */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={{ ...styles.cardIcon, background: 'rgba(0, 95, 184, 0.08)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span style={styles.cardLabel}>系统运行时间</span>
              </div>
              <div style={styles.cardValue}>{status ? formatUptime(status.uptime) : '-'}</div>
              <div style={styles.cardMeta}>
                Node {status?.nodeVersion} · {status?.platform} {status?.arch}
              </div>
            </div>

            {/* 内存使用 */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={{ ...styles.cardIcon, background: 'rgba(139, 92, 246, 0.08)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="6" rx="1" />
                    <rect x="2" y="15" width="20" height="6" rx="1" />
                    <line x1="6" y1="6" x2="6.01" y2="6" />
                    <line x1="6" y1="18" x2="6.01" y2="18" />
                  </svg>
                </div>
                <span style={styles.cardLabel}>内存使用 (RSS)</span>
              </div>
              <div style={styles.cardValue}>{rssMb} MB</div>
              <div style={styles.progressWrap}>
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${Math.min(heapPercent, 100)}%`, background: '#8B5CF6' }} />
                </div>
                <span style={styles.progressLabel}>
                  堆 {heapUsedMb} / {heapTotalMb} MB ({heapPercent}%)
                </span>
              </div>
            </div>

            {/* 设备状态 */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={{ ...styles.cardIcon, background: 'rgba(16, 124, 16, 0.08)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#107C10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <span style={styles.cardLabel}>设备在线状态</span>
              </div>
              <div style={styles.cardValue}>
                {onlineCount} <span style={styles.cardValueUnit}>/ {totalDevices}</span>
              </div>
              <div style={styles.progressWrap}>
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${onlinePercent}%`, background: '#107C10' }} />
                </div>
                <span style={styles.progressLabel}>在线率 {onlinePercent}%</span>
              </div>
            </div>

            {/* 数据库状态 */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={{ ...styles.cardIcon, background: dbOk ? 'rgba(16, 124, 16, 0.08)' : 'rgba(196, 43, 28, 0.08)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dbOk ? '#107C10' : '#C42B1C'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                </div>
                <span style={styles.cardLabel}>数据库连接</span>
              </div>
              <div style={styles.dbStatusRow}>
                <span style={{ ...styles.dbBadge, ...(dbOk ? styles.dbBadgeOk : styles.dbBadgeError) }}>
                  {dbOk ? '已连接' : '异常'}
                </span>
              </div>
              {dbStatus?.error && (
                <div style={styles.dbErrorText}>{dbStatus.error}</div>
              )}
            </div>
          </div>

          {/* 最近通知 */}
          <div style={styles.notifCard}>
            <div style={styles.notifHeader}>
              <h3 style={styles.notifTitle}>最近通知</h3>
              <span style={styles.notifCount}>{notifications.length} 条未读</span>
            </div>
            {recentNotifications.length === 0 ? (
              <div style={styles.notifEmpty}>暂无未读通知</div>
            ) : (
              <div style={styles.notifList}>
                {recentNotifications.map((n) => {
                  const meta = NOTIFICATION_TYPE_LABELS[n.type] || { label: n.type, color: '#5B5B5B', bg: 'rgba(91, 91, 91, 0.1)' };
                  return (
                    <div key={n.id} style={styles.notifItem}>
                      <span style={{ ...styles.notifTypeBadge, color: meta.color, background: meta.bg }}>
                        {meta.label}
                      </span>
                      <div style={styles.notifContent}>
                        <div style={styles.notifItemTitle}>{n.title}</div>
                        {n.body && <div style={styles.notifBody}>{n.body}</div>}
                      </div>
                      <span style={styles.notifTime}>
                        {n.createdAt ? formatTime(n.createdAt) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
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
  refreshTime: {
    color: '#8A8A8A',
  },
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    color: '#005FB8',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
  },
  errorBanner: {
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
    border: '1px solid rgba(196, 43, 28, 0.15)',
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
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '14px',
    marginBottom: '16px',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cardIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#5B5B5B',
  },
  cardValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1A1A1A',
    letterSpacing: '-0.02em',
  },
  cardValueUnit: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#8A8A8A',
  },
  cardMeta: {
    fontSize: '11px',
    color: '#8A8A8A',
  },
  progressWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  progressTrack: {
    width: '100%',
    height: '6px',
    background: 'rgba(0, 0, 0, 0.06)',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.3s ease',
  },
  progressLabel: {
    fontSize: '11px',
    color: '#8A8A8A',
  },
  dbStatusRow: {
    display: 'flex',
    alignItems: 'center',
  },
  dbBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 600,
  },
  dbBadgeOk: {
    background: 'rgba(16, 124, 16, 0.1)',
    color: '#107C10',
  },
  dbBadgeError: {
    background: 'rgba(196, 43, 28, 0.1)',
    color: '#C42B1C',
  },
  dbErrorText: {
    fontSize: '11px',
    color: '#C42B1C',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  notifCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '16px',
  },
  notifHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  notifTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  notifCount: {
    fontSize: '12px',
    color: '#8A8A8A',
    background: 'rgba(0, 0, 0, 0.04)',
    padding: '2px 10px',
    borderRadius: '999px',
  },
  notifEmpty: {
    padding: '24px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#8A8A8A',
  },
  notifList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  notifItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.04)',
  },
  notifTypeBadge: {
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  notifContent: {
    flex: 1,
    minWidth: 0,
  },
  notifItemTitle: {
    fontSize: '13px',
    color: '#1A1A1A',
    fontWeight: 500,
  },
  notifBody: {
    fontSize: '12px',
    color: '#8A8A8A',
    marginTop: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  notifTime: {
    fontSize: '11px',
    color: '#8A8A8A',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};
