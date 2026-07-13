import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

interface HeaderProps {
  onDiscover: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isDiscovering?: boolean;
  unreadNotifications?: number;
  onSearch?: () => void;
}

interface TabConfig {
  key: string;
  label: string;
  icon: string;
  showInMobile?: boolean;
}

const tabs: TabConfig[] = [
  {
    key: 'system',
    label: '系统',
    icon: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    showInMobile: true,
  },
  {
    key: 'devices',
    label: '设备',
    icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    showInMobile: true,
  },
  {
    key: 'rooms',
    label: '房间',
    icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    showInMobile: true,
  },
  {
    key: 'scenes',
    label: '场景',
    icon: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
    showInMobile: true,
  },
  {
    key: 'energy',
    label: '能耗',
    icon: '<polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    showInMobile: true,
  },
  {
    key: 'predictions',
    label: '预测',
    icon: '<path d="M21 16V8a2 2 0 0 1-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  },
  {
    key: 'modbus',
    label: 'PLC',
    icon: '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="2" x2="9" y2="6"/><line x1="15" y1="2" x2="15" y2="6"/><line x1="9" y1="18" x2="9" y2="22"/><line x1="15" y1="18" x2="15" y2="22"/><line x1="2" y1="9" x2="6" y2="9"/><line x1="2" y1="15" x2="6" y2="15"/><line x1="18" y1="9" x2="22" y2="9"/><line x1="18" y1="15" x2="22" y2="15"/>',
  },
  {
    key: 'chat',
    label: '助手',
    icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  },
];

const desktopMoreTabs: TabConfig[] = [
  {
    key: 'dashboard',
    label: '仪表盘',
    icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  },
  {
    key: 'rules',
    label: '自动化',
    icon: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>',
  },
  {
    key: 'groups',
    label: '设备分组',
    icon: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  },
  {
    key: 'household',
    label: '家庭管理',
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  },
  {
    key: 'organizations',
    label: '组织管理',
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  },
  {
    key: 'permissions',
    label: '权限管理',
    icon: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  },
  {
    key: 'scene-recommendations',
    label: '场景推荐',
    icon: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  },
  {
    key: 'analytics',
    label: '数据分析',
    icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  },
  {
    key: 'tags',
    label: '设备标签',
    icon: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  },
  {
    key: 'thresholds',
    label: '告警阈值',
    icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  },
  {
    key: 'webhooks',
    label: 'Webhook 推送',
    icon: '<path d="M18 16.08h-.76a2.91 2.91 0 0 1-2.06-.8l-1.71-1.71a2 2 0 0 0-2.83 0l-1.71 1.71a2.91 2.91 0 0 1-2.06.8H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2z"/><path d="M9 13l3-3 3 3"/>',
  },
  {
    key: 'firmware-center',
    label: '固件中心',
    icon: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
  },
  {
    key: 'firmware',
    label: '固件管理',
    icon: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="3"/>',
  },
  {
    key: 'notification-channels',
    label: '通知渠道',
    icon: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  },
  {
    key: 'audit-logs',
    label: '审计日志',
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  },
  {
    key: 'export',
    label: '数据导出',
    icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  },
  {
    key: 'config',
    label: '配置导入导出',
    icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  },
];

const mobileBottomTabs: TabConfig[] = [
  {
    key: 'system',
    label: '系统',
    icon: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  },
  {
    key: 'devices',
    label: '设备',
    icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  },
  {
    key: 'scenes',
    label: '场景',
    icon: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
  },
  {
    key: 'energy',
    label: '能耗',
    icon: '<polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  },
  {
    key: 'rooms',
    label: '房间',
    icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  },
];

const mobileMoreTabs: TabConfig[] = [
  {
    key: 'rules',
    label: '自动化',
    icon: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>',
  },
  {
    key: 'predictions',
    label: '预测分析',
    icon: '<path d="M21 16V8a2 2 0 0 1-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  },
  {
    key: 'schedules',
    label: '定时',
    icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  },
  {
    key: 'notifications',
    label: '通知',
    icon: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  },
  {
    key: 'settings',
    label: '设置',
    icon: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  },
  {
    key: 'household',
    label: '家庭管理',
    icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  },
  {
    key: 'audit-logs',
    label: '审计日志',
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  },
  {
    key: 'webhooks',
    label: 'Webhook',
    icon: '<path d="M18 16.08h-.76a2.91 2.91 0 0 1-2.06-.8l-1.71-1.71a2 2 0 0 0-2.83 0l-1.71 1.71a2.91 2.91 0 0 1-2.06.8H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2z"/><path d="M9 13l3-3 3 3"/>',
  },
  {
    key: 'tags',
    label: '设备标签',
    icon: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  },
  {
    key: 'analytics',
    label: '数据分析',
    icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  },
  {
    key: 'export',
    label: '数据导出',
    icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  },
  {
    key: 'config',
    label: '配置管理',
    icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  },
  {
    key: 'firmware',
    label: '固件管理',
    icon: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="3"/>',
  },
  {
    key: 'thresholds',
    label: '告警阈值',
    icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  },
];

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

export function Header({ onDiscover, activeTab, onTabChange, isDiscovering, unreadNotifications, onSearch }: HeaderProps) {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const avatarUrl = useAuthStore((state) => state.avatarUrl);
  const isMobile = useIsMobile();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-menu-trigger') && !target.closest('.user-menu')) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showUserMenu]);

  const handleMoreClick = () => {
    setShowMoreMenu(!showMoreMenu);
    setShowUserMenu(false);
  };

  const handleMoreTabClick = (key: string) => {
    onTabChange(key);
    setShowMoreMenu(false);
  };

  const handleUserMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowUserMenu(!showUserMenu);
    setShowMoreMenu(false);
  };

  const handleUserMenuItem = (action: string) => {
    setShowUserMenu(false);
    if (action === 'logout') {
      logout();
    } else if (action === 'profile') {
      onTabChange('profile');
    } else {
      onTabChange('settings');
    }
  };

  if (isMobile) {
    return (
      <>
        <header style={styles.mobileHeader}>
          <div style={styles.mobileBrandRow}>
            <div style={styles.mobileLogo}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="3" />
                <path d="M8 8h8M8 12h8M8 16h8" />
                <circle cx="8" cy="8" r="0.5" fill="currentColor" />
                <circle cx="16" cy="8" r="0.5" fill="currentColor" />
                <circle cx="8" cy="12" r="0.5" fill="currentColor" />
                <circle cx="16" cy="12" r="0.5" fill="currentColor" />
                <circle cx="8" cy="16" r="0.5" fill="currentColor" />
                <circle cx="16" cy="16" r="0.5" fill="currentColor" />
              </svg>
            </div>
            <span style={styles.mobileTitle}>LinkSphere</span>
            <div style={styles.mobileHeaderActions}>
              {onSearch && (
                <button
                  style={styles.mobileIconButton}
                  onClick={onSearch}
                  title="搜索"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </button>
              )}
              <button
                style={styles.mobileIconButton}
                onClick={() => onTabChange('notifications')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {(unreadNotifications ?? 0) > 0 && (
                  <span style={styles.mobileBadge}>{unreadNotifications}</span>
                )}
              </button>
              <button
                style={{
                  ...styles.mobileDiscoverButton,
                  ...(isDiscovering ? styles.discoverButtonLoading : {}),
                }}
                onClick={onDiscover}
                disabled={isDiscovering}
              >
                {isDiscovering ? (
                  <svg style={styles.spinIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>

        <nav style={styles.bottomNav} className="safe-area-bottom">
          {mobileBottomTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                style={{
                  ...styles.bottomNavItem,
                  ...(isActive ? styles.bottomNavItemActive : {}),
                }}
                onClick={() => onTabChange(tab.key)}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dangerouslySetInnerHTML={{ __html: tab.icon }}
                />
                <span style={styles.bottomNavLabel}>{tab.label}</span>
              </button>
            );
          })}
          <button
            style={{
              ...styles.bottomNavItem,
              ...(activeTab === 'rules' || activeTab === 'predictions' || activeTab === 'schedules' || activeTab === 'voice' ? styles.bottomNavItemActive : {}),
            }}
            onClick={handleMoreClick}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            <span style={styles.bottomNavLabel}>更多</span>
          </button>
        </nav>

        {showMoreMenu && (
          <>
            <div style={styles.moreMenuOverlay} onClick={() => setShowMoreMenu(false)} />
            <div style={styles.moreMenu} className="anim-slide-up">
              <div style={styles.moreMenuHeader}>
                <span style={styles.moreMenuTitle}>更多功能</span>
                <button style={styles.moreMenuClose} onClick={() => setShowMoreMenu(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div style={styles.moreMenuGrid}>
                {mobileMoreTabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      style={{
                        ...styles.moreMenuItem,
                        ...(isActive ? styles.moreMenuItemActive : {}),
                      }}
                      onClick={() => handleMoreTabClick(tab.key)}
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        dangerouslySetInnerHTML={{ __html: tab.icon }}
                      />
                      <span style={styles.moreMenuLabel}>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <header style={styles.header}>
      <div style={styles.brand}>
        <div style={styles.logo}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="3" />
            <path d="M8 8h8M8 12h8M8 16h8" />
            <circle cx="8" cy="8" r="0.5" fill="currentColor" />
            <circle cx="16" cy="8" r="0.5" fill="currentColor" />
            <circle cx="8" cy="12" r="0.5" fill="currentColor" />
            <circle cx="16" cy="12" r="0.5" fill="currentColor" />
            <circle cx="8" cy="16" r="0.5" fill="currentColor" />
            <circle cx="16" cy="16" r="0.5" fill="currentColor" />
          </svg>
        </div>
        <div style={styles.brandText}>
          <span style={styles.brandTitle}>LinkSphere</span>
          <span style={styles.brandSubtitle}>智能设备互联管理平台</span>
        </div>
      </div>

      <nav style={styles.nav}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            style={{
              ...styles.navButton,
              ...(activeTab === tab.key ? styles.navButtonActive : {}),
            }}
            onClick={() => onTabChange(tab.key)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              dangerouslySetInnerHTML={{ __html: tab.icon }}
            />
            <span>{tab.label}</span>
          </button>
        ))}
        <div style={styles.navMoreWrapper}>
          <button
            style={{
              ...styles.navButton,
              ...(desktopMoreTabs.some((t) => t.key === activeTab) ? styles.navButtonActive : {}),
            }}
            onClick={handleMoreClick}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="19" cy="12" r="1.5" fill="currentColor" />
            </svg>
            <span>更多</span>
          </button>
          {showMoreMenu && (
            <>
              <div style={styles.desktopMoreOverlay} onClick={() => setShowMoreMenu(false)} />
              <div style={styles.desktopMoreMenu} className="desktop-more-menu anim-fade-in">
                {desktopMoreTabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      style={{
                        ...styles.desktopMoreItem,
                        ...(isActive ? styles.desktopMoreItemActive : {}),
                      }}
                      className={`desktop-more-item${isActive ? ' active' : ''}`}
                      onClick={() => handleMoreTabClick(tab.key)}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        dangerouslySetInnerHTML={{ __html: tab.icon }}
                      />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </nav>

      <div style={styles.actions}>
        {onSearch && (
          <button
            style={styles.searchButton}
            onClick={onSearch}
            title="全局搜索"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <span>搜索</span>
          </button>
        )}
        <button
          style={styles.iconButton}
          onClick={() => onTabChange('notifications')}
          title="通知中心"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {(unreadNotifications ?? 0) > 0 && (
            <span style={styles.badge}>{unreadNotifications}</span>
          )}
        </button>

        <button
          style={{
            ...styles.discoverButton,
            ...(isDiscovering ? styles.discoverButtonLoading : {}),
          }}
          onClick={onDiscover}
          disabled={isDiscovering}
        >
          {isDiscovering ? (
            <svg style={styles.spinIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
              <line x1="21.17" y1="8" x2="12" y2="8" />
              <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
              <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
            </svg>
          )}
          <span>{isDiscovering ? '发现中...' : '设备发现'}</span>
        </button>

        <div style={styles.userMenuTrigger} className="user-menu-trigger" onClick={handleUserMenuClick}>
          <div style={styles.userAvatar}>
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="用户头像" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                onError={() => {
                  console.error('头像加载失败:', avatarUrl);
                }}
              />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>
          <div style={styles.userInfo}>
            <div style={styles.userName} className="user-name">{user?.username || '用户'}</div>
            <div style={styles.userRole} className="user-role">{user?.role === 'admin' ? '管理员' : user?.role === 'member' ? '普通用户' : '查看者'}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {showUserMenu && (
          <div style={styles.userMenu} className="user-menu">
            <button style={styles.userMenuItem} className="user-menu-item" onClick={() => handleUserMenuItem('profile')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>个人资料</span>
            </button>
            <button style={styles.userMenuItem} className="user-menu-item" onClick={() => handleUserMenuItem('settings')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span>设置</span>
            </button>
            <div style={styles.userMenuDivider} className="user-menu-divider" />
            <button style={{ ...styles.userMenuItem, ...styles.userMenuLogout }} className="user-menu-item" onClick={() => handleUserMenuItem('logout')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>退出登录</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  mobileHeader: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    paddingTop: 'env(safe-area-inset-top)',
  },
  mobileBrandRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    minHeight: '52px',
  },
  mobileLogo: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #005FB8 0%, #1975C5 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.35)',
  },
  mobileTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
    marginLeft: '-32px',
  },
  mobileHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  mobileIconButton: {
    position: 'relative',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'background 0.2s',
  },
  mobileBadge: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    background: '#C42B1C',
    color: '#FFFFFF',
    fontSize: '10px',
    fontWeight: 600,
    minWidth: '16px',
    height: '16px',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
  mobileDiscoverButton: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
    transition: 'background 0.2s',
  },
  bottomNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
    padding: '6px 0',
    zIndex: 100,
  },
  bottomNavItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    padding: '6px 12px',
    background: 'transparent',
    border: 'none',
    color: '#8A8A8A',
    cursor: 'pointer',
    borderRadius: '8px',
    flex: 1,
    minHeight: '48px',
    transition: 'color 0.2s',
  },
  bottomNavItemActive: {
    color: '#005FB8',
  },
  bottomNavLabel: {
    fontSize: '11px',
    fontWeight: 500,
  },
  moreMenuOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    zIndex: 200,
  },
  moreMenu: {
    position: 'fixed',
    bottom: '60px',
    left: '16px',
    right: '16px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    borderRadius: '16px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
    zIndex: 201,
    overflow: 'hidden',
  },
  moreMenuHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
  },
  moreMenuTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  moreMenuClose: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none',
    borderRadius: '8px',
    color: '#5B5B5B',
    cursor: 'pointer',
  },
  moreMenuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    padding: '12px',
    gap: '8px',
  },
  moreMenuItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '12px 8px',
    background: 'transparent',
    border: 'none',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '10px',
    transition: 'background 0.2s',
  },
  moreMenuItemActive: {
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
  },
  moreMenuLabel: {
    fontSize: '11px',
    fontWeight: 500,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 1px 0 rgba(0, 0, 0, 0.03)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },
  logo: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #005FB8 0%, #1975C5 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.35)',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  brandTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1A1A1A',
    letterSpacing: '-0.01em',
    lineHeight: 1.3,
  },
  brandSubtitle: {
    fontSize: '11px',
    color: '#8A8A8A',
    fontWeight: 400,
    letterSpacing: '0.02em',
  },
  nav: {
    display: 'flex',
    gap: '2px',
    background: 'rgba(0, 0, 0, 0.04)',
    padding: '3px',
    borderRadius: '8px',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 12px',
    background: 'transparent',
    border: 'none',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    transition:
      'background var(--w11-duration-fast) var(--w11-ease-standard), color var(--w11-duration-fast) var(--w11-ease-standard)',
  },
  navButtonActive: {
    background: '#FFFFFF',
    color: '#005FB8',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.05)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  navMoreWrapper: {
    position: 'relative',
    display: 'flex',
    zIndex: 201,
  },
  desktopMoreOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 199,
  },
  desktopMoreMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    minWidth: '200px',
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    borderRadius: '10px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12), 0 0 2px rgba(0, 0, 0, 0.04)',
    padding: '4px',
    zIndex: 200,
  },
  desktopMoreItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '9px 12px',
    background: 'transparent',
    border: 'none',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    textAlign: 'left',
    transition: 'background 0.12s ease',
  },
  desktopMoreItemActive: {
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
  },
  userMenuTrigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    background: 'rgba(0, 0, 0, 0.04)',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#5B5B5B',
    transition: 'background 0.12s ease',
    border: 'none',
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #005FB8 0%, #0078D4 100%)',
    borderRadius: '50%',
    color: '#FFFFFF',
    flexShrink: 0,
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '1px',
  },
  userName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
    lineHeight: '1.2',
  },
  userRole: {
    fontSize: '11px',
    color: '#8A8A8A',
    lineHeight: '1.2',
  },
  userMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    minWidth: '180px',
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    borderRadius: '10px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12), 0 0 2px rgba(0, 0, 0, 0.04)',
    padding: '4px',
    zIndex: 200,
  },
  userMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '9px 12px',
    background: 'transparent',
    border: 'none',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    textAlign: 'left',
    transition: 'background 0.12s ease',
  },
  userMenuDivider: {
    height: '1px',
    background: 'rgba(0, 0, 0, 0.06)',
    margin: '4px 8px',
  },
  userMenuLogout: {
    color: '#C42B1C',
  },
  iconButton: {
    position: 'relative',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'background var(--w11-duration-fast) var(--w11-ease-standard)',
  },
  badge: {
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    background: '#C42B1C',
    color: '#FFFFFF',
    fontSize: '10px',
    fontWeight: 600,
    minWidth: '16px',
    height: '16px',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
  searchButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: '1px solid rgba(0, 95, 184, 0.2)',
    color: '#005FB8',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'background 0.2s, border-color 0.2s',
  },
  discoverButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
    transition:
      'background var(--w11-duration-fast) var(--w11-ease-standard), box-shadow var(--w11-duration-fast) var(--w11-ease-standard)',
  },
  discoverButtonLoading: {
    background: '#1975C5',
    cursor: 'wait',
  },
  spinIcon: {
    animation: 'spin 0.8s linear infinite',
  },
  logoutButton: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'background var(--w11-duration-fast) var(--w11-ease-standard)',
  },
};
