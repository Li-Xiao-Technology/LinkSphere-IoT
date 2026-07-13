import { useState, useEffect, useCallback } from 'react';
import { getRuleExecutionHistory, RuleExecutionHistoryItem } from '../api';

interface RuleExecutionHistoryProps {
  ruleId?: string;
  ruleName?: string;
}

export function RuleExecutionHistory({ ruleId, ruleName }: RuleExecutionHistoryProps) {
  const [history, setHistory] = useState<RuleExecutionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');

  const loadHistory = useCallback(async () => {
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
      const data = await getRuleExecutionHistory({
        ruleId: ruleId || undefined,
        startDate,
        endDate: now.toISOString(),
        limit: 100,
      });
      setHistory(data);
    } catch (err) {
      console.error('Failed to load rule execution history:', err);
    } finally {
      setLoading(false);
    }
  }, [ruleId, timeRange]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const statusColors: { [key: string]: { bg: string; color: string; label: string; icon: string } } = {
    success: {
      bg: 'rgba(16, 124, 16, 0.1)',
      color: '#107C10',
      label: '成功',
      icon: '<polyline points="20 6 9 17 4 12"/>',
    },
    failed: {
      bg: 'rgba(196, 43, 28, 0.1)',
      color: '#C42B1C',
      label: '失败',
      icon: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    },
    partial: {
      bg: 'rgba(202, 80, 16, 0.1)',
      color: '#CA5010',
      label: '部分成功',
      icon: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>',
    },
  };

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  const successCount = history.filter((h) => h.status === 'success').length;
  const failedCount = history.filter((h) => h.status === 'failed').length;
  const partialCount = history.filter((h) => h.status === 'partial').length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>规则执行历史</h2>
          <p style={styles.subtitle}>{ruleName || '所有规则'}</p>
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

      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <div style={{ ...styles.statDot, background: '#107C10' }} />
          <div style={styles.statContent}>
            <div style={styles.statValue}>{successCount}</div>
            <div style={styles.statLabel}>成功</div>
          </div>
        </div>
        <div style={styles.statItem}>
          <div style={{ ...styles.statDot, background: '#CA5010' }} />
          <div style={styles.statContent}>
            <div style={styles.statValue}>{partialCount}</div>
            <div style={styles.statLabel}>部分成功</div>
          </div>
        </div>
        <div style={styles.statItem}>
          <div style={{ ...styles.statDot, background: '#C42B1C' }} />
          <div style={styles.statContent}>
            <div style={styles.statValue}>{failedCount}</div>
            <div style={styles.statLabel}>失败</div>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <h3 style={styles.cardTitle}>执行记录</h3>
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
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <div style={styles.emptyText}>暂无规则执行记录</div>
            </div>
          ) : (
            history.map((item) => {
              const statusConfig = statusColors[item.status] || statusColors.success;
              return (
                <div key={item.id} style={styles.historyItem}>
                  <div
                    style={{
                      ...styles.statusIcon,
                      background: statusConfig.bg,
                      color: statusConfig.color,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: statusConfig.icon }} />
                  </div>
                  <div style={styles.historyInfo}>
                    <div style={styles.historyHeader}>
                      <span style={{ ...styles.statusBadge, background: statusConfig.bg, color: statusConfig.color }}>
                        {statusConfig.label}
                      </span>
                      <span style={styles.historyTime}>{formatTime(item.executedAt)}</span>
                    </div>
                    <div style={styles.ruleName}>{item.rule?.name || item.ruleId}</div>
                    {item.message && <div style={styles.historyMessage}>{item.message}</div>}
                  </div>
                </div>
              );
            })
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
  statsBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '8px',
    flex: 1,
  },
  statDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1A1A1A',
    letterSpacing: '-0.02em',
  },
  statLabel: {
    fontSize: '11px',
    color: '#8A8A8A',
  },
  card: {
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
  historyList: {
    maxHeight: '500px',
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
  statusIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  ruleName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: '2px',
  },
  historyMessage: {
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
