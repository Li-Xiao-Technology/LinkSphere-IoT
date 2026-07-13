import { useState, useEffect, useCallback } from 'react';
import { AuditLog, getAuditLogs, exportAuditLogsCSV } from '../api';

const RESOURCE_OPTIONS = [
  { value: '', label: '全部资源' },
  { value: 'device', label: '设备 (device)' },
  { value: 'mqtt', label: 'MQTT' },
  { value: 'modbus', label: 'Modbus' },
  { value: 'yeelight', label: 'Yeelight' },
  { value: 'yeelightBle', label: 'Yeelight BLE' },
  { value: 'scene', label: '场景 (scene)' },
  { value: 'rule', label: '规则 (rule)' },
  { value: 'schedule', label: '定时 (schedule)' },
  { value: 'household', label: '家庭 (household)' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'threshold', label: '阈值 (threshold)' },
  { value: 'notification', label: '通知 (notification)' },
  { value: 'room', label: '房间 (room)' },
  { value: 'auth', label: '认证 (auth)' },
];

const PAGE_SIZE = 20;

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState({
    resource: '',
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadLogs = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await getAuditLogs({
        page: targetPage,
        pageSize: PAGE_SIZE,
        userId: filters.userId || undefined,
        resource: filters.resource || undefined,
        action: filters.action || undefined,
        startDate: filters.startDate ? new Date(filters.startDate).toISOString() : undefined,
        endDate: filters.endDate ? new Date(filters.endDate + 'T23:59:59').toISOString() : undefined,
      });
      setLogs(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载审计日志失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadLogs(1);
  }, [loadLogs]);

  function handleSearch() {
    loadLogs(1);
  }

  function handleReset() {
    const reset = { resource: '', action: '', userId: '', startDate: '', endDate: '' };
    setFilters(reset);
  }

  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      await exportAuditLogsCSV({
        userId: filters.userId || undefined,
        resource: filters.resource || undefined,
        action: filters.action || undefined,
        startDate: filters.startDate ? new Date(filters.startDate).toISOString() : undefined,
        endDate: filters.endDate ? new Date(filters.endDate + 'T23:59:59').toISOString() : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '导出失败';
      setError(msg);
    } finally {
      setExporting(false);
    }
  }

  function handlePrev() {
    if (page > 1) loadLogs(page - 1);
  }

  function handleNext() {
    if (page < totalPages) loadLogs(page + 1);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>审计日志</h2>
          <p style={styles.subtitle}>查看系统操作记录，追踪用户行为与资源变更</p>
        </div>
        <button
          style={{ ...styles.exportButton, ...(exporting ? styles.exportButtonDisabled : {}) }}
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          <span>导出 CSV</span>
        </button>
      </div>

      <div style={styles.filterCard}>
        <div style={styles.filterRow}>
          <div style={styles.filterItem}>
            <label style={styles.filterLabel}>资源类型</label>
            <select
              value={filters.resource}
              onChange={(e) => setFilters((prev) => ({ ...prev, resource: e.target.value }))}
              style={styles.filterSelect}
            >
              {RESOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={styles.filterItem}>
            <label style={styles.filterLabel}>操作</label>
            <input
              type="text"
              value={filters.action}
              onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
              style={styles.filterInput}
              placeholder="例如 device.delete"
            />
          </div>
          <div style={styles.filterItem}>
            <label style={styles.filterLabel}>用户ID</label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
              style={styles.filterInput}
              placeholder="可选"
            />
          </div>
          <div style={styles.filterItem}>
            <label style={styles.filterLabel}>开始日期</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              style={styles.filterInput}
            />
          </div>
          <div style={styles.filterItem}>
            <label style={styles.filterLabel}>结束日期</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              style={styles.filterInput}
            />
          </div>
          <div style={styles.filterButtons}>
            <button style={styles.searchButton} onClick={handleSearch}>查询</button>
            <button style={styles.resetButton} onClick={handleReset}>重置</button>
          </div>
        </div>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.loadingState}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <div style={styles.loadingText}>加载中...</div>
          </div>
        ) : logs.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyTitle}>暂无审计日志</div>
            <div style={styles.emptyDesc}>调整筛选条件后重新查询</div>
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>时间</th>
                  <th style={styles.th}>用户</th>
                  <th style={styles.th}>操作</th>
                  <th style={styles.th}>资源</th>
                  <th style={styles.th}>资源ID</th>
                  <th style={styles.th}>IP</th>
                  <th style={styles.th}>状态</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isSuccess = log.status === 'success';
                  return (
                    <tr key={log.id} style={styles.tr}>
                      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{formatTime(log.createdAt)}</td>
                      <td style={styles.td}>{log.userId || '-'}</td>
                      <td style={styles.td}>
                        <code style={styles.actionCode}>{log.action}</code>
                      </td>
                      <td style={styles.td}>{log.resource}</td>
                      <td style={{ ...styles.td, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.resourceId || ''}>
                        {log.resourceId || '-'}
                      </td>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '12px' }}>{log.ip || '-'}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.statusBadge, ...(isSuccess ? styles.statusSuccess : styles.statusError) }}>
                          {isSuccess ? '成功' : '失败'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && logs.length > 0 && (
          <div style={styles.pagination}>
            <span style={styles.pageInfo}>
              共 {total} 条，第 {page} / {totalPages} 页
            </span>
            <div style={styles.pageButtons}>
              <button
                style={{ ...styles.pageButton, ...(page <= 1 ? styles.pageButtonDisabled : {}) }}
                onClick={handlePrev}
                disabled={page <= 1}
              >
                上一页
              </button>
              <button
                style={{ ...styles.pageButton, ...(page >= totalPages ? styles.pageButtonDisabled : {}) }}
                onClick={handleNext}
                disabled={page >= totalPages}
              >
                下一页
              </button>
            </div>
          </div>
        )}
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
  exportButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
    whiteSpace: 'nowrap',
  },
  exportButtonDisabled: {
    background: '#B0B0B0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  filterCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },
  filterRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  filterItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  filterLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#8A8A8A',
  },
  filterInput: {
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '13px',
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.6)',
    outline: 'none',
    minWidth: '140px',
  },
  filterSelect: {
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '13px',
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '160px',
  },
  filterButtons: {
    display: 'flex',
    gap: '8px',
  },
  searchButton: {
    padding: '8px 16px',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
  },
  resetButton: {
    padding: '8px 16px',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none',
    color: '#1A1A1A',
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
  tableCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '8px',
    overflow: 'hidden',
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
    padding: '10px 12px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#8A8A8A',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
  },
  td: {
    padding: '10px 12px',
    color: '#1A1A1A',
    verticalAlign: 'middle',
  },
  actionCode: {
    padding: '2px 6px',
    borderRadius: '4px',
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  statusSuccess: {
    background: 'rgba(16, 124, 16, 0.1)',
    color: '#107C10',
  },
  statusError: {
    background: 'rgba(196, 43, 28, 0.1)',
    color: '#C42B1C',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
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
    padding: '60px 24px',
  },
  emptyTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#5B5B5B',
    marginBottom: '4px',
  },
  emptyDesc: {
    fontSize: '13px',
    color: '#8A8A8A',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 12px 4px',
  },
  pageInfo: {
    fontSize: '12px',
    color: '#8A8A8A',
  },
  pageButtons: {
    display: 'flex',
    gap: '8px',
  },
  pageButton: {
    padding: '6px 14px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: 'none',
    color: '#005FB8',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
  },
  pageButtonDisabled: {
    background: 'rgba(0, 0, 0, 0.04)',
    color: '#B0B0B0',
    cursor: 'not-allowed',
  },
};
