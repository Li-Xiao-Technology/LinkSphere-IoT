import { useState, useEffect } from 'react';

interface Organization {
  id: string;
  name: string;
  description: string | null;
  type: string;
  parentId: string | null;
  ownerId: string;
  memberCount: number;
  childrenCount: number;
  members: { userId: string; role: string; joinedAt: string }[];
  children: { id: string; name: string; type: string; memberCount: number; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

interface OrgMember {
  userId: string;
  username: string;
  email: string | null;
  role: string;
  joinedAt: string;
}

export function OrganizationManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [newOrg, setNewOrg] = useState({ name: '', description: '', type: 'company', parentId: '' });
  const [newMember, setNewMember] = useState({ userId: '', role: 'member' });

  useEffect(() => {
    loadOrganizations();
  }, []);

  async function loadOrganizations() {
    try {
      const response = await fetch('/api/organizations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setOrganizations(data);
    } catch {
      console.error('Failed to load organizations');
    }
  }

  async function loadOrgMembers(orgId: string) {
    try {
      const response = await fetch(`/api/organizations/${orgId}/members`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setOrgMembers(data.members);
    } catch {
      console.error('Failed to load organization members');
    }
  }

  async function createOrganization() {
    if (!newOrg.name) return;

    try {
      await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: newOrg.name,
          description: newOrg.description,
          type: newOrg.type,
          parentId: newOrg.parentId || null
        })
      });
      setShowCreateModal(false);
      setNewOrg({ name: '', description: '', type: 'company', parentId: '' });
      loadOrganizations();
    } catch {
      console.error('Failed to create organization');
    }
  }

  async function addMember() {
    if (!newMember.userId || !selectedOrg) return;

    try {
      await fetch(`/api/organizations/${selectedOrg.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newMember)
      });
      setNewMember({ userId: '', role: 'member' });
      loadOrgMembers(selectedOrg.id);
    } catch {
      console.error('Failed to add member');
    }
  }

  async function updateMemberRole(memberId: string, role: string) {
    if (!selectedOrg) return;

    try {
      await fetch(`/api/organizations/${selectedOrg.id}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ role })
      });
      loadOrgMembers(selectedOrg.id);
    } catch {
      console.error('Failed to update member role');
    }
  }

  async function removeMember(memberId: string) {
    if (!selectedOrg || !confirm('确定移除该成员吗？')) return;

    try {
      await fetch(`/api/organizations/${selectedOrg.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      loadOrgMembers(selectedOrg.id);
    } catch {
      console.error('Failed to remove member');
    }
  }

  async function deleteOrganization(orgId: string) {
    if (!confirm('确定删除该组织吗？')) return;

    try {
      await fetch(`/api/organizations/${orgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      loadOrganizations();
    } catch {
      console.error('Failed to delete organization');
    }
  }

  const orgTypes = [
    { value: 'company', label: '公司', color: '#6366F1' },
    { value: 'department', label: '部门', color: '#10B981' },
    { value: 'project', label: '项目', color: '#F59E0B' }
  ];

  const getOrgTypeInfo = (type: string) => {
    return orgTypes.find(t => t.value === type) || orgTypes[0];
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>组织管理</h1>
          <p style={styles.subtitle}>管理公司、部门和项目层级结构</p>
        </div>
        <button
          style={styles.createBtn}
          onClick={() => setShowCreateModal(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          创建组织
        </button>
      </div>

      <div style={styles.orgTree}>
        {organizations.length === 0 ? (
          <div style={styles.emptyState}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p style={styles.emptyText}>暂无组织</p>
            <p style={styles.emptySubText}>点击上方按钮创建您的第一个组织</p>
          </div>
        ) : (
          <div style={styles.orgList}>
            {organizations.map(org => (
              <div key={org.id} style={styles.orgCard}>
                <div style={styles.orgHeader}>
                  <div style={{ ...styles.orgIcon, background: `${getOrgTypeInfo(org.type).color}20`, color: getOrgTypeInfo(org.type).color }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                  <div style={styles.orgInfo}>
                    <h3 style={styles.orgName}>{org.name}</h3>
                    <div style={styles.orgMeta}>
                      <span style={{ ...styles.typeBadge, background: `${getOrgTypeInfo(org.type).color}20`, color: getOrgTypeInfo(org.type).color }}>
                        {getOrgTypeInfo(org.type).label}
                      </span>
                      <span style={styles.memberCount}>{org.memberCount} 名成员</span>
                      {org.childrenCount > 0 && <span style={styles.childCount}>{org.childrenCount} 个子组织</span>}
                    </div>
                  </div>
                  <div style={styles.orgActions}>
                    <button
                      style={styles.actionBtn}
                      onClick={() => { setSelectedOrg(org); loadOrgMembers(org.id); setShowMemberModal(true); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                      </svg>
                    </button>
                    <button
                      style={{ ...styles.actionBtn, color: '#EF4444' }}
                      onClick={() => deleteOrganization(org.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                {org.childrenCount > 0 && org.children.length > 0 && (
                  <div style={styles.childOrgs}>
                    {org.children.map(child => (
                      <div key={child.id} style={styles.childOrgCard}>
                        <div style={{ ...styles.childOrgIcon, background: `${getOrgTypeInfo(child.type).color}20`, color: getOrgTypeInfo(child.type).color }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                          </svg>
                        </div>
                        <span style={styles.childOrgName}>{child.name}</span>
                        <span style={{ ...styles.typeBadgeSmall, background: `${getOrgTypeInfo(child.type).color}20`, color: getOrgTypeInfo(child.type).color }}>
                          {getOrgTypeInfo(child.type).label}
                        </span>
                        <span style={styles.childMemberCount}>{child.memberCount} 人</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>创建组织</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowCreateModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>组织名称</label>
                <input
                  type="text"
                  value={newOrg.name}
                  onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                  placeholder="输入组织名称"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>组织类型</label>
                <div style={styles.typeSelector}>
                  {orgTypes.map(type => (
                    <button
                      key={type.value}
                      style={{ ...styles.typeOption, borderColor: newOrg.type === type.value ? type.color : '#E5E7EB', background: newOrg.type === type.value ? `${type.color}10` : 'white' }}
                      onClick={() => setNewOrg({ ...newOrg, type: type.value })}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>上级组织</label>
                <select value={newOrg.parentId} onChange={(e) => setNewOrg({ ...newOrg, parentId: e.target.value })} style={styles.formInput}>
                  <option value="">无（顶级组织）</option>
                  {organizations.filter(o => o.type === 'company').map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>描述</label>
                <textarea
                  value={newOrg.description}
                  onChange={(e) => setNewOrg({ ...newOrg, description: e.target.value })}
                  rows={3}
                  placeholder="输入组织描述"
                  style={{ ...styles.formInput, minHeight: '80px' }}
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={() => setShowCreateModal(false)}>取消</button>
              <button style={styles.modalConfirmBtn} onClick={createOrganization} disabled={!newOrg.name}>创建</button>
            </div>
          </div>
        </div>
      )}

      {showMemberModal && selectedOrg && (
        <div style={styles.modalOverlay} onClick={() => setShowMemberModal(false)}>
          <div style={{ ...styles.modalCard, maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{selectedOrg.name} - 成员管理</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowMemberModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ ...styles.modalBody, overflowY: 'auto', maxHeight: '500px' }}>
              <div style={styles.addMemberSection}>
                <h4 style={styles.addMemberTitle}>添加成员</h4>
                <div style={styles.addMemberForm}>
                  <input
                    type="text"
                    value={newMember.userId}
                    onChange={(e) => setNewMember({ ...newMember, userId: e.target.value })}
                    placeholder="输入用户ID"
                    style={styles.memberInput}
                  />
                  <select value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })} style={styles.roleSelect}>
                    <option value="admin">管理员</option>
                    <option value="member">成员</option>
                    <option value="viewer">查看者</option>
                  </select>
                  <button style={styles.addMemberBtn} onClick={addMember} disabled={!newMember.userId}>添加</button>
                </div>
              </div>

              <div style={styles.membersList}>
                <h4 style={styles.membersTitle}>成员列表 ({orgMembers.length})</h4>
                {orgMembers.length === 0 ? (
                  <div style={styles.emptyMembers}>
                    <span>暂无成员</span>
                  </div>
                ) : (
                  <div style={styles.membersTable}>
                    {orgMembers.map((member, index) => (
                      <div key={index} style={styles.memberRow}>
                        <div style={styles.memberInfo}>
                          <div style={styles.memberIcon}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </div>
                          <div>
                            <span style={styles.memberName}>{member.username}</span>
                            <span style={styles.memberEmail}>{member.email}</span>
                          </div>
                        </div>
                        <select
                          value={member.role}
                          onChange={(e) => updateMemberRole(member.userId, e.target.value)}
                          style={styles.roleSelectSmall}
                        >
                          <option value="admin">管理员</option>
                          <option value="member">成员</option>
                          <option value="viewer">查看者</option>
                        </select>
                        <button
                          style={styles.removeMemberBtn}
                          onClick={() => removeMember(member.userId)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={() => setShowMemberModal(false)}>关闭</button>
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
    maxWidth: '1000px',
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
  createBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  orgTree: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  emptyState: {
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
    color: '#6B7280'
  },
  orgList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  orgCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  orgHeader: {
    display: 'flex',
    alignItems: 'center'
  },
  orgIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  orgInfo: {
    flex: 1,
    marginLeft: '16px'
  },
  orgName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1F2937',
    margin: 0
  },
  orgMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '8px'
  },
  typeBadge: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 500
  },
  typeBadgeSmall: {
    fontSize: '11px',
    padding: '1px 6px',
    borderRadius: '3px',
    fontWeight: 500
  },
  memberCount: {
    fontSize: '13px',
    color: '#6B7280'
  },
  childCount: {
    fontSize: '13px',
    color: '#6B7280'
  },
  orgActions: {
    display: 'flex',
    gap: '8px'
  },
  actionBtn: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F3F4F6',
    border: 'none',
    borderRadius: '6px',
    color: '#6B7280',
    cursor: 'pointer'
  },
  childOrgs: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '16px',
    paddingLeft: '64px',
    borderLeft: '2px solid #E5E7EB'
  },
  childOrgCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px',
    background: '#F9FAFB',
    borderRadius: '8px'
  },
  childOrgIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  childOrgName: {
    flex: 1,
    fontSize: '14px',
    color: '#374151'
  },
  childMemberCount: {
    fontSize: '12px',
    color: '#6B7280'
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
    maxWidth: '520px',
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
  typeSelector: {
    display: 'flex',
    gap: '8px'
  },
  typeOption: {
    padding: '8px 16px',
    border: '2px solid',
    borderRadius: '8px',
    background: 'white',
    cursor: 'pointer',
    fontSize: '13px'
  },
  addMemberSection: {
    marginBottom: '24px'
  },
  addMemberTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    margin: 0,
    marginBottom: '12px'
  },
  addMemberForm: {
    display: 'flex',
    gap: '8px'
  },
  memberInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none'
  },
  roleSelect: {
    padding: '8px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none'
  },
  addMemberBtn: {
    padding: '8px 16px',
    background: '#6366F1',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer'
  },
  membersList: {
    marginTop: '20px'
  },
  membersTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    margin: 0,
    marginBottom: '12px'
  },
  emptyMembers: {
    padding: '20px',
    background: '#F9FAFB',
    borderRadius: '8px',
    textAlign: 'center',
    color: '#6B7280'
  },
  membersTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    background: '#F9FAFB',
    borderRadius: '8px'
  },
  memberInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  memberIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: '#EEF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  memberName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    display: 'block'
  },
  memberEmail: {
    fontSize: '12px',
    color: '#6B7280'
  },
  roleSelectSmall: {
    padding: '6px 10px',
    border: '1px solid #D1D5DB',
    borderRadius: '4px',
    fontSize: '12px',
    outline: 'none'
  },
  removeMemberBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px'
  }
};
