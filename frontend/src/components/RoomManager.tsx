import { useState, useEffect, useCallback } from 'react';
import { Room, Device } from '../types';
import { getRooms, createRoom, updateRoom, deleteRoom, assignDevicesToRoom, getRoomDevices } from '../api';
import { showConfirm } from '../utils/confirm';
import { useDeviceStore } from '../store/deviceStore';

const ROOM_ICONS: { key: string; label: string; svg: JSX.Element }[] = [
  {
    key: 'living',
    label: '客厅',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
        <path d="M3 18h18" />
        <path d="M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
      </svg>
    ),
  },
  {
    key: 'bedroom',
    label: '卧室',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
        <path d="M3 18h18" />
        <path d="M7 10V8a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2" />
      </svg>
    ),
  },
  {
    key: 'kitchen',
    label: '厨房',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="8" y1="3" x2="8" y2="21" />
        <line x1="16" y1="3" x2="16" y2="21" />
        <line x1="4" y1="12" x2="20" y2="12" />
      </svg>
    ),
  },
  {
    key: 'bathroom',
    label: '浴室',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3z" />
        <path d="M7 12V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2" />
        <line x1="6" y1="19" x2="6" y2="21" />
        <line x1="18" y1="19" x2="18" y2="21" />
      </svg>
    ),
  },
  {
    key: 'study',
    label: '书房',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    key: 'office',
    label: '办公室',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="3" y1="9" x2="9" y2="9" />
        <line x1="3" y1="15" x2="9" y2="15" />
      </svg>
    ),
  },
];

function getRoomIcon(icon: string): JSX.Element {
  return ROOM_ICONS.find((i) => i.key === icon)?.svg ?? ROOM_ICONS[0].svg;
}

export function RoomManager() {
  const { devices } = useDeviceStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [roomDeviceMap, setRoomDeviceMap] = useState<Record<string, Device[]>>({});
  const [assigningRoomId, setAssigningRoomId] = useState<string | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', icon: 'living' });

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRooms();
      setRooms(data);
      const deviceMap: Record<string, Device[]> = {};
      await Promise.all(
        data.map(async (room) => {
          try {
            deviceMap[room.id] = await getRoomDevices(room.id);
          } catch {
            deviceMap[room.id] = [];
          }
        })
      );
      setRoomDeviceMap(deviceMap);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  async function handleCreate() {
    if (!form.name) return;
    setSubmitting(true);
    try {
      await createRoom({ name: form.name, icon: form.icon, sortIndex: rooms.length });
      setIsCreating(false);
      setForm({ name: '', icon: 'living' });
      loadRooms();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '创建失败';
      alert('创建房间失败：' + msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate() {
    if (!editingRoom || !form.name) return;
    setSubmitting(true);
    try {
      await updateRoom(editingRoom.id, { name: form.name, icon: form.icon });
      setEditingRoom(null);
      setForm({ name: '', icon: 'living' });
      loadRooms();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '更新失败';
      alert('更新房间失败：' + msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(roomId: string) {
    if (!showConfirm('确定要删除这个房间吗？')) return;
    try {
      await deleteRoom(roomId);
      if (expandedRoomId === roomId) setExpandedRoomId(null);
      loadRooms();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '删除失败';
      alert('删除房间失败：' + msg);
    }
  }

  function openEdit(room: Room) {
    setEditingRoom(room);
    setForm({ name: room.name, icon: room.icon });
  }

  async function handleToggleExpand(room: Room) {
    if (expandedRoomId === room.id) {
      setExpandedRoomId(null);
    } else {
      setExpandedRoomId(room.id);
      try {
        const ds = await getRoomDevices(room.id);
        setRoomDeviceMap((prev) => ({ ...prev, [room.id]: ds }));
      } catch (error) {
        console.error('Failed to load room devices:', error);
      }
    }
  }

  function openAssign(room: Room) {
    setAssigningRoomId(room.id);
    const existing = roomDeviceMap[room.id]?.map((d) => d.id) ?? [];
    setSelectedDeviceIds(existing);
  }

  async function handleAssign() {
    if (!assigningRoomId) return;
    setSubmitting(true);
    try {
      await assignDevicesToRoom(assigningRoomId, selectedDeviceIds);
      const ds = await getRoomDevices(assigningRoomId);
      setRoomDeviceMap((prev) => ({ ...prev, [assigningRoomId]: ds }));
      setAssigningRoomId(null);
    } catch (error) {
      console.error('Failed to assign devices:', error);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleDeviceSelection(deviceId: string) {
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]
    );
  }

  const isModalOpen = isCreating || editingRoom !== null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>房间管理</h2>
          <p style={styles.subtitle}>将设备按房间分组，更便捷地管理您的智能家居</p>
        </div>
        <button
          style={styles.addButton}
          onClick={() => {
            setForm({ name: '', icon: 'living' });
            setIsCreating(true);
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>新建房间</span>
        </button>
      </div>

      {isModalOpen && (
        <div style={styles.modalOverlay} className="anim-fade-in" onClick={() => { setIsCreating(false); setEditingRoom(null); }}>
          <div style={styles.modalContent} className="anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{editingRoom ? '编辑房间' : '创建房间'}</h3>
              <button
                style={styles.closeButton}
                onClick={() => { setIsCreating(false); setEditingRoom(null); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>房间名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                style={styles.formInput}
                placeholder="例如：主卧、儿童房"
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>房间图标</label>
              <div style={styles.iconGrid}>
                {ROOM_ICONS.map((icon) => (
                  <button
                    key={icon.key}
                    style={{
                      ...styles.iconButton,
                      ...(form.icon === icon.key ? styles.iconButtonActive : {}),
                    }}
                    onClick={() => setForm((prev) => ({ ...prev, icon: icon.key }))}
                  >
                    <span style={{ display: 'flex', color: form.icon === icon.key ? '#FFFFFF' : '#005FB8' }}>
                      {icon.svg}
                    </span>
                    <span>{icon.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                style={styles.cancelButton}
                onClick={() => { setIsCreating(false); setEditingRoom(null); }}
              >
                取消
              </button>
              <button
                style={{
                  ...styles.confirmButton,
                  ...(!form.name || submitting ? styles.confirmButtonDisabled : {}),
                }}
                onClick={editingRoom ? handleUpdate : handleCreate}
                disabled={!form.name || submitting}
              >
                {submitting ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : null}
                {editingRoom ? '保存修改' : '创建房间'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assigningRoomId && (
        <div style={styles.modalOverlay} className="anim-fade-in" onClick={() => setAssigningRoomId(null)}>
          <div style={styles.modalContent} className="anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>分配设备到房间</h3>
              <button style={styles.closeButton} onClick={() => setAssigningRoomId(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p style={styles.assignHint}>勾选要分配到该房间的设备</p>
            <div style={styles.deviceList}>
              {devices.length === 0 ? (
                <div style={styles.emptyActions}>暂无可用设备</div>
              ) : (
                devices.map((device) => {
                  const selected = selectedDeviceIds.includes(device.id);
                  return (
                    <label key={device.id} style={styles.deviceCheckRow}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleDeviceSelection(device.id)}
                        style={styles.checkbox}
                      />
                      <span style={styles.deviceCheckName}>{device.name}</span>
                      <span style={styles.deviceCheckMeta}>{device.type}</span>
                    </label>
                  );
                })
              )}
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setAssigningRoomId(null)}>取消</button>
              <button
                style={{ ...styles.confirmButton, ...(submitting ? styles.confirmButtonDisabled : {}) }}
                onClick={handleAssign}
                disabled={submitting}
              >
                {submitting ? '保存中...' : '保存分配'}
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
          <div style={styles.loadingText}>加载房间中...</div>
        </div>
      ) : rooms.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div style={styles.emptyTitle}>暂无房间</div>
          <div style={styles.emptyDesc}>创建房间以更好地组织您的设备</div>
        </div>
      ) : (
        <div style={styles.roomGrid}>
          {rooms.map((room) => {
            const roomDevices = roomDeviceMap[room.id] ?? [];
            const isExpanded = expandedRoomId === room.id;
            return (
              <div key={room.id} style={styles.roomCard} className="anim-slide-up">
                <div style={styles.roomCardHeader} onClick={() => handleToggleExpand(room)}>
                  <div style={styles.roomIconWrap}>
                    <span style={{ color: '#005FB8', display: 'flex' }}>{getRoomIcon(room.icon)}</span>
                  </div>
                  <div style={styles.roomInfo}>
                    <h3 style={styles.roomName}>{room.name}</h3>
                    <div style={styles.roomMeta}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                      <span>{roomDevices.length} 个设备</span>
                    </div>
                  </div>
                  <div style={styles.roomActions}>
                    <button
                      style={styles.iconActionButton}
                      title="分配设备"
                      onClick={(e) => { e.stopPropagation(); openAssign(room); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <button
                      style={styles.iconActionButton}
                      title="编辑"
                      onClick={(e) => { e.stopPropagation(); openEdit(room); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                    <button
                      style={{ ...styles.iconActionButton, color: '#C42B1C' }}
                      title="删除"
                      onClick={(e) => { e.stopPropagation(); handleDelete(room.id); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={styles.roomDevices} className="anim-fade-in">
                    {roomDevices.length === 0 ? (
                      <div style={styles.roomEmptyDevices}>
                        此房间暂无设备，点击 + 分配
                      </div>
                    ) : (
                      roomDevices.map((device) => (
                        <div key={device.id} style={styles.roomDeviceRow}>
                          <div style={styles.deviceDot} />
                          <span style={styles.roomDeviceName}>{device.name}</span>
                          <span style={styles.roomDeviceType}>{device.type}</span>
                          <span
                            style={{
                              ...styles.statusPill,
                              ...(device.status === 'online' ? styles.statusOnline : styles.statusOffline),
                            }}
                          >
                            {device.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
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
    width: '520px',
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
  iconGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  iconButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '12px 8px',
    background: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
  },
  iconButtonActive: {
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
  assignHint: {
    fontSize: '12px', color: '#8A8A8A',
    margin: '0 0 12px 0',
  },
  deviceList: {
    display: 'flex', flexDirection: 'column', gap: '6px',
    maxHeight: '320px', overflowY: 'auto',
  },
  deviceCheckRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px',
    background: 'rgba(0, 0, 0, 0.03)',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px', height: '16px',
    accentColor: '#005FB8',
    cursor: 'pointer',
  },
  deviceCheckName: {
    flex: 1, fontSize: '13px',
    fontWeight: 500, color: '#1A1A1A',
  },
  deviceCheckMeta: {
    fontSize: '11px', color: '#8A8A8A',
  },
  loadingState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '80px 24px',
  },
  loadingText: {
    marginTop: '12px', fontSize: '13px',
    color: '#5B5B5B',
  },
  emptyState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '80px 24px',
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
  emptyDesc: { fontSize: '13px', color: '#8A8A8A' },
  roomGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '14px',
  },
  roomCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    display: 'flex', flexDirection: 'column',
  },
  roomCardHeader: {
    display: 'flex', gap: '12px', alignItems: 'center',
    cursor: 'pointer',
  },
  roomIconWrap: {
    width: '44px', height: '44px',
    borderRadius: '8px',
    background: 'rgba(0, 95, 184, 0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  roomInfo: { flex: 1, minWidth: 0 },
  roomName: {
    fontSize: '15px', fontWeight: 600,
    color: '#1A1A1A', margin: 0,
    letterSpacing: '-0.01em',
  },
  roomMeta: {
    display: 'flex', alignItems: 'center', gap: '5px',
    marginTop: '4px',
    fontSize: '12px', color: '#5B5B5B', fontWeight: 500,
  },
  roomActions: {
    display: 'flex', gap: '4px',
  },
  iconActionButton: {
    width: '32px', height: '32px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none', color: '#5B5B5B',
    borderRadius: '6px', cursor: 'pointer',
  },
  roomDevices: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  roomEmptyDevices: {
    padding: '16px',
    textAlign: 'center',
    fontSize: '12px', color: '#8A8A8A',
    background: 'rgba(0, 0, 0, 0.03)',
    borderRadius: '6px',
  },
  roomDeviceRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 10px',
    background: 'rgba(0, 0, 0, 0.03)',
    borderRadius: '6px',
  },
  deviceDot: {
    width: '6px', height: '6px', borderRadius: '50%',
    background: '#107C10',
    flexShrink: 0,
  },
  roomDeviceName: {
    flex: 1, fontSize: '13px',
    fontWeight: 500, color: '#1A1A1A',
  },
  roomDeviceType: {
    fontSize: '11px', color: '#8A8A8A',
  },
  statusPill: {
    padding: '2px 8px', borderRadius: '999px',
    fontSize: '11px', fontWeight: 500,
  },
  statusOnline: {
    background: 'rgba(16, 124, 16, 0.08)',
    color: '#107C10',
  },
  statusOffline: {
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
  },
  emptyActions: {
    padding: '24px', textAlign: 'center',
    fontSize: '12px', color: '#8A8A8A',
    background: 'rgba(0, 0, 0, 0.03)',
    borderRadius: '6px',
  },
};
