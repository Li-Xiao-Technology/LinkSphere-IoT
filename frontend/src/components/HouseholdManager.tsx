import { useState, useEffect } from 'react';
import { showConfirm } from '../utils/confirm';
import { useAuthStore } from '../store/authStore';

type Role = 'owner' | 'admin' | 'member' | 'guest';

interface Member {
  id: string;
  username: string;
  role: Role;
  joinedAt?: string;
}

interface Household {
  id: string;
  name: string;
  ownerId: string;
  members: Member[];
  createdAt?: string;
}

const ROLE_META: Record<Role, { label: string; color: string; bg: string }> = {
  owner: { label: '所有者', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' },
  admin: { label: '管理员', color: '#005FB8', bg: 'rgba(0, 95, 184, 0.08)' },
  member: { label: '成员', color: '#107C10', bg: 'rgba(16, 124, 16, 0.08)' },
  guest: { label: '访客', color: '#5B5B5B', bg: 'rgba(0, 0, 0, 0.05)' },
};

const ROLE_ORDER: Role[] = ['owner', 'admin', 'member', 'guest'];

const API_BASE = '/api';

function formatTime(joinedAt?: string): string {
  if (!joinedAt) return '';
  const date = new Date(joinedAt);
  return date.toLocaleDateString('zh-CN');
}

function getInitial(username: string): string {
  return username?.charAt(0).toUpperCase() ?? '?';
}

function avatarColor(username?: string): string {
  const colors = ['#005FB8', '#107C10', '#8B5CF6', '#FF8C00', '#1975C5', '#C42B1C'];
  if (!username) return colors[0];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function HouseholdManager() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [householdForm, setHouseholdForm] = useState({ name: '' });
  const [inviteForm, setInviteForm] = useState<{ username: string; role: Role }>({
    username: '',
    role: 'member',
  });
  const [actingMemberId, setActingMemberId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHousehold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getAuthHeaders(): HeadersInit {
    const token = useAuthStore.getState().token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadHousehold() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/household`, { headers: getAuthHeaders() });
      if (response.status === 404 || !response.ok) {
        setHousehold(null);
        return;
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setHousehold(data.length > 0 ? data[0] : null);
      } else if (data && typeof data === 'object') {
        setHousehold(data);
      } else {
        setHousehold(null);
      }
    } catch (error) {
      console.error('Failed to load household:', error);
      setHousehold(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateHousehold() {
    setError('');
    if (!householdForm.name) {
      setError('请输入家庭名称');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/household`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name: householdForm.name }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || `创建失败 (${response.status})`);
        return;
      }
      const data = await response.json();
      setHousehold(data);
      setIsCreating(false);
      setHouseholdForm({ name: '' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '创建失败，请检查网络';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInvite() {
    setError('');
    if (!inviteForm.username || !household) {
      setError('请输入要邀请的用户名');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/household/${household.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(inviteForm),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || `邀请失败 (${response.status})`);
        return;
      }
      const data = await response.json();
      setHousehold(data);
      setIsInviting(false);
      setInviteForm({ username: '', role: 'member' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '邀请失败，请检查网络';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangeRole(memberId: string, role: Role) {
    if (!household) return;
    setActingMemberId(memberId);
    try {
      const response = await fetch(`${API_BASE}/household/${household.id}/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) return;
      const data = await response.json();
      setHousehold(data);
    } catch (error) {
      console.error('Failed to update member role:', error);
    } finally {
      setActingMemberId(null);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!household) return;
    if (!showConfirm('确定要移除该成员吗？')) return;
    setActingMemberId(memberId);
    try {
      const response = await fetch(`${API_BASE}/household/${household.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setHousehold((prev) =>
          prev ? { ...prev, members: (prev.members ?? []).filter((m) => m.id !== memberId) } : prev
        );
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    } finally {
      setActingMemberId(null);
    }
  }

  const sortedMembers = household?.members && Array.isArray(household.members)
    ? [...household.members].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
    : [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>家庭管理</h2>
          <p style={styles.subtitle}>管理家庭信息与成员，共享智能设备与场景</p>
        </div>
        {household && (
          <button style={styles.addButton} onClick={() => setIsInviting(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            <span>邀请成员</span>
          </button>
        )}
      </div>

      {isCreating && (
        <div style={styles.modalOverlay} className="anim-fade-in" onClick={() => setIsCreating(false)}>
          <div style={styles.modalContent} className="anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>创建家庭</h3>
              <button style={styles.closeButton} onClick={() => setIsCreating(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {error && <div style={styles.formError}>{error}</div>}
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>家庭名称</label>
              <input
                type="text"
                value={householdForm.name}
                onChange={(e) => { setHouseholdForm({ name: e.target.value }); setError(''); }}
                style={styles.formInput}
                placeholder="例如：我的家"
                autoFocus
              />
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => { setIsCreating(false); setError(''); }}>取消</button>
              <button
                style={{ ...styles.confirmButton, ...(!householdForm.name || submitting ? styles.confirmButtonDisabled : {}) }}
                onClick={handleCreateHousehold}
                disabled={!householdForm.name || submitting}
              >
                {submitting ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : null}
                创建家庭
              </button>
            </div>
          </div>
        </div>
      )}

      {isInviting && household && (
        <div style={styles.modalOverlay} className="anim-fade-in" onClick={() => setIsInviting(false)}>
          <div style={styles.modalContent} className="anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>邀请成员</h3>
              <button style={styles.closeButton} onClick={() => { setIsInviting(false); setError(''); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {error && <div style={styles.formError}>{error}</div>}
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>用户名</label>
              <input
                type="text"
                value={inviteForm.username}
                onChange={(e) => { setInviteForm((prev) => ({ ...prev, username: e.target.value })); setError(''); }}
                style={styles.formInput}
                placeholder="输入要邀请的用户名"
                autoFocus
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>角色</label>
              <div style={styles.roleGrid}>
                {ROLE_ORDER.filter((r) => r !== 'owner').map((role) => {
                  const meta = ROLE_META[role];
                  return (
                    <button
                      key={role}
                      style={{
                        ...styles.roleButton,
                        ...(inviteForm.role === role ? styles.roleButtonActive : {}),
                        ...(inviteForm.role === role ? { background: meta.bg, color: meta.color, borderColor: meta.color } : {}),
                      }}
                      onClick={() => setInviteForm((prev) => ({ ...prev, role }))}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setIsInviting(false)}>取消</button>
              <button
                style={{ ...styles.confirmButton, ...(!inviteForm.username || submitting ? styles.confirmButtonDisabled : {}) }}
                onClick={handleInvite}
                disabled={!inviteForm.username || submitting}
              >
                {submitting ? '邀请中...' : '发送邀请'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.loadingState}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <div style={styles.loadingText}>加载家庭信息中...</div>
        </div>
      ) : !household ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div style={styles.emptyTitle}>尚未创建家庭</div>
          <div style={styles.emptyDesc}>创建家庭以与家人共享设备和场景</div>
          <button
            style={styles.createHouseholdButton}
            onClick={() => { setHouseholdForm({ name: '' }); setIsCreating(true); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            创建家庭
          </button>
        </div>
      ) : (
        <>
          <div style={styles.householdCard}>
            <div style={styles.householdHeader}>
              <div style={styles.householdIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div style={styles.householdInfo}>
                <h3 style={styles.householdName}>{household.name}</h3>
                <div style={styles.householdMeta}>
                  <span style={styles.metaItem}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    {(household.members?.length ?? 0)} 位成员
                  </span>
                  {household.createdAt && (
                    <span style={styles.metaItem}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      创建于 {formatTime(household.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={styles.membersSection}>
            <h3 style={styles.sectionTitle}>成员列表</h3>
            <div style={styles.memberList}>
              {sortedMembers.map((member) => {
                const meta = ROLE_META[member.role];
                const color = avatarColor(member.username);
                const isOwner = member.role === 'owner';
                return (
                  <div key={member.id} style={styles.memberCard} className="anim-slide-up">
                    <div style={{ ...styles.memberAvatar, background: color }}>
                      {getInitial(member.username)}
                    </div>
                    <div style={styles.memberInfo}>
                      <div style={styles.memberNameRow}>
                        <span style={styles.memberName}>{member.username}</span>
                        <span style={{ ...styles.rolePill, color: meta.color, background: meta.bg }}>
                          {meta.label}
                        </span>
                      </div>
                      {member.joinedAt && (
                        <div style={styles.memberJoined}>加入于 {formatTime(member.joinedAt)}</div>
                      )}
                    </div>
                    <div style={styles.memberActions}>
                      {!isOwner && (
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.id, e.target.value as Role)}
                          style={styles.roleSelect}
                          disabled={actingMemberId === member.id}
                        >
                          {ROLE_ORDER.filter((r) => r !== 'owner').map((role) => (
                            <option key={role} value={role}>
                              {ROLE_META[role].label}
                            </option>
                          ))}
                        </select>
                      )}
                      {!isOwner && (
                        <button
                          style={{ ...styles.removeButton, ...(actingMemberId === member.id ? styles.removeButtonDisabled : {}) }}
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={actingMemberId === member.id}
                          title="移除成员"
                        >
                          {actingMemberId === member.id ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '12px',
    padding: '24px',
    width: '480px',
    maxWidth: '92vw',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 14px 28px rgba(0, 0, 0, 0.18), 0 0 8px rgba(0, 0, 0, 0.08)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  modalTitle: {
    fontSize: '17px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  closeButton: {
    width: '32px', height: '32px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none',
    color: '#5B5B5B', cursor: 'pointer', borderRadius: '6px',
  },
  formGroup: { marginBottom: '16px' },
  formLabel: {
    display: 'block',
    fontSize: '13px', fontWeight: 600,
    color: '#1A1A1A', marginBottom: '6px',
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
  roleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  roleButton: {
    padding: '10px',
    background: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
  },
  roleButtonActive: {
    background: '#005FB8',
    color: '#FFFFFF',
    borderColor: '#005FB8',
  },
  modalFooter: {
    display: 'flex', gap: '8px',
    justifyContent: 'flex-end',
    marginTop: '24px', paddingTop: '16px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  cancelButton: {
    padding: '9px 20px',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none', color: '#1A1A1A',
    borderRadius: '6px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 500,
  },
  confirmButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 20px',
    background: '#005FB8',
    border: 'none', color: '#FFFFFF',
    borderRadius: '6px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
  },
  confirmButtonDisabled: {
    background: '#B0B0B0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  formError: {
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '12px',
    border: '1px solid rgba(196, 43, 28, 0.15)',
  },
  loadingState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '80px 24px',
  },
  loadingText: {
    marginTop: '12px', fontSize: '13px', color: '#5B5B5B',
  },
  emptyState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '60px 24px',
    background: 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    borderRadius: '12px',
  },
  emptyIcon: { marginBottom: '16px' },
  emptyTitle: {
    fontSize: '15px', fontWeight: 600,
    color: '#5B5B5B', marginBottom: '4px',
  },
  emptyDesc: {
    fontSize: '13px', color: '#8A8A8A',
    marginBottom: '20px',
  },
  createHouseholdButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
  },
  householdCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    marginBottom: '20px',
  },
  householdHeader: {
    display: 'flex', gap: '14px', alignItems: 'center',
  },
  householdIcon: {
    width: '56px', height: '56px',
    borderRadius: '10px',
    background: 'rgba(0, 95, 184, 0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  householdInfo: { flex: 1, minWidth: 0 },
  householdName: {
    fontSize: '18px', fontWeight: 700,
    color: '#1A1A1A', margin: 0,
    letterSpacing: '-0.01em',
  },
  householdMeta: {
    display: 'flex', alignItems: 'center', gap: '14px',
    marginTop: '6px', flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex', alignItems: 'center', gap: '5px',
    fontSize: '12px', color: '#5B5B5B', fontWeight: 500,
  },
  membersSection: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '18px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
  },
  sectionTitle: {
    fontSize: '15px', fontWeight: 600,
    color: '#1A1A1A', margin: '0 0 14px 0',
    letterSpacing: '-0.01em',
  },
  memberList: {
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  memberCard: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 14px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
  },
  memberAvatar: {
    width: '40px', height: '40px',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: '15px', fontWeight: 700,
    flexShrink: 0,
  },
  memberInfo: { flex: 1, minWidth: 0 },
  memberNameRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  memberName: {
    fontSize: '14px', fontWeight: 600,
    color: '#1A1A1A',
  },
  rolePill: {
    padding: '2px 8px', borderRadius: '999px',
    fontSize: '10px', fontWeight: 600,
  },
  memberJoined: {
    fontSize: '11px', color: '#8A8A8A',
    marginTop: '2px',
  },
  memberActions: {
    display: 'flex', alignItems: 'center', gap: '6px',
    flexShrink: 0,
  },
  roleSelect: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '12px',
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    outline: 'none',
  },
  removeButton: {
    width: '28px', height: '28px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(196, 43, 28, 0.08)',
    border: 'none', color: '#C42B1C',
    borderRadius: '6px', cursor: 'pointer',
  },
  removeButtonDisabled: {
    opacity: 0.6,
    cursor: 'wait',
  },
};
