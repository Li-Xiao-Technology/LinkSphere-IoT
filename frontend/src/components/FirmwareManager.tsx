import { useState, useEffect } from 'react';
import { showConfirm } from '../utils/confirm';
import {
  getFirmwareVersions,
  createFirmwareVersion,
  updateFirmwareVersion,
  deleteFirmwareVersion,
  installFirmware,
  FirmwareVersion,
} from '../api';
import { getDevices } from '../api';
import { Device } from '../types';

type FirmwareStatus = 'available' | 'downloading' | 'installed' | 'failed';

const STATUS_META: Record<FirmwareStatus, { label: string; color: string; bg: string }> = {
  available: { label: '可用', color: '#005FB8', bg: 'rgba(0, 95, 184, 0.1)' },
  downloading: { label: '下载中', color: '#8A5A00', bg: 'rgba(255, 140, 0, 0.12)' },
  installed: { label: '已安装', color: '#107C10', bg: 'rgba(16, 124, 16, 0.1)' },
  failed: { label: '失败', color: '#C42B1C', bg: 'rgba(196, 43, 28, 0.1)' },
};

const STATUS_OPTIONS: FirmwareStatus[] = ['available', 'downloading', 'installed', 'failed'];

interface FormState {
  deviceId: string;
  version: string;
  changelog: string;
  fileSize: string;
}

const EMPTY_FORM: FormState = { deviceId: '', version: '', changelog: '', fileSize: '' };

function formatSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('zh-CN');
}

export function FirmwareManager() {
  const [firmware, setFirmware] = useState<FirmwareVersion[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editStatus, setEditStatus] = useState<FirmwareStatus>('available');
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [fwList, devList] = await Promise.all([getFirmwareVersions(), getDevices()]);
      setFirmware(fwList);
      setDevices(devList);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载固件数据失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const deviceNameMap = new Map<string, string>();
  for (const d of devices) deviceNameMap.set(d.id, d.name);

  const groupedByDevice = new Map<string, { deviceName: string; items: FirmwareVersion[] }>();
  for (const fw of firmware) {
    const name = deviceNameMap.get(fw.deviceId) || '未知设备';
    if (!groupedByDevice.has(fw.deviceId)) {
      groupedByDevice.set(fw.deviceId, { deviceName: name, items: [] });
    }
    groupedByDevice.get(fw.deviceId)!.items.push(fw);
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, deviceId: devices[0]?.id || '' });
    setEditingId(null);
    setEditStatus('available');
    setError('');
    setShowModal(true);
  }

  function openEdit(fw: FirmwareVersion) {
    setForm({
      deviceId: fw.deviceId,
      version: fw.version,
      changelog: fw.changelog || '',
      fileSize: fw.fileSize != null ? String(fw.fileSize) : '',
    });
    setEditingId(fw.id);
    setEditStatus((fw.status as FirmwareStatus) || 'available');
    setError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleSubmit() {
    setError('');
    if (!form.deviceId) {
      setError('请选择设备');
      return;
    }
    if (!form.version.trim()) {
      setError('请输入版本号');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        const result = await updateFirmwareVersion(editingId, {
          version: form.version.trim(),
          changelog: form.changelog || undefined,
          status: editStatus,
        });
        if (!result) {
          setError('更新失败，请检查网络或重新登录后重试');
          return;
        }
      } else {
        const result = await createFirmwareVersion({
          deviceId: form.deviceId,
          version: form.version.trim(),
          changelog: form.changelog || undefined,
          fileSize: form.fileSize ? Number(form.fileSize) : undefined,
        });
        if (!result) {
          setError('创建失败，请检查网络或重新登录后重试');
          return;
        }
      }
      closeModal();
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败，请检查网络';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInstall(fw: FirmwareVersion) {
    setActingId(fw.id);
    try {
      const result = await installFirmware(fw.id);
      if (result && result.success) {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to install firmware:', err);
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(fw: FirmwareVersion) {
    if (!showConfirm(`确定要删除固件版本 ${fw.version} 吗？`)) return;
    setActingId(fw.id);
    try {
      const result = await deleteFirmwareVersion(fw.id);
      if (result.success) {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to delete firmware:', err);
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <div style={styles.loadingState}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <div style={styles.loadingText}>加载固件数据中...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>固件管理</h2>
          <p style={styles.subtitle}>管理设备固件版本、状态与安装</p>
        </div>
        <button style={styles.addButton} onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新增固件
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {firmware.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div style={styles.emptyTitle}>暂无固件版本</div>
          <div style={styles.emptyDesc}>点击「新增固件」为设备添加固件版本记录</div>
        </div>
      ) : (
        <div style={styles.deviceGroups}>
          {Array.from(groupedByDevice.entries()).map(([deviceId, group]) => (
            <div key={deviceId} style={styles.card}>
              <div style={styles.deviceHeader}>
                <div style={styles.deviceIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={styles.deviceName}>{group.deviceName}</h3>
                  <div style={styles.deviceMeta}>{group.items.length} 个固件版本 · {deviceId.slice(0, 12)}</div>
                </div>
              </div>
              <div style={styles.fwList}>
                {group.items.map((fw) => {
                  const status = (fw.status as FirmwareStatus) || 'available';
                  const meta = STATUS_META[status] || STATUS_META.available;
                  const isActing = actingId === fw.id;
                  return (
                    <div key={fw.id} style={styles.fwCard} className="anim-slide-up">
                      <div style={styles.fwMain}>
                        <div style={styles.fwVersionRow}>
                          <span style={styles.fwVersion}>v{fw.version}</span>
                          <span style={{ ...styles.statusBadge, color: meta.color, background: meta.bg }}>{meta.label}</span>
                        </div>
                        {fw.changelog && <div style={styles.fwChangelog}>{fw.changelog}</div>}
                        <div style={styles.fwMeta}>
                          <span style={styles.fwMetaItem}>大小: {formatSize(fw.fileSize)}</span>
                          {fw.createdAt && <span style={styles.fwMetaItem}>发布于 {formatTime(fw.createdAt)}</span>}
                        </div>
                      </div>
                      <div style={styles.fwActions}>
                        <button
                          style={{ ...styles.installButton, ...(status === 'installed' ? styles.installButtonDone : {}), ...(isActing ? styles.actionDisabled : {}) }}
                          onClick={() => handleInstall(fw)}
                          disabled={isActing || status === 'installed'}
                          title={status === 'installed' ? '已安装' : '标记为已安装'}
                        >
                          {isActing ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                          ) : status === 'installed' ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          )}
                          {status === 'installed' ? '已安装' : '安装'}
                        </button>
                        <button style={{ ...styles.iconButton, ...(isActing ? styles.actionDisabled : {}) }} onClick={() => openEdit(fw)} disabled={isActing} title="编辑">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button style={{ ...styles.iconButtonDanger, ...(isActing ? styles.actionDisabled : {}) }} onClick={() => handleDelete(fw)} disabled={isActing} title="删除">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={styles.modalOverlay} className="anim-fade-in" onClick={closeModal}>
          <div style={styles.modalContent} className="anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{editingId ? '编辑固件' : '新增固件'}</h3>
              <button style={styles.closeButton} onClick={closeModal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {error && <div style={styles.formError}>{error}</div>}
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>设备</label>
              <select
                value={form.deviceId}
                onChange={(e) => setForm((prev) => ({ ...prev, deviceId: e.target.value }))}
                style={styles.formInput}
                disabled={!!editingId}
              >
                <option value="">请选择设备</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>版本号</label>
              <input
                type="text"
                value={form.version}
                onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
                style={styles.formInput}
                placeholder="例如 1.2.0"
                autoFocus
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>更新日志</label>
              <textarea
                value={form.changelog}
                onChange={(e) => setForm((prev) => ({ ...prev, changelog: e.target.value }))}
                style={styles.formTextarea}
                placeholder="本次更新的内容说明"
                rows={4}
              />
            </div>
            {!editingId && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>文件大小（字节）</label>
                <input
                  type="number"
                  value={form.fileSize}
                  onChange={(e) => setForm((prev) => ({ ...prev, fileSize: e.target.value }))}
                  style={styles.formInput}
                  placeholder="可选，例如 1048576"
                />
              </div>
            )}
            {editingId && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>状态</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as FirmwareStatus)}
                  style={styles.formInput}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={closeModal}>取消</button>
              <button
                style={{ ...styles.confirmButton, ...(!form.version || submitting ? styles.confirmButtonDisabled : {}) }}
                onClick={handleSubmit}
                disabled={!form.version || submitting}
              >
                {submitting ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : null}
                {submitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
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
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
  },
  errorBox: {
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
    border: '1px solid rgba(196, 43, 28, 0.15)',
  },
  deviceGroups: {
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
    padding: '18px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
  },
  deviceHeader: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '14px',
    paddingBottom: '14px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  deviceIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(0, 95, 184, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  deviceName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  deviceMeta: {
    fontSize: '12px',
    color: '#8A8A8A',
    marginTop: '2px',
  },
  fwList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  fwCard: {
    display: 'flex',
    gap: '14px',
    alignItems: 'center',
    padding: '12px 14px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
  },
  fwMain: {
    flex: 1,
    minWidth: 0,
  },
  fwVersionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  fwVersion: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#1A1A1A',
  },
  statusBadge: {
    padding: '2px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
  },
  fwChangelog: {
    fontSize: '12.5px',
    color: '#5B5B5B',
    marginTop: '6px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  fwMeta: {
    display: 'flex',
    gap: '14px',
    marginTop: '6px',
    flexWrap: 'wrap',
  },
  fwMetaItem: {
    fontSize: '11px',
    color: '#8A8A8A',
  },
  fwActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  installButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '7px 12px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: '1px solid rgba(0, 95, 184, 0.15)',
    color: '#005FB8',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
  },
  installButtonDone: {
    background: 'rgba(16, 124, 16, 0.08)',
    borderColor: 'rgba(16, 124, 16, 0.2)',
    color: '#107C10',
    cursor: 'default',
  },
  iconButton: {
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none',
    color: '#5B5B5B',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  iconButtonDanger: {
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(196, 43, 28, 0.08)',
    border: 'none',
    color: '#C42B1C',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  actionDisabled: {
    opacity: 0.6,
    cursor: 'wait',
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
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '13px',
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.6)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  formTextarea: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '13px',
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.6)',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: 'inherit',
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
    borderRadius: '8px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 500,
  },
  confirmButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '9px 20px',
    background: '#005FB8',
    border: 'none', color: '#FFFFFF',
    borderRadius: '8px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
  },
  confirmButtonDisabled: {
    background: '#B0B0B0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  loadingState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '80px 24px',
  },
  loadingText: {
    marginTop: '12px', fontSize: '13px', color: '#5B5B5B',
  },
};
