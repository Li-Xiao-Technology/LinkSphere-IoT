import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface StateHistory {
  id: string;
  status: string;
  state: string | null;
  changedAt: string;
}

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
}

export function DeviceStateHistory() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [history, setHistory] = useState<StateHistory[]>([]);
  const [device, setDevice] = useState<Device | null>(null);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [timeRange, setTimeRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (deviceId) {
      loadHistory();
      loadDevice();
    }
  }, [deviceId]);

  async function loadHistory() {
    setLoading(true);
    try {
      let url = `/api/devices/${deviceId}/state-history`;
      const params = new URLSearchParams();
      if (timeRange.start) params.append('start', timeRange.start);
      if (timeRange.end) params.append('end', timeRange.end);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setHistory(data);
    } catch {
      console.error('Failed to load state history');
    } finally {
      setLoading(false);
    }
  }

  async function loadDevice() {
    try {
      const response = await fetch(`/api/devices/${deviceId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setDevice(data);
    } catch {
      console.error('Failed to load device');
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#10B981';
      case 'offline': return '#EF4444';
      case 'error': return '#F59E0B';
      case 'standby': return '#6366F1';
      default: return '#6B7280';
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>设备状态历史</h1>
          <p style={styles.subtitle}>查看设备状态变化记录和历史数据</p>
        </div>
      </div>

      {device && (
        <div style={styles.deviceInfoCard}>
          <div style={styles.deviceIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div style={styles.deviceInfo}>
            <h3 style={styles.deviceName}>{device.name}</h3>
            <span style={{ ...styles.deviceStatus, color: getStatusColor(device.status) }}>
              当前状态: {device.status}
            </span>
          </div>
        </div>
      )}

      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>开始时间</label>
          <input
            type="datetime-local"
            value={timeRange.start}
            onChange={(e) => setTimeRange({ ...timeRange, start: e.target.value })}
            style={styles.filterInput}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>结束时间</label>
          <input
            type="datetime-local"
            value={timeRange.end}
            onChange={(e) => setTimeRange({ ...timeRange, end: e.target.value })}
            style={styles.filterInput}
          />
        </div>
        <button style={styles.filterBtn} onClick={loadHistory}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          筛选
        </button>
        <button style={styles.clearBtn} onClick={() => { setTimeRange({ start: '', end: '' }); loadHistory(); }}>
          清除筛选
        </button>
      </div>

      <div style={styles.historyTable}>
        <div style={styles.tableHeader}>
          <div style={styles.tableCell}>时间</div>
          <div style={styles.tableCell}>状态</div>
          <div style={styles.tableCell}>详细信息</div>
        </div>

        {loading ? (
          <div style={styles.loadingState}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span>加载中...</span>
          </div>
        ) : history.length === 0 ? (
          <div style={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
              <path d="M12 8v4l3 3" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <p style={styles.emptyText}>暂无状态历史记录</p>
          </div>
        ) : (
          <div style={styles.tableBody}>
            {history.map(item => (
              <div key={item.id} style={styles.tableRow}>
                <div style={styles.tableCell}>
                  <span style={styles.historyTime}>{formatTime(item.changedAt)}</span>
                </div>
                <div style={styles.tableCell}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ ...styles.statusDot, background: getStatusColor(item.status) }} />
                    <span style={styles.historyStatus}>{item.status}</span>
                  </div>
                </div>
                <div style={styles.tableCell}>
                  <span style={styles.historyState}>
                    {item.state ? JSON.stringify(JSON.parse(item.state), null, 2).slice(0, 50) : '无详细信息'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1000px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '24px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#1F2937',
    margin: 0
  },
  subtitle: {
    fontSize: '14px',
    color: '#6B7280',
    marginTop: '4px',
    margin: 0
  },
  deviceInfoCard: {
    display: 'flex',
    alignItems: 'center',
    background: 'white',
    borderRadius: '12px',
    padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    marginBottom: '24px'
  },
  deviceIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: '#EEF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deviceInfo: {
    marginLeft: '16px'
  },
  deviceName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1F2937',
    margin: 0
  },
  deviceStatus: {
    fontSize: '14px',
    fontWeight: 500
  },
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  filterLabel: {
    fontSize: '12px',
    color: '#6B7280',
    marginBottom: '4px'
  },
  filterInput: {
    padding: '8px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none'
  },
  filterBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer'
  },
  clearBtn: {
    padding: '8px 16px',
    background: '#F3F4F6',
    border: 'none',
    borderRadius: '6px',
    color: '#374151',
    fontSize: '14px',
    cursor: 'pointer'
  },
  historyTable: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    overflow: 'hidden'
  },
  tableHeader: {
    display: 'flex',
    background: '#F9FAFB',
    padding: '16px',
    borderBottom: '1px solid #E5E7EB'
  },
  tableCell: {
    flex: 1,
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151'
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px',
    color: '#6B7280'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px',
    color: '#6B7280'
  },
  emptyText: {
    fontSize: '14px',
    marginTop: '12px'
  },
  tableBody: {
    maxHeight: '500px',
    overflowY: 'auto'
  },
  tableRow: {
    display: 'flex',
    padding: '16px',
    borderBottom: '1px solid #E5E7EB'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0
  },
  historyTime: {
    fontSize: '14px',
    color: '#374151'
  },
  historyStatus: {
    fontSize: '14px',
    color: '#1F2937',
    fontWeight: 500
  },
  historyState: {
    fontSize: '13px',
    color: '#6B7280',
    fontStyle: 'monospace'
  }
};
