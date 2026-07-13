import { useState, useEffect, useCallback } from 'react';

interface Dashboard {
  id: string;
  name: string;
  isDefault: boolean;
  layout: any[];
  widgets: Widget[];
  createdAt: string;
  updatedAt: string;
}

interface Widget {
  id: string;
  type: string;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
}

export function DashboardPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [selectedWidgetType, setSelectedWidgetType] = useState('');
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  useEffect(() => {
    loadDashboards();
    loadDevices();
    loadNotifications();
  }, []);

  async function loadDashboards() {
    try {
      const response = await fetch('/api/dashboards', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setDashboards(data);
      const defaultDashboard = data.find((d: Dashboard) => d.isDefault) || data[0];
      if (defaultDashboard) {
        setCurrentDashboard(defaultDashboard);
        setWidgets(defaultDashboard.widgets);
      }
    } catch {
      console.error('Failed to load dashboards');
    }
  }

  async function loadDevices() {
    try {
      const response = await fetch('/api/devices', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setDevices(data);
    } catch {
      console.error('Failed to load devices');
    }
  }

  async function loadNotifications() {
    try {
      const response = await fetch('/api/notifications/unread', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setNotifications(data.slice(0, 5));
    } catch {
      console.error('Failed to load notifications');
    }
  }

  async function createDashboard() {
    if (!newDashboardName.trim()) return;

    try {
      const response = await fetch('/api/dashboards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: newDashboardName })
      });
      const data = await response.json();
      setDashboards([...dashboards, data]);
      setCurrentDashboard(data);
      setWidgets([]);
      setNewDashboardName('');
      setShowDashboardModal(false);
    } catch {
      console.error('Failed to create dashboard');
    }
  }

  async function addWidget() {
    if (!selectedWidgetType || !currentDashboard) return;

    try {
      const response = await fetch(`/api/dashboards/${currentDashboard.id}/widgets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          type: selectedWidgetType,
          config: {},
          position: {
            x: 0,
            y: widgets.length,
            w: selectedWidgetType === 'energy-summary' ? 2 : 1,
            h: 1
          }
        })
      });
      const data = await response.json();
      setWidgets([...widgets, data]);
      setSelectedWidgetType('');
      setShowAddWidgetModal(false);
    } catch {
      console.error('Failed to add widget');
    }
  }

  async function deleteWidget(widgetId: string) {
    if (!currentDashboard) return;

    try {
      await fetch(`/api/dashboards/${currentDashboard.id}/widgets/${widgetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setWidgets(widgets.filter(w => w.id !== widgetId));
    } catch {
      console.error('Failed to delete widget');
    }
  }

  async function setDefaultDashboard(dashboardId: string) {
    try {
      await fetch(`/api/dashboards/${dashboardId}/set-default`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      loadDashboards();
    } catch {
      console.error('Failed to set default dashboard');
    }
  }

  const widgetTypes = [
    { value: 'device-status', label: '设备状态', icon: 'activity' },
    { value: 'energy-summary', label: '能耗概览', icon: 'zap' },
    { value: 'notification-list', label: '通知列表', icon: 'bell' },
    { value: 'quick-actions', label: '快捷操作', icon: 'zap' },
    { value: 'recent-activity', label: '最近活动', icon: 'history' }
  ];

  const renderWidget = (widget: Widget) => {
    const config = widget.config;

    switch (widget.type) {
      case 'device-status':
        const onlineCount = devices.filter(d => d.status === 'online').length;
        return (
          <div key={widget.id} style={styles.widget}>
            <div style={styles.widgetHeader}>
              <h4 style={styles.widgetTitle}>设备状态</h4>
              <button style={styles.widgetClose} onClick={() => deleteWidget(widget.id)}>×</button>
            </div>
            <div style={styles.widgetContent}>
              <div style={styles.statusCard}>
                <div style={{ ...styles.statusDot, background: '#10B981' }} />
                <div>
                  <span style={styles.statusCount}>{onlineCount}</span>
                  <span style={styles.statusLabel}>在线</span>
                </div>
              </div>
              <div style={styles.statusCard}>
                <div style={{ ...styles.statusDot, background: '#EF4444' }} />
                <div>
                  <span style={styles.statusCount}>{devices.length - onlineCount}</span>
                  <span style={styles.statusLabel}>离线</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'energy-summary':
        return (
          <div key={widget.id} style={{ ...styles.widget, gridColumn: 'span 2' }}>
            <div style={styles.widgetHeader}>
              <h4 style={styles.widgetTitle}>能耗概览</h4>
              <button style={styles.widgetClose} onClick={() => deleteWidget(widget.id)}>×</button>
            </div>
            <div style={styles.widgetContent}>
              <div style={styles.energyCard}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                  <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <div>
                  <span style={styles.energyValue}>0.00</span>
                  <span style={styles.energyUnit}>kWh / 今日</span>
                </div>
              </div>
              <div style={styles.energyCard}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <div>
                  <span style={styles.energyValue}>0</span>
                  <span style={styles.energyUnit}>设备运行中</span>
                </div>
              </div>
              <div style={styles.energyCard}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <div>
                  <span style={styles.energyValue}>0</span>
                  <span style={styles.energyUnit}>告警</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'notification-list':
        return (
          <div key={widget.id} style={styles.widget}>
            <div style={styles.widgetHeader}>
              <h4 style={styles.widgetTitle}>最新通知</h4>
              <button style={styles.widgetClose} onClick={() => deleteWidget(widget.id)}>×</button>
            </div>
            <div style={styles.widgetContent}>
              {notifications.length === 0 ? (
                <div style={styles.emptyWidget}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span style={styles.emptyWidgetText}>暂无通知</span>
                </div>
              ) : (
                <div style={styles.notificationList}>
                  {notifications.map(n => (
                    <div key={n.id} style={styles.notificationItem}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      <span style={styles.notificationText}>{n.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'quick-actions':
        return (
          <div key={widget.id} style={styles.widget}>
            <div style={styles.widgetHeader}>
              <h4 style={styles.widgetTitle}>快捷操作</h4>
              <button style={styles.widgetClose} onClick={() => deleteWidget(widget.id)}>×</button>
            </div>
            <div style={styles.widgetContent}>
              <div style={styles.quickActions}>
                <button style={styles.quickActionBtn} onClick={() => loadDevices()}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>刷新设备</span>
                </button>
                <button style={styles.quickActionBtn}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 21h5v-5" />
                  </svg>
                  <span>发现设备</span>
                </button>
                <button style={styles.quickActionBtn}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>新建场景</span>
                </button>
              </div>
            </div>
          </div>
        );

      case 'recent-activity':
        return (
          <div key={widget.id} style={styles.widget}>
            <div style={styles.widgetHeader}>
              <h4 style={styles.widgetTitle}>最近活动</h4>
              <button style={styles.widgetClose} onClick={() => deleteWidget(widget.id)}>×</button>
            </div>
            <div style={styles.widgetContent}>
              <div style={styles.activityList}>
                <div style={styles.activityItem}>
                  <div style={{ ...styles.activityIcon, background: '#10B98120', color: '#10B981' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                  </div>
                  <div>
                    <span style={styles.activityText}>设备已上线</span>
                    <span style={styles.activityTime}>刚刚</span>
                  </div>
                </div>
                <div style={styles.activityItem}>
                  <div style={{ ...styles.activityIcon, background: '#6366F120', color: '#6366F1' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    </svg>
                  </div>
                  <div>
                    <span style={styles.activityText}>场景已激活</span>
                    <span style={styles.activityTime}>5分钟前</span>
                  </div>
                </div>
                <div style={styles.activityItem}>
                  <div style={{ ...styles.activityIcon, background: '#F59E0B20', color: '#F59E0B' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                  <div>
                    <span style={styles.activityText}>能耗异常告警</span>
                    <span style={styles.activityTime}>30分钟前</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div key={widget.id} style={styles.widget}>
            <div style={styles.widgetHeader}>
              <h4 style={styles.widgetTitle}>未知组件</h4>
              <button style={styles.widgetClose} onClick={() => deleteWidget(widget.id)}>×</button>
            </div>
            <div style={styles.widgetContent}>
              <div style={styles.emptyWidget}>
                <span style={styles.emptyWidgetText}>无法识别的组件类型</span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>仪表盘</h1>
          <p style={styles.subtitle}>自定义您的首页布局，添加设备状态、能耗概览等组件</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.addWidgetBtn} onClick={() => setShowAddWidgetModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            添加组件
          </button>
          <button style={styles.createDashboardBtn} onClick={() => setShowDashboardModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            新建仪表盘
          </button>
        </div>
      </div>

      {dashboards.length > 1 && (
        <div style={styles.dashboardTabs}>
          {dashboards.map(d => (
            <button
              key={d.id}
              style={{ ...styles.dashboardTab, background: currentDashboard?.id === d.id ? '#6366F1' : '#F3F4F6', color: currentDashboard?.id === d.id ? 'white' : '#374151' }}
              onClick={() => { setCurrentDashboard(d); setWidgets(d.widgets); }}
            >
              {d.name}
              {d.isDefault && <span style={styles.defaultBadge}>默认</span>}
            </button>
          ))}
        </div>
      )}

      <div style={styles.widgetsGrid}>
        {widgets.length === 0 ? (
          <div style={styles.emptyState}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
              <path d="M3 3h18v18H3z" />
              <path d="M9 3v18" />
              <path d="M15 3v18" />
              <path d="M3 9h18" />
              <path d="M3 15h18" />
            </svg>
            <p style={styles.emptyText}>仪表盘为空</p>
            <p style={styles.emptySubText}>点击上方按钮添加组件</p>
            <button style={styles.emptyActionBtn} onClick={() => setShowAddWidgetModal(true)}>
              添加组件
            </button>
          </div>
        ) : (
          widgets.map(widget => renderWidget(widget))
        )}
      </div>

      {showAddWidgetModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddWidgetModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>添加组件</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowAddWidgetModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.widgetTypeList}>
                {widgetTypes.map(type => (
                  <button
                    key={type.value}
                    style={{ ...styles.widgetTypeBtn, borderColor: selectedWidgetType === type.value ? '#6366F1' : '#E5E7EB', background: selectedWidgetType === type.value ? '#6366F110' : 'white' }}
                    onClick={() => setSelectedWidgetType(type.value)}
                  >
                    <span style={styles.widgetTypeLabel}>{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={() => setShowAddWidgetModal(false)}>取消</button>
              <button style={styles.modalConfirmBtn} onClick={addWidget} disabled={!selectedWidgetType}>添加</button>
            </div>
          </div>
        </div>
      )}

      {showDashboardModal && (
        <div style={styles.modalOverlay} onClick={() => setShowDashboardModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>新建仪表盘</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowDashboardModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>仪表盘名称</label>
                <input
                  type="text"
                  value={newDashboardName}
                  onChange={(e) => setNewDashboardName(e.target.value)}
                  placeholder="输入仪表盘名称"
                  style={styles.formInput}
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={() => setShowDashboardModal(false)}>取消</button>
              <button style={styles.modalConfirmBtn} onClick={createDashboard} disabled={!newDashboardName.trim()}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerActions: {
    display: 'flex',
    gap: '12px'
  },
  addWidgetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    background: '#F3F4F6',
    border: 'none',
    borderRadius: '8px',
    color: '#374151',
    fontSize: '14px',
    cursor: 'pointer'
  },
  createDashboardBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer'
  },
  dashboardTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px'
  },
  dashboardTab: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  defaultBadge: {
    fontSize: '12px',
    padding: '2px 6px',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '4px'
  },
  widgetsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px'
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '60px 20px',
    background: '#F9FAFB',
    borderRadius: '12px'
  },
  emptyText: {
    fontSize: '16px',
    color: '#374151',
    marginTop: '16px',
    marginBottom: '4px'
  },
  emptySubText: {
    fontSize: '14px',
    color: '#6B7280',
    marginBottom: '16px'
  },
  emptyActionBtn: {
    padding: '10px 24px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer'
  },
  widget: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    position: 'relative'
  },
  widgetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  widgetTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1F2937',
    margin: 0
  },
  widgetClose: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F3F4F6',
    border: 'none',
    borderRadius: '4px',
    color: '#6B7280',
    cursor: 'pointer',
    fontSize: '14px'
  },
  widgetContent: {
    minHeight: '100px'
  },
  statusCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 0'
  },
  statusDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%'
  },
  statusCount: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1F2937',
    display: 'block'
  },
  statusLabel: {
    fontSize: '13px',
    color: '#6B7280'
  },
  energyCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: '#F9FAFB',
    borderRadius: '8px',
    marginRight: '12px',
    flex: 1
  },
  energyValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1F2937',
    display: 'block'
  },
  energyUnit: {
    fontSize: '12px',
    color: '#6B7280'
  },
  emptyWidget: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    color: '#9CA3AF'
  },
  emptyWidgetText: {
    fontSize: '13px',
    marginTop: '8px'
  },
  notificationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  notificationItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    background: '#F9FAFB',
    borderRadius: '6px'
  },
  notificationText: {
    flex: 1,
    fontSize: '13px',
    color: '#374151'
  },
  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px'
  },
  quickActionBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '16px',
    background: '#F9FAFB',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#374151'
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  activityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  activityIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  activityText: {
    fontSize: '13px',
    color: '#374151',
    display: 'block'
  },
  activityTime: {
    fontSize: '12px',
    color: '#9CA3AF'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalCard: {
    background: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '480px',
    overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #E5E7EB'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1F2937',
    margin: 0
  },
  modalCloseBtn: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F3F4F6',
    border: 'none',
    borderRadius: '8px',
    color: '#6B7280',
    cursor: 'pointer'
  },
  modalBody: {
    padding: '24px'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid #E5E7EB'
  },
  modalCancelBtn: {
    padding: '10px 20px',
    background: '#F3F4F6',
    border: 'none',
    borderRadius: '8px',
    color: '#374151',
    fontSize: '14px',
    cursor: 'pointer'
  },
  modalConfirmBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  formGroup: {
    marginBottom: '20px'
  },
  formLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '8px'
  },
  formInput: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none'
  },
  widgetTypeList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px'
  },
  widgetTypeBtn: {
    padding: '16px',
    border: '2px solid',
    borderRadius: '8px',
    background: 'white',
    cursor: 'pointer',
    textAlign: 'left'
  },
  widgetTypeLabel: {
    fontSize: '14px',
    color: '#374151',
    fontWeight: 500
  }
};
