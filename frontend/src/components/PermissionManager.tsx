import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

interface Permission {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category: string;
  allowed?: boolean;
  source?: 'role' | 'user';
}

interface UserPermissionInfo {
  userId: string;
  role: string;
  permissions: Permission[];
}

const CATEGORY_LABELS: Record<string, string> = {
  device: '设备权限',
  scene: '场景权限',
  rule: '自动化规则权限',
  schedule: '定时任务权限',
  household: '家庭管理权限',
  system: '系统权限',
};

const CATEGORY_ORDER = ['device', 'scene', 'rule', 'schedule', 'household', 'system'];

const API_BASE = '/api';

export function PermissionManager() {
  const [userId, setUserId] = useState('');
  const [userPermissionInfo, setUserPermissionInfo] = useState<UserPermissionInfo | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadAllPermissions();
    checkInitialized();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getAuthHeaders(): HeadersInit {
    const token = useAuthStore.getState().token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function checkInitialized() {
    try {
      const response = await fetch(`${API_BASE}/permissions`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        if (data.length === 0) {
          // 权限表为空，自动初始化
          await initializePermissions();
        } else {
          setInitialized(true);
        }
      }
    } catch (error) {
      console.error('Failed to check initialization:', error);
    }
  }

  async function initializePermissions() {
    try {
      const response = await fetch(`${API_BASE}/permissions/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });
      if (response.ok) {
        setInitialized(true);
        setSuccessMessage('权限系统初始化成功');
        await loadAllPermissions();
      }
    } catch (error) {
      console.error('Failed to initialize permissions:', error);
      setError('权限系统初始化失败');
    }
  }

  async function loadAllPermissions() {
    try {
      const response = await fetch(`${API_BASE}/permissions`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setAllPermissions(data);
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  }

  async function loadUserPermissions() {
    if (!userId) {
      setError('请输入用户ID');
      return;
    }

    setLoading(true);
    setError('');
    setUserPermissionInfo(null);

    try {
      const response = await fetch(`${API_BASE}/permissions/users/${userId}/permissions`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setUserPermissionInfo(data);
      } else if (response.status === 404) {
        setError('用户不存在');
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || `加载失败 (${response.status})`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '加载失败，请检查网络';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function saveUserPermissions() {
    if (!userPermissionInfo) return;

    setSaving(true);
    setError('');
    setSuccessMessage('');

    // 构建权限数据
    const permissions = userPermissionInfo.permissions.map((p) => ({
      permissionId: p.id,
      allowed: p.allowed ?? false,
    }));

    try {
      const response = await fetch(`${API_BASE}/permissions/users/${userId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ permissions }),
      });

      if (response.ok) {
        const data = await response.json();
        setUserPermissionInfo(data);
        setSuccessMessage('权限设置已保存');
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || `保存失败 (${response.status})`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '保存失败，请检查网络';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(permissionId: string) {
    if (!userPermissionInfo) return;

    const updatedPermissions: Permission[] = userPermissionInfo.permissions.map((p) => {
      if (p.id === permissionId) {
        return { ...p, allowed: !p.allowed, source: 'user' as const };
      }
      return p;
    });

    setUserPermissionInfo({ ...userPermissionInfo, permissions: updatedPermissions });
  }

  // 合并所有权限和用户当前权限
  function getFullPermissionList(): Permission[] {
    if (!userPermissionInfo) return [];

    const userPermMap = new Map<string, Permission>();
    userPermissionInfo.permissions.forEach((p) => {
      userPermMap.set(p.id, p);
    });

    // 添加用户没有的权限（默认不允许）
    return allPermissions.map((perm): Permission => {
      if (userPermMap.has(perm.id)) {
        return userPermMap.get(perm.id)!;
      }
      return {
        ...perm,
        allowed: false,
        source: 'role' as const,
      };
    });
  }

  const fullPermissions = getFullPermissionList();

  // 按分类分组
  const permissionsByCategory = CATEGORY_ORDER.reduce((acc, category) => {
    acc[category] = fullPermissions.filter((p) => p.category === category);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>权限管理</h2>
          <p style={styles.subtitle}>管理用户的操作权限，支持精细化的权限分配</p>
        </div>
        {!initialized && (
          <button style={styles.initButton} onClick={initializePermissions}>
            初始化权限系统
          </button>
        )}
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}
      {successMessage && <div style={styles.successBanner}>{successMessage}</div>}

      {!initialized ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div style={styles.emptyTitle}>权限系统未初始化</div>
          <div style={styles.emptyDesc}>请先初始化权限系统以启用权限管理功能</div>
        </div>
      ) : (
        <>
          <div style={styles.searchCard}>
            <div style={styles.searchForm}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>用户ID</label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => { setUserId(e.target.value); setError(''); }}
                  style={styles.formInput}
                  placeholder="输入要管理的用户ID"
                />
              </div>
              <button
                style={{ ...styles.searchButton, ...(loading || !userId ? styles.searchButtonDisabled : {}) }}
                onClick={loadUserPermissions}
                disabled={loading || !userId}
              >
                {loading ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : null}
                查询权限
              </button>
            </div>
          </div>

          {userPermissionInfo && (
            <>
              <div style={styles.userInfoCard}>
                <div style={styles.userInfoRow}>
                  <div style={styles.userInfoItem}>
                    <span style={styles.userInfoLabel}>用户ID</span>
                    <span style={styles.userInfoValue}>{userPermissionInfo.userId}</span>
                  </div>
                  <div style={styles.userInfoItem}>
                    <span style={styles.userInfoLabel}>家庭角色</span>
                    <span style={styles.rolePill}>{userPermissionInfo.role}</span>
                  </div>
                  <div style={styles.userInfoItem}>
                    <span style={styles.userInfoLabel}>权限数量</span>
                    <span style={styles.userInfoValue}>
                      {userPermissionInfo.permissions.filter((p) => p.allowed).length} / {allPermissions.length}
                    </span>
                  </div>
                </div>
              </div>

              <div style={styles.permissionsSection}>
                {CATEGORY_ORDER.map((category) => {
                  const perms = permissionsByCategory[category];
                  if (perms.length === 0) return null;

                  return (
                    <div key={category} style={styles.categorySection}>
                      <h3 style={styles.categoryTitle}>{CATEGORY_LABELS[category] || category}</h3>
                      <div style={styles.permissionGrid}>
                        {perms.map((perm) => {
                          const isAllowed = perm.allowed ?? false;
                          return (
                            <div key={perm.id} style={styles.permissionCard}>
                              <div style={styles.permissionHeader}>
                                <span style={styles.permissionName}>{perm.displayName}</span>
                                {perm.source === 'user' && (
                                  <span style={styles.customBadge}>自定义</span>
                                )}
                              </div>
                              {perm.description && (
                                <div style={styles.permissionDesc}>{perm.description}</div>
                              )}
                              <div style={styles.permissionToggle}>
                                <button
                                  style={{
                                    ...styles.toggleButton,
                                    ...(isAllowed ? styles.toggleButtonActive : {}),
                                  }}
                                  onClick={() => togglePermission(perm.id)}
                                >
                                  {isAllowed ? '允许' : '拒绝'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={styles.actionsBar}>
                <button style={styles.cancelButton} onClick={() => setUserPermissionInfo(null)}>
                  取消
                </button>
                <button
                  style={{ ...styles.saveButton, ...(saving ? styles.saveButtonDisabled : {}) }}
                  onClick={saveUserPermissions}
                  disabled={saving}
                >
                  {saving ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : null}
                  保存设置
                </button>
              </div>
            </>
          )}
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
  initButton: {
    padding: '9px 16px',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
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
  successBanner: {
    background: 'rgba(16, 124, 16, 0.08)',
    color: '#107C10',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
    border: '1px solid rgba(16, 124, 16, 0.15)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
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
  emptyDesc: {
    fontSize: '13px',
    color: '#8A8A8A',
  },
  searchCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
  },
  searchForm: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
  },
  formGroup: {
    flex: 1,
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
  searchButton: {
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
    whiteSpace: 'nowrap',
  },
  searchButtonDisabled: {
    background: '#B0B0B0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  userInfoCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '18px',
    marginBottom: '20px',
  },
  userInfoRow: {
    display: 'flex',
    gap: '24px',
    alignItems: 'center',
  },
  userInfoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  userInfoLabel: {
    fontSize: '12px',
    color: '#8A8A8A',
    fontWeight: 500,
  },
  userInfoValue: {
    fontSize: '14px',
    color: '#1A1A1A',
    fontWeight: 600,
  },
  rolePill: {
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
  },
  permissionsSection: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '18px',
    marginBottom: '20px',
  },
  categorySection: {
    marginBottom: '20px',
  },
  categoryTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: '0 0 14px 0',
    letterSpacing: '-0.01em',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    paddingBottom: '10px',
  },
  permissionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
  },
  permissionCard: {
    padding: '14px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.04)',
  },
  permissionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  permissionName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  customBadge: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
    background: 'rgba(139, 92, 246, 0.1)',
    color: '#8B5CF6',
  },
  permissionDesc: {
    fontSize: '12px',
    color: '#8A8A8A',
    marginBottom: '10px',
  },
  permissionToggle: {
    display: 'flex',
    alignItems: 'center',
  },
  toggleButton: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    transition: 'all 0.15s ease',
  },
  toggleButtonActive: {
    background: 'rgba(16, 124, 16, 0.08)',
    color: '#107C10',
    borderColor: 'rgba(16, 124, 16, 0.2)',
  },
  actionsBar: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '9px 20px',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none',
    color: '#1A1A1A',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  saveButton: {
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
  saveButtonDisabled: {
    background: '#B0B0B0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
};