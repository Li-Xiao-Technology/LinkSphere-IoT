import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { updatePassword, getNotificationPreferences, updateNotificationPreferences, NotificationPreferences } from '../api';

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

type SettingsTab = 'password' | 'notifications' | 'appearance';

export function Settings({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<SettingsTab>('password');
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const np = await getNotificationPreferences();
      setPreferences(np);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword() {
    setError('');
    setSuccess('');
    if (!passwordForm.currentPassword) {
      setError('请输入当前密码');
      return;
    }
    if (!passwordForm.newPassword) {
      setError('请输入新密码');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setError('新密码至少需要6个字符');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setPasswordSubmitting(true);
    try {
      const result = await updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      if (result?.success) {
        setSuccess(result.message);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setError('修改密码失败，请检查当前密码是否正确');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改密码失败');
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function handleUpdatePreferences() {
    if (!preferences) return;
    setError('');
    setSuccess('');
    try {
      const result = await updateNotificationPreferences(preferences);
      if (result) {
        setPreferences(result);
        setSuccess('通知设置更新成功');
      } else {
        setError('更新失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    }
  }

  const tabs = [
    { id: 'password' as SettingsTab, label: '修改密码', icon: 'lock' },
    { id: 'notifications' as SettingsTab, label: '通知设置', icon: 'bell' },
    { id: 'appearance' as SettingsTab, label: '外观', icon: 'sun' },
  ];

  const notificationTypes = [
    { key: 'deviceOffline', label: '设备离线', desc: '当设备断开连接时通知' },
    { key: 'deviceOnline', label: '设备上线', desc: '当设备重新连接时通知' },
    { key: 'warning', label: '警告提醒', desc: '设备异常或故障警告' },
    { key: 'info', label: '信息通知', desc: '日常操作和状态信息' },
    { key: 'ruleTriggered', label: '规则触发', desc: '自动化规则执行通知' },
    { key: 'firmwareUpdate', label: '固件更新', desc: '设备固件更新提醒' },
    { key: 'scheduleExecuted', label: '定时任务', desc: '定时任务执行通知' },
  ];

  if (loading) {
    return (
      <div style={styles.loadingState}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <div style={styles.loadingText}>加载设置中...</div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, ...(isMobile ? styles.containerMobile : {}) }}>
      <div style={{ ...styles.header, ...(isMobile ? styles.headerMobile : {}) }}>
        <div>
          <h2 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>设置</h2>
          <p style={{ ...styles.subtitle, ...(isMobile ? styles.subtitleMobile : {}) }}>管理您的账户和通知偏好</p>
        </div>
      </div>

      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            style={{
              ...styles.tabButton,
              ...(activeTab === tab.id ? styles.tabButtonActive : {}),
            }}
            onClick={() => { setActiveTab(tab.id); setError(''); setSuccess(''); }}
          >
            {tab.id === 'password' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
            {tab.id === 'notifications' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            )}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {activeTab === 'password' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <h3 style={styles.cardTitle}>修改密码</h3>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>当前密码</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                style={styles.formInput}
                placeholder="输入当前密码"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>新密码</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                style={styles.formInput}
                placeholder="输入新密码（至少6个字符）"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>确认新密码</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                style={styles.formInput}
                placeholder="再次输入新密码"
              />
            </div>

            <div style={styles.formActions}>
              <button
                style={styles.confirmButton}
                onClick={handleChangePassword}
                disabled={passwordSubmitting}
              >
                {passwordSubmitting && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                )}
                修改密码
              </button>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <h3 style={styles.cardTitle}>通知偏好</h3>
            </div>

            <div style={styles.notificationList}>
              {notificationTypes.map((item) => (
                <div key={item.key} style={styles.notificationItem}>
                  <div style={styles.notificationInfo}>
                    <div style={styles.notificationLabel}>{item.label}</div>
                    <div style={styles.notificationDesc}>{item.desc}</div>
                  </div>
                  <button
                    style={{
                      ...styles.toggleSwitch,
                      background: preferences?.[item.key as keyof NotificationPreferences] ? '#107C10' : 'rgba(0, 0, 0, 0.15)',
                    }}
                    onClick={() => preferences && setPreferences((prev) => prev ? { ...prev, [item.key]: !prev[item.key as keyof NotificationPreferences] } : null)}
                  >
                    <div
                      style={{
                        ...styles.toggleKnob,
                        transform: preferences?.[item.key as keyof NotificationPreferences] ? 'translateX(18px)' : 'translateX(0)',
                      }}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div style={styles.formActions}>
              <button
                style={styles.confirmButton}
                onClick={handleUpdatePreferences}
              >
                保存设置
              </button>
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <h3 style={styles.cardTitle}>外观设置</h3>
            </div>

            <div style={styles.notificationList}>
              <div style={styles.notificationItem}>
                <div style={styles.notificationInfo}>
                  <div style={styles.notificationLabel}>主题模式</div>
                  <div style={styles.notificationDesc}>选择浅色、深色或跟随系统主题</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {([
                    { value: 'light', label: '浅色' },
                    { value: 'dark', label: '深色' },
                    { value: 'system', label: '跟随系统' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: `1px solid ${theme === opt.value ? '#005FB8' : 'rgba(0, 0, 0, 0.1)'}`,
                        background: theme === opt.value ? 'rgba(0, 95, 184, 0.08)' : 'transparent',
                        color: theme === opt.value ? '#005FB8' : '#5B5B5B',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                      onClick={() => setTheme(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.notificationItem}>
                <div style={styles.notificationInfo}>
                  <div style={styles.notificationLabel}>语言 / Language</div>
                  <div style={styles.notificationDesc}>选择界面显示语言</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {([
                    { value: 'zh', label: '中文' },
                    { value: 'en', label: 'English' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: `1px solid ${i18n.language === opt.value ? '#005FB8' : 'rgba(0, 0, 0, 0.1)'}`,
                        background: i18n.language === opt.value ? 'rgba(0, 95, 184, 0.08)' : 'transparent',
                        color: i18n.language === opt.value ? '#005FB8' : '#5B5B5B',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        i18n.changeLanguage(opt.value);
                        localStorage.setItem('language', opt.value);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C42B1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6" />
              <path d="M12 5v13" />
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
            <h3 style={styles.cardTitle}>退出登录</h3>
          </div>

          <p style={styles.logoutDesc}>点击下方按钮将退出当前账户，您需要重新登录才能使用系统。</p>

          <div style={styles.formActions}>
            <button style={styles.logoutButton} onClick={() => logout()}>
              退出登录
            </button>
          </div>
        </div>
      </div>

      <div style={styles.quickActions}>
        <h3 style={styles.sectionTitle}>快捷操作</h3>
        <div style={styles.actionGrid}>
          <button style={styles.actionCard} onClick={() => onNavigate?.('profile')}>
            <div style={{ ...styles.actionIcon, background: 'rgba(0, 95, 184, 0.08)', color: '#005FB8' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div style={styles.actionInfo}>
              <div style={styles.actionTitle}>个人资料</div>
              <div style={styles.actionDesc}>查看和编辑个人信息</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.actionArrow}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
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
    marginTop: '4px',
    margin: 0,
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    paddingBottom: '24px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  tabButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'background 0.15s, color 0.15s',
  },
  tabButtonActive: {
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
    fontWeight: 600,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
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
  avatarSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  avatarWrapper: {
    position: 'relative',
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    overflow: 'hidden',
    border: '3px solid rgba(0, 95, 184, 0.15)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    padding: '8px',
    background: 'linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent)',
    opacity: 0,
    transition: 'opacity 0.2s',
  },
  avatarActionButton: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.9)',
    border: 'none',
    borderRadius: '50%',
    color: '#1A1A1A',
    cursor: 'pointer',
    transition: 'background 0.15s, transform 0.15s',
  },
  avatarDeleteButton: {
    background: 'rgba(196, 43, 28, 0.9)',
    color: '#FFFFFF',
  },
  avatarHint: {
    fontSize: '12px',
    color: '#8A8A8A',
    marginTop: '10px',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: '16px',
  },
  formLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: '6px',
  },
  formInput: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '13px',
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.6)',
    outline: 'none',
  },
  formValue: {
    padding: '9px 12px',
    borderRadius: '6px',
    background: 'rgba(0, 0, 0, 0.02)',
    fontSize: '13px',
    color: '#5B5B5B',
    border: '1px solid rgba(0, 0, 0, 0.05)',
  },
  householdList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  householdItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.05)',
  },
  householdName: {
    fontSize: '13px',
    color: '#1A1A1A',
    fontWeight: 500,
  },
  householdRole: {
    fontSize: '12px',
    color: '#005FB8',
    background: 'rgba(0, 95, 184, 0.08)',
    padding: '3px 8px',
    borderRadius: '4px',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  confirmButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 20px',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
  },
  logoutButton: {
    padding: '9px 20px',
    background: 'rgba(196, 43, 28, 0.08)',
    border: '1px solid rgba(196, 43, 28, 0.2)',
    color: '#C42B1C',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  logoutDesc: {
    fontSize: '13px',
    color: '#5B5B5B',
    margin: 0,
    lineHeight: 1.6,
  },
  notificationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  notificationItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.05)',
  },
  notificationInfo: {
    flex: 1,
  },
  notificationLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  notificationDesc: {
    fontSize: '12px',
    color: '#8A8A8A',
    marginTop: '2px',
  },
  toggleSwitch: {
    position: 'relative',
    width: '40px',
    height: '22px',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.2s',
  },
  toggleKnob: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#FFFFFF',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    transition: 'transform 0.2s',
  },
  error: {
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
  },
  success: {
    background: 'rgba(16, 124, 16, 0.08)',
    color: '#107C10',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    gap: '12px',
  },
  loadingText: {
    fontSize: '13px',
    color: '#8A8A8A',
  },
  quickActions: {
    marginTop: '24px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
    marginBottom: '12px',
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
  },
  actionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px',
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '10px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  actionIcon: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    flexShrink: 0,
  },
  actionInfo: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: '2px',
  },
  actionDesc: {
    fontSize: '12px',
    color: '#8A8A8A',
  },
  actionArrow: {
    color: '#8A8A8A',
    flexShrink: 0,
  },
  containerMobile: {
    padding: '16px',
  },
  headerMobile: {
    marginBottom: '16px',
  },
  titleMobile: {
    fontSize: '20px',
  },
  cropperOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  cropperDialog: {
    background: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    borderRadius: '14px',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: '0 20px 48px rgba(0, 0, 0, 0.2)',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  cropperHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  cropperTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  cropperClose: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'background 0.15s',
  },
  cropperBody: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 20px',
  },
  cropperHint: {
    fontSize: '12px',
    color: '#8A8A8A',
    textAlign: 'center',
    marginTop: '10px',
    marginBottom: 0,
  },
  cropperFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '14px 20px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  cropperCancelBtn: {
    padding: '8px 18px',
    background: 'transparent',
    border: '1px solid rgba(0, 0, 0, 0.12)',
    color: '#5B5B5B',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  cropperConfirmBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 18px',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  subtitleMobile: {
    fontSize: '12px',
  },
};