import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Header } from './components/Header';
import { DeviceControlPanel } from './components/DeviceControlPanel';
import { SceneManager } from './components/SceneManager';
import { ScheduleManager } from './components/ScheduleManager';
import { RoomManager } from './components/RoomManager';
import { NotificationCenter } from './components/NotificationCenter';
import { RuleManager } from './components/RuleManager';
import { EnergyDashboard } from './components/EnergyDashboard';
import { HouseholdManager } from './components/HouseholdManager';
import { PredictionDashboard } from './components/PredictionDashboard';
import { PermissionManager } from './components/PermissionManager';
import { Settings } from './components/Settings';
import { Profile } from './components/Profile';
import { DeviceHistory } from './components/DeviceHistory';
import { SearchModal } from './components/SearchModal';
import { ChatAssistant } from './components/ChatAssistant';
import { ModbusSetup } from './components/ModbusSetup';
import { AuditLogViewer } from './components/AuditLogViewer';
import { WebhookManager } from './components/WebhookManager';
import { DeviceTagManager } from './components/DeviceTagManager';
import { AlertThresholdManager } from './components/AlertThresholdManager';
import { SystemDashboard } from './components/SystemDashboard';
import { ConfigManager } from './components/ConfigManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { FirmwareManager } from './components/FirmwareManager';
import { DataExport } from './components/DataExport';
import { SearchResult } from './api';
import { useDeviceStore } from './store/deviceStore';
import { useNotificationStore } from './store/notificationStore';
import { useAuthStore } from './store/authStore';
import { useSocketStore } from './store/socketStore';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

function App() {
  const { isAuthenticated, initialized, initAuth } = useAuthStore();
  const { isDiscovering } = useDeviceStore();
  const { unreadCount } = useNotificationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [historyDevice, setHistoryDevice] = useState<{ id: string; name: string } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isMobile = useIsMobile();

  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname.split('/')[1] || 'devices';

  // Sync URL to store for backward compatibility
  useEffect(() => {
    useDeviceStore.getState().setActiveTab(activeTab);
  }, [activeTab]);

  const handleSearchResult = (result: SearchResult) => {
    switch (result.type) {
      case 'device':
        navigate('/devices');
        setHistoryDevice({ id: result.id, name: result.name });
        break;
      case 'scene':
        navigate('/scenes');
        break;
      case 'rule':
        navigate('/rules');
        break;
      case 'room':
        navigate('/rooms');
        break;
    }
  };

  useEffect(() => {
    initAuth();
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized || !isAuthenticated) return;

    const loadData = async () => {
      await useDeviceStore.getState().loadDevices();
    };
    loadData();

    const { connect } = useSocketStore.getState();
    connect();

    const loadInterval = setInterval(() => {
      useNotificationStore.getState().loadUnreadCount();
    }, 30000);
    return () => {
      clearInterval(loadInterval);
      const { disconnect } = useSocketStore.getState();
      disconnect();
    };
  }, [initialized, isAuthenticated]);

  function handleTabChange(tab: string) {
    navigate(`/${tab}`);
    if (tab === 'notifications') {
      useNotificationStore.getState().loadUnreadCount();
    }
  }

  if (isLoading) {
    return (
      <div style={styles.loading}>
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#005FB8"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ animation: 'spin 0.9s linear infinite' }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ErrorBoundary>
    );
  }

  return (
    <div style={styles.app}>
      <Header
        onDiscover={() => useDeviceStore.getState().handleDiscover()}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isDiscovering={isDiscovering}
        unreadNotifications={unreadCount}
        onSearch={() => setIsSearchOpen(true)}
      />

      <main style={{ ...styles.main, ...(isMobile ? styles.mainMobile : {}) }} className="anim-fade-in">
        <ErrorBoundary>
          <Routes>
            <Route
              path="/devices"
              element={
                !historyDevice ? (
                  <DeviceControlPanel onViewHistory={(id, name) => setHistoryDevice({ id, name })} />
                ) : null
              }
            />
            <Route path="/rooms" element={<RoomManager />} />
            <Route path="/scenes" element={<SceneManager />} />
            <Route path="/rules" element={<RuleManager />} />
            <Route path="/energy" element={<EnergyDashboard />} />
            <Route path="/predictions" element={<PredictionDashboard />} />
            <Route path="/voice" element={<ChatAssistant />} />
            <Route path="/chat" element={<ChatAssistant />} />
            <Route path="/modbus" element={<ModbusSetup onDeviceAdded={() => useDeviceStore.getState().loadDevices()} />} />
            <Route path="/household" element={<HouseholdManager />} />
            <Route path="/permissions" element={<PermissionManager />} />
            <Route path="/notifications" element={<NotificationCenter />} />
            <Route path="/schedules" element={<ScheduleManager />} />
            <Route path="/audit-logs" element={<AuditLogViewer />} />
            <Route path="/webhooks" element={<WebhookManager />} />
            <Route path="/tags" element={<DeviceTagManager />} />
            <Route path="/thresholds" element={<AlertThresholdManager />} />
            <Route path="/system" element={<SystemDashboard />} />
            <Route path="/config" element={<ConfigManager />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/firmware" element={<FirmwareManager />} />
            <Route path="/export" element={<DataExport />} />
            <Route path="/settings" element={<Settings onNavigate={(page) => navigate(`/${page}`)} />} />
            <Route path="/profile" element={<Profile onNavigate={(page) => navigate(`/${page}`)} />} />
            <Route path="/" element={<Navigate to="/devices" replace />} />
            <Route path="*" element={<Navigate to="/devices" replace />} />
          </Routes>
          {historyDevice && (
            <div style={styles.historyContainer}>
              <button
                style={styles.backButton}
                onClick={() => setHistoryDevice(null)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <span>返回设备列表</span>
              </button>
              <DeviceHistory deviceId={historyDevice.id} deviceName={historyDevice.name} />
            </div>
          )}
        </ErrorBoundary>
      </main>

      {isDiscovering && (
        <div style={styles.loadingOverlay} className="anim-fade-in">
          <div style={styles.loadingCard} className="anim-scale-in">
            <div style={styles.loadingSpinner}>
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#005FB8"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ animation: 'spin 0.9s linear infinite' }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
            <div style={styles.loadingText}>正在发现设备</div>
            <div style={styles.loadingSubtext}>扫描局域网中的智能设备...</div>
          </div>
        </div>
      )}

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectResult={handleSearchResult}
      />
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: 'var(--w11-bg-app)',
  },
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--w11-bg-app)',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  mainMobile: {},
  loadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--w11-bg-smoke)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    background: 'var(--w11-bg-card)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid var(--w11-stroke)',
    borderRadius: '12px',
    padding: '32px 48px',
    boxShadow: 'var(--w11-shadow-16)',
    textAlign: 'center',
    minWidth: '280px',
  },
  loadingSpinner: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  loadingText: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--w11-text-primary)',
    marginBottom: '4px',
  },
  loadingSubtext: {
    fontSize: '12px',
    color: 'var(--w11-text-tertiary)',
  },
  historyContainer: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--w11-bg-app)',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'var(--w11-bg-card)',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    border: '1px solid var(--w11-stroke)',
    color: 'var(--w11-accent)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    margin: '16px 24px',
    alignSelf: 'flex-start',
  },
};

export default App;
