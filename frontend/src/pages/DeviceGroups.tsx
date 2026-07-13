import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Device {
  id: string;
  name: string;
  type: string;
  brand: string;
  status: string;
}

interface DeviceGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortIndex: number;
  deviceCount: number;
  devices: Device[];
  createdAt: string;
  updatedAt: string;
}

export function DeviceGroups() {
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<DeviceGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#6366F1');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadGroups();
    loadDevices();
  }, []);

  async function loadGroups() {
    try {
      const response = await fetch('/api/device-groups', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setGroups(data);
    } catch {
      console.error('Failed to load groups');
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

  async function createGroup() {
    if (!newGroupName.trim()) return;

    try {
      await fetch('/api/device-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: newGroupName, color: newGroupColor })
      });
      setNewGroupName('');
      setShowCreateModal(false);
      loadGroups();
    } catch {
      console.error('Failed to create group');
    }
  }

  async function updateGroup() {
    if (!currentGroup || !currentGroup.name.trim()) return;

    try {
      await fetch(`/api/device-groups/${currentGroup.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: currentGroup.name, color: currentGroup.color })
      });
      setShowEditModal(false);
      loadGroups();
    } catch {
      console.error('Failed to update group');
    }
  }

  async function deleteGroup(groupId: string) {
    if (!confirm('确定删除这个分组吗？')) return;

    try {
      await fetch(`/api/device-groups/${groupId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      loadGroups();
    } catch {
      console.error('Failed to delete group');
    }
  }

  async function assignDevices() {
    if (!currentGroup || selectedDeviceIds.length === 0) return;

    try {
      await fetch(`/api/device-groups/${currentGroup.id}/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ deviceIds: selectedDeviceIds })
      });
      setSelectedDeviceIds([]);
      setShowAssignModal(false);
      loadGroups();
    } catch {
      console.error('Failed to assign devices');
    }
  }

  async function removeDevice(groupId: string, deviceId: string) {
    try {
      await fetch(`/api/device-groups/${groupId}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      loadGroups();
    } catch {
      console.error('Failed to remove device');
    }
  }

  async function groupAction(groupId: string, action: string) {
    try {
      await fetch(`/api/device-groups/${groupId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ action, params: { power: action === 'on' } })
      });
      loadDevices();
    } catch {
      console.error('Failed to execute group action');
    }
  }

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableColors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#6B7280'];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>设备分组</h1>
        <p style={styles.subtitle}>按功能、区域或项目自定义设备分组，实现批量管理</p>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索分组..."
            style={styles.searchInput}
          />
        </div>
        <button
          style={styles.createBtn}
          onClick={() => setShowCreateModal(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          创建分组
        </button>
      </div>

      <div style={styles.groupsGrid}>
        {filteredGroups.length === 0 ? (
          <div style={styles.emptyState}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <p style={styles.emptyText}>暂无设备分组</p>
            <p style={styles.emptySubText}>点击上方按钮创建您的第一个分组</p>
          </div>
        ) : (
          filteredGroups.map(group => (
            <div key={group.id} style={{ ...styles.groupCard, borderLeftColor: group.color }}>
              <div style={styles.groupHeader}>
                <div style={{ ...styles.groupIcon, background: `${group.color}20`, color: group.color }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div style={styles.groupInfo}>
                  <h3 style={styles.groupName}>{group.name}</h3>
                  <span style={styles.deviceCount}>{group.deviceCount} 台设备</span>
                </div>
                <div style={styles.groupActions}>
                  <button
                    style={styles.actionBtn}
                    onClick={() => { setCurrentGroup(group); setShowAssignModal(true); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                  </button>
                  <button
                    style={styles.actionBtn}
                    onClick={() => { setCurrentGroup(group); setShowEditModal(true); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    style={{ ...styles.actionBtn, color: '#EF4444' }}
                    onClick={() => deleteGroup(group.id)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              {group.deviceCount > 0 && (
                <>
                  <div style={styles.deviceList}>
                    {group.devices.slice(0, 5).map(device => (
                      <div key={device.id} style={styles.deviceItem}>
                        <div style={styles.deviceStatusDot} className={device.status} />
                        <span style={styles.deviceName}>{device.name}</span>
                        <button
                          style={styles.removeDeviceBtn}
                          onClick={() => removeDevice(group.id, device.id)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {group.deviceCount > 5 && (
                      <span style={styles.moreDevices}>+{group.deviceCount - 5} 更多</span>
                    )}
                  </div>

                  <div style={styles.groupActionsBar}>
                    <button
                      style={{ ...styles.actionBtnSecondary, color: '#10B981' }}
                      onClick={() => groupAction(group.id, 'on')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      全部开启
                    </button>
                    <button
                      style={{ ...styles.actionBtnSecondary, color: '#6B7280' }}
                      onClick={() => groupAction(group.id, 'off')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a10 10 0 1 0 10 10H2a10 10 0 1 0 10-10z" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      全部关闭
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>创建设备分组</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowCreateModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>分组名称</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="输入分组名称"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>分组颜色</label>
                <div style={styles.colorPicker}>
                  {availableColors.map(color => (
                    <button
                      key={color}
                      style={{ ...styles.colorOption, background: color, borderColor: newGroupColor === color ? '#1F2937' : 'transparent' }}
                      onClick={() => setNewGroupColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={() => setShowCreateModal(false)}>取消</button>
              <button style={styles.modalConfirmBtn} onClick={createGroup} disabled={!newGroupName.trim()}>创建</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && currentGroup && (
        <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>编辑分组</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowEditModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>分组名称</label>
                <input
                  type="text"
                  value={currentGroup.name}
                  onChange={(e) => setCurrentGroup({ ...currentGroup, name: e.target.value })}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>分组颜色</label>
                <div style={styles.colorPicker}>
                  {availableColors.map(color => (
                    <button
                      key={color}
                      style={{ ...styles.colorOption, background: color, borderColor: currentGroup.color === color ? '#1F2937' : 'transparent' }}
                      onClick={() => setCurrentGroup({ ...currentGroup, color })}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={() => setShowEditModal(false)}>取消</button>
              <button style={styles.modalConfirmBtn} onClick={updateGroup} disabled={!currentGroup.name.trim()}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && currentGroup && (
        <div style={styles.modalOverlay} onClick={() => setShowAssignModal(false)}>
          <div style={{ ...styles.modalCard, maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>为「{currentGroup.name}」分配设备</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowAssignModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ ...styles.modalBody, overflowY: 'auto', maxHeight: '400px' }}>
              <div style={styles.deviceCheckboxes}>
                {devices.map(device => (
                  <label key={device.id} style={styles.deviceCheckboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedDeviceIds.includes(device.id) || currentGroup.devices.some(d => d.id === device.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDeviceIds([...selectedDeviceIds, device.id]);
                        } else {
                          setSelectedDeviceIds(selectedDeviceIds.filter(id => id !== device.id));
                        }
                      }}
                      disabled={currentGroup.devices.some(d => d.id === device.id)}
                      style={styles.checkboxInput}
                    />
                    <div style={styles.deviceCheckboxInfo}>
                      <div style={styles.deviceStatusDot} className={device.status} />
                      <span style={styles.deviceCheckboxName}>{device.name}</span>
                      <span style={styles.deviceCheckboxType}>{device.type}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={() => setShowAssignModal(false)}>取消</button>
              <button style={styles.modalConfirmBtn} onClick={assignDevices} disabled={selectedDeviceIds.length === 0}>
                分配 {selectedDeviceIds.length} 台设备
              </button>
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
    maxWidth: '1200px',
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
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    background: '#F3F4F6',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#6B7280',
    width: '250px'
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    marginLeft: '8px',
    fontSize: '14px',
    outline: 'none'
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
  groupsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
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
    color: '#6B7280'
  },
  groupCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    borderLeft: '4px solid #6366F1',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px'
  },
  groupIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  groupInfo: {
    flex: 1,
    marginLeft: '12px'
  },
  groupName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1F2937',
    margin: 0
  },
  deviceCount: {
    fontSize: '13px',
    color: '#6B7280'
  },
  groupActions: {
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
  actionBtnSecondary: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: '#F3F4F6',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  deviceList: {
    background: '#F9FAFB',
    borderRadius: '8px',
    padding: '12px'
  },
  deviceItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #E5E7EB',
    position: 'relative'
  },
  deviceItemLast: {
    borderBottom: 'none'
  },
  deviceStatusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginRight: '8px',
    flexShrink: 0
  },
  deviceStatusDotOnline: {
    background: '#10B981'
  },
  deviceStatusDotOffline: {
    background: '#EF4444'
  },
  deviceName: {
    flex: 1,
    fontSize: '14px',
    color: '#374151'
  },
  removeDeviceBtn: {
    background: 'none',
    border: 'none',
    color: '#9CA3AF',
    cursor: 'pointer',
    padding: '4px'
  },
  moreDevices: {
    display: 'block',
    textAlign: 'center',
    fontSize: '13px',
    color: '#6B7280',
    padding: '8px 0'
  },
  groupActionsBar: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px'
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
  colorPicker: {
    display: 'flex',
    gap: '12px'
  },
  colorOption: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '2px solid',
    cursor: 'pointer'
  },
  deviceCheckboxes: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  deviceCheckboxLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '10px',
    background: '#F9FAFB',
    borderRadius: '8px'
  },
  checkboxInput: {
    width: '18px',
    height: '18px',
    marginRight: '12px'
  },
  deviceCheckboxInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center'
  },
  deviceCheckboxName: {
    marginLeft: '8px',
    fontSize: '14px',
    color: '#374151'
  },
  deviceCheckboxType: {
    marginLeft: '8px',
    fontSize: '13px',
    color: '#6B7280',
    padding: '2px 6px',
    background: '#E5E7EB',
    borderRadius: '4px'
  }
};
