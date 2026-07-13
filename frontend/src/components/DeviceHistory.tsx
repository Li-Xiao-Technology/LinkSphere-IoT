import { useState, useEffect } from 'react';
import { getDeviceStateHistory, DeviceStateHistoryItem } from '../api';

interface DeviceHistoryProps {
  deviceId: string;
  deviceName: string;
}

export function DeviceHistory({ deviceId, deviceName }: DeviceHistoryProps) {
  const [history, setHistory] = useState<DeviceStateHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    loadHistory();
  }, [deviceId, timeRange]);

  async function loadHistory() {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: string;
      switch (timeRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          break;
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          startDate = weekAgo.toISOString();
          break;
        case 'month':
          const monthAgo = new Date(now);
          monthAgo.setDate(monthAgo.getDate() - 30);
          startDate = monthAgo.toISOString();
          break;
      }
      const data = await getDeviceStateHistory(deviceId, {
        startDate,
        endDate: now.toISOString(),
        limit: 200,
      });
      setHistory(data);
    } catch (err) {
      console.error('Failed to load device state history:', err);
    } finally {
      setLoading(false);
    }
  }

  const statusColors: { [key: string]: string } = {
    online: '#107C10',
    offline: '#C42B1C',
    standby: '#CA5010',
    error: '#C42B1C',
  };

  const statusLabels: { [key: string]: string } = {
    online: '在线',
    offline: '离线',
    standby: '待机',
    error: '错误',
  };

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDateTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function getStateText(state: any): string {
    if (!state) return '无状态数据';
    const parts: string[] = [];
    if (state.power !== undefined) parts.push(`电源: ${state.power ? '开' : '关'}`);
    if (state.brightness !== undefined) parts.push(`亮度: ${state.brightness}%`);
    if (state.temperature !== undefined) parts.push(`温度: ${state.temperature}°C`);
    if (state.humidity !== undefined) parts.push(`湿度: ${state.humidity}%`);
    if (state.speed !== undefined) parts.push(`风速: ${state.speed}`);
    if (state.mode !== undefined) parts.push(`模式: ${state.mode}`);
    if (state.value !== undefined) parts.push(`值: ${state.value}`);
    if (parts.length === 0) return JSON.stringify(state);
    return parts.join(', ');
  }

  const timelineData = [...history].reverse();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>设备状态历史</h2>
          <p style={styles.subtitle}>{deviceName}</p>
        </div>
        <div style={styles.timeRangeSelector}>
          {(['today', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              style={{
                ...styles.timeRangeButton,
                ...(timeRange === range ? styles.timeRangeButtonActive : {}),
              }}
              onClick={() => setTimeRange(range)}
            >
              {range === 'today' ? '今天' : range === 'week' ? '近7天' : '近30天'}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.chartCard}>
        <div style={styles.cardHeader}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M8 21V12M12 21V8M16 21V15" />
          </svg>
          <h3 style={styles.cardTitle}>状态变化趋势</h3>
        </div>
        <div style={styles.chartContainer}>
          {loading ? (
            <div style={styles.loadingState}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
          ) : timelineData.length === 0 ? (
            <div style={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div style={styles.emptyText}>暂无状态变化记录</div>
            </div>
          ) : (
            <div style={styles.timelineChart}>
              <div style={styles.timelineYAxis}>
                <span style={styles.timelineLabel}>在线</span>
                <span style={styles.timelineLabel}>离线</span>
              </div>
              <div style={styles.timelineContent}>
                <div style={styles.timelineBars}>
                  {timelineData.map((item, index) => (
                    <div
                      key={item.id}
                      style={{
                        ...styles.timelineBar,
                        background: statusColors[item.status] || '#5B5B5B',
                        opacity: 0.7 + (index % 5) * 0.05,
                      }}
                      title={`${statusLabels[item.status]} - ${formatDateTime(item.changedAt)}`}
                    />
                  ))}
                </div>
                <div style={styles.timelineLabels}>
                  {timelineData.length > 0 && (
                    <>
                      <span>{formatTime(timelineData[0].changedAt)}</span>
                      {timelineData.length > 10 && (
                        <span>{formatTime(timelineData[Math.floor(timelineData.length / 2)].changedAt)}</span>
                      )}
                      <span>{formatTime(timelineData[timelineData.length - 1].changedAt)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={styles.listCard}>
        <div style={styles.cardHeader}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <h3 style={styles.cardTitle}>状态变更记录</h3>
          <span style={styles.recordCount}>{history.length} 条记录</span>
        </div>
        <div style={styles.historyList}>
          {loading ? (
            <div style={styles.loadingState}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
          ) : history.length === 0 ? (
            <div style={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <div style={styles.emptyText}>暂无状态变更记录</div>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} style={styles.historyItem}>
                <div style={{ ...styles.statusDot, background: statusColors[item.status] || '#5B5B5B' }} />
                <div style={styles.historyInfo}>
                  <div style={styles.historyHeader}>
                    <span style={{ ...styles.statusBadge, background: `${statusColors[item.status] || '#5B5B5B'}20`, color: statusColors[item.status] || '#5B5B5B' }}>
                      {statusLabels[item.status] || item.status}
                    </span>
                    <span style={styles.historyTime}>{formatDateTime(item.changedAt)}</span>
                  </div>
                  <div style={styles.historyState}>{getStateText(item.state)}</div>
                </div>
              </div>
            ))
          )}
        </div>
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
    marginBottom: '24px',
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
    margin: '4px 0 0 0',
  },
  timeRangeSelector: {
    display: 'flex',
    gap: '4px',
    background: 'rgba(0, 0, 0, 0.04)',
    padding: '3px',
    borderRadius: '6px',
  },
  timeRangeButton: {
    padding: '7px 14px',
    background: 'transparent',
    border: 'none',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
  },
  timeRangeButtonActive: {
    background: '#FFFFFF',
    color: '#005FB8',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
  },
  chartCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  },
  listCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '20px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  recordCount: {
    marginLeft: 'auto',
    fontSize: '12px',
    color: '#8A8A8A',
    background: 'rgba(0, 0, 0, 0.04)',
    padding: '3px 8px',
    borderRadius: '4px',
  },
  chartContainer: {
    height: '160px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineChart: {
    display: 'flex',
    gap: '12px',
    width: '100%',
    height: '100%',
  },
  timelineYAxis: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
    padding: '8px 0',
  },
  timelineLabel: {
    fontSize: '11px',
    color: '#8A8A8A',
  },
  timelineContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  timelineBars: {
    flex: 1,
    display: 'flex',
    gap: '2px',
    alignItems: 'flex-end',
    paddingBottom: '8px',
  },
  timelineBar: {
    flex: 1,
    height: '30%',
    borderRadius: '2px',
    minHeight: '8px',
    transition: 'height 0.3s',
  },
  timelineLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#8A8A8A',
  },
  historyList: {
    maxHeight: '400px',
    overflowY: 'auto',
  },
  historyItem: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    marginBottom: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginTop: '6px',
    flexShrink: 0,
  },
  historyInfo: {
    flex: 1,
    minWidth: 0,
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  statusBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '4px',
  },
  historyTime: {
    fontSize: '11px',
    color: '#8A8A8A',
  },
  historyState: {
    fontSize: '12px',
    color: '#5B5B5B',
    wordBreak: 'break-all',
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    gap: '12px',
  },
  emptyText: {
    fontSize: '13px',
    color: '#8A8A8A',
  },
};
