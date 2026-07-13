import { useMemo, useRef } from 'react';
import { AppNotification } from '../types';
import { markNotificationRead, markAllNotificationsRead, deleteNotification } from '../api';
import { useNotificationStore } from '../store/notificationStore';

const NOTIFICATION_META: Record<
  AppNotification['type'],
  { color: string; bg: string; label: string; icon: JSX.Element }
> = {
  device_offline: {
    color: '#C42B1C',
    bg: 'rgba(196, 43, 28, 0.08)',
    label: '离线',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    ),
  },
  device_online: {
    color: '#107C10',
    bg: 'rgba(16, 124, 16, 0.08)',
    label: '上线',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    ),
  },
  warning: {
    color: '#FF8C00',
    bg: 'rgba(255, 140, 0, 0.1)',
    label: '警告',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  info: {
    color: '#005FB8',
    bg: 'rgba(0, 95, 184, 0.08)',
    label: '信息',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  rule_triggered: {
    color: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.1)',
    label: '规则',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  firmware_update: {
    color: '#1975C5',
    bg: 'rgba(25, 117, 197, 0.1)',
    label: '固件',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  schedule_executed: {
    color: '#107C10',
    bg: 'rgba(16, 124, 16, 0.08)',
    label: '定时',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
};

function formatTime(createdAt?: string): string {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString('zh-CN');
}

export function NotificationCenter() {
  const { notifications, loadNotifications } = useNotificationStore();
  const markingAll = useRef(false);

  async function handleMarkRead(id: string) {
    try {
      await markNotificationRead(id);
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  }

  async function handleMarkAllRead() {
    markingAll.current = true;
    try {
      await markAllNotificationsRead();
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    } finally {
      markingAll.current = false;
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteNotification(id);
      loadNotifications();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [notifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>通知中心</h2>
          <p style={styles.subtitle}>
            {unreadCount > 0 ? `您有 ${unreadCount} 条未读通知` : '查看所有设备与系统通知'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            style={{ ...styles.markAllButton, ...(markingAll.current ? styles.markAllButtonDisabled : {}) }}
            onClick={handleMarkAllRead}
            disabled={markingAll.current}
          >
            {markingAll.current ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            <span>全部已读</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div style={styles.emptyTitle}>暂无通知</div>
          <div style={styles.emptyDesc}>所有通知都将在这里显示</div>
        </div>
      ) : (
        <div style={styles.notificationList}>
          {sortedNotifications.map((notification) => {
            const meta = NOTIFICATION_META[notification.type] ?? NOTIFICATION_META.info;
            return (
              <div
                key={notification.id}
                style={{
                  ...styles.notificationCard,
                  ...(notification.read ? styles.notificationCardRead : {}),
                }}
                className="anim-slide-up"
              >
                <div style={{ ...styles.notificationIcon, color: meta.color, background: meta.bg }}>
                  {meta.icon}
                </div>

                <div style={styles.notificationContent}>
                  <div style={styles.notificationHeader}>
                    <div style={styles.notificationTitleRow}>
                      {!notification.read && <span style={styles.unreadDot} />}
                      <h3 style={styles.notificationTitle}>{notification.title}</h3>
                      <span style={{ ...styles.typePill, color: meta.color, background: meta.bg }}>
                        {meta.label}
                      </span>
                    </div>
                    <div style={styles.notificationTime}>{formatTime(notification.createdAt)}</div>
                  </div>
                  {notification.body && (
                    <p style={styles.notificationBody}>{notification.body}</p>
                  )}
                  <div style={styles.notificationFooter}>
                    {!notification.read ? (
                      <button
                        style={styles.actionButton}
                        onClick={() => handleMarkRead(notification.id)}
                      >
                        标记为已读
                      </button>
                    ) : (
                      <span style={styles.readLabel}>已读</span>
                    )}
                    <button
                      style={{ ...styles.actionButton, color: '#C42B1C' }}
                      onClick={() => handleDelete(notification.id)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
    marginTop: '4px',
    margin: 0,
  },
  markAllButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
  },
  markAllButtonDisabled: {
    background: '#B0B0B0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px',
    background: 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    borderRadius: '12px',
  },
  emptyIcon: { marginBottom: '16px' },
  emptyTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#5B5B5B',
    marginBottom: '4px',
  },
  emptyDesc: { fontSize: '13px', color: '#8A8A8A' },
  notificationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  notificationCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    gap: '12px',
  },
  notificationCardRead: {
    background: 'rgba(255, 255, 255, 0.5)',
  },
  notificationIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
    marginBottom: '4px',
  },
  notificationTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
    minWidth: 0,
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#005FB8',
    flexShrink: 0,
    boxShadow: '0 0 0 3px rgba(0, 95, 184, 0.18)',
  },
  notificationTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
    letterSpacing: '-0.01em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  typePill: {
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 600,
    flexShrink: 0,
  },
  notificationTime: {
    fontSize: '11px',
    color: '#8A8A8A',
    flexShrink: 0,
  },
  notificationBody: {
    fontSize: '13px',
    color: '#5B5B5B',
    margin: '4px 0 8px 0',
    lineHeight: 1.5,
  },
  notificationFooter: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginTop: '6px',
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    background: 'transparent',
    border: 'none',
    color: '#005FB8',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
  },
  readLabel: {
    fontSize: '12px',
    color: '#8A8A8A',
  },
};
