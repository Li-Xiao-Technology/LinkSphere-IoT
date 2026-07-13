import { useState, useEffect, useCallback } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import {
  AlertThreshold,
  getThresholds,
  createThreshold,
  updateThreshold,
  deleteThreshold,
} from '../api';
import { showConfirm } from '../utils/confirm';

interface FormState {
  deviceId: string;
  property: string;
  minValue: string;
  maxValue: string;
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  deviceId: '',
  property: '',
  minValue: '',
  maxValue: '',
  enabled: true,
};

export function AlertThresholdManager() {
  const { devices, loadDevices } = useDeviceStore();
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadThresholds = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getThresholds();
      setThresholds(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载阈值配置失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThresholds();
    if (devices.length === 0) loadDevices();
  }, [loadThresholds, devices.length, loadDevices]);

  const deviceNameMap = new Map(devices.map((d) => [d.id, d.name]));

  // 按设备分组
  const grouped = thresholds.reduce((acc, t) => {
    const key = t.deviceId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, AlertThreshold[]>);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError('');
    setIsEditing(true);
  }

  function openEdit(threshold: AlertThreshold) {
    setForm({
      deviceId: threshold.deviceId,
      property: threshold.property,
      minValue: threshold.minValue !== null && threshold.minValue !== undefined ? String(threshold.minValue) : '',
      maxValue: threshold.maxValue !== null && threshold.maxValue !== undefined ? String(threshold.maxValue) : '',
      enabled: threshold.enabled,
    });
    setEditingId(threshold.id);
    setFormError('');
    setIsEditing(true);
  }

  async function handleSubmit() {
    setFormError('');
    if (!form.deviceId) {
      setFormError('请选择设备');
      return;
    }
    if (!form.property.trim()) {
      setFormError('请输入属性名称');
      return;
    }
    if (!form.minValue && !form.maxValue) {
      setFormError('请至少填写最小值或最大值其中之一');
      return;
    }

    const minValue = form.minValue.trim() ? Number(form.minValue) : null;
    const maxValue = form.maxValue.trim() ? Number(form.maxValue) : null;

    if (minValue !== null && isNaN(minValue)) {
      setFormError('最小值必须是数字');
      return;
    }
    if (maxValue !== null && isNaN(maxValue)) {
      setFormError('最大值必须是数字');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        deviceId: form.deviceId,
        property: form.property.trim(),
        minValue,
        maxValue,
        enabled: form.enabled,
      };
      if (editingId) {
        await updateThreshold(editingId, {
          property: payload.property,
          minValue: payload.minValue,
          maxValue: payload.maxValue,
          enabled: payload.enabled,
        });
      } else {
        await createThreshold(payload);
      }
      setIsEditing(false);
      loadThresholds();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败，请稍后重试';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleEnabled(threshold: AlertThreshold) {
    try {
      await updateThreshold(threshold.id, { enabled: !threshold.enabled });
      loadThresholds();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '切换状态失败';
      setError(msg);
    }
  }

  async function handleDelete(id: string) {
    if (!showConfirm('确定要删除这条阈值配置吗？')) return;
    try {
      await deleteThreshold(id);
      loadThresholds();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除失败';
      setError(msg);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>告警阈值</h2>
          <p style={styles.subtitle}>为设备属性配置数值范围，超出范围时触发告警</p>
        </div>
        <button style={styles.addButton} onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>新建阈值</span>
        </button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {isEditing && (
        <div style={styles.modalOverlay} onClick={() => setIsEditing(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{editingId ? '编辑阈值' : '新建阈值'}</h3>
              <button style={styles.closeButton} onClick={() => setIsEditing(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>设备</label>
              <select
                value={form.deviceId}
                onChange={(e) => setForm((prev) => ({ ...prev, deviceId: e.target.value }))}
                style={styles.formSelect}
                disabled={!!editingId}
              >
                <option value="">请选择设备</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>属性名称</label>
              <input
                type="text"
                value={form.property}
                onChange={(e) => setForm((prev) => ({ ...prev, property: e.target.value }))}
                style={styles.formInput}
                placeholder="例如 temperature、humidity"
              />
            </div>

            <div style={styles.valueRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>最小值</label>
                <input
                  type="number"
                  value={form.minValue}
                  onChange={(e) => setForm((prev) => ({ ...prev, minValue: e.target.value }))}
                  style={styles.formInput}
                  placeholder="不填则不限"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>最大值</label>
                <input
                  type="number"
                  value={form.maxValue}
                  onChange={(e) => setForm((prev) => ({ ...prev, maxValue: e.target.value }))}
                  style={styles.formInput}
                  placeholder="不填则不限"
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>启用状态</label>
              <div style={styles.toggleRow}>
                <button
                  style={{ ...styles.toggleSwitch, background: form.enabled ? '#107C10' : 'rgba(0, 0, 0, 0.15)' }}
                  onClick={() => setForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                >
                  <div style={{ ...styles.toggleKnob, transform: form.enabled ? 'translateX(18px)' : 'translateX(0)' }} />
                </button>
                <span style={styles.toggleLabel}>{form.enabled ? '已启用' : '已禁用'}</span>
              </div>
            </div>

            {formError && <div style={styles.formError}>{formError}</div>}

            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setIsEditing(false)}>取消</button>
              <button
                style={{ ...styles.confirmButton, ...(submitting ? styles.confirmButtonDisabled : {}) }}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : null}
                {editingId ? '保存修改' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.loadingState}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <div style={styles.loadingText}>加载中...</div>
        </div>
      ) : thresholds.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyTitle}>暂无阈值配置</div>
          <div style={styles.emptyDesc}>创建阈值以监控设备属性异常</div>
        </div>
      ) : (
        <div style={styles.groupList}>
          {Object.entries(grouped).map(([deviceId, items]) => {
            const deviceName = deviceNameMap.get(deviceId) || deviceId;
            return (
              <div key={deviceId} style={styles.deviceGroup}>
                <div style={styles.deviceGroupHeader}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <span style={styles.deviceGroupName}>{deviceName}</span>
                  <span style={styles.deviceGroupCount}>{items.length} 项</span>
                </div>
                <div style={styles.thresholdList}>
                  {items.map((t) => (
                    <div key={t.id} style={styles.thresholdCard}>
                      <div style={styles.thresholdInfo}>
                        <div style={styles.thresholdPropRow}>
                          <code style={styles.thresholdProp}>{t.property}</code>
                          <span style={{ ...styles.enabledBadge, ...(t.enabled ? styles.enabledBadgeOn : styles.enabledBadgeOff) }}>
                            {t.enabled ? '启用' : '禁用'}
                          </span>
                        </div>
                        <div style={styles.thresholdRange}>
                          {t.minValue !== null && t.minValue !== undefined ? `最小 ${t.minValue}` : '最小 不限'}
                          {'  ~  '}
                          {t.maxValue !== null && t.maxValue !== undefined ? `最大 ${t.maxValue}` : '最大 不限'}
                        </div>
                      </div>
                      <div style={styles.thresholdActions}>
                        <button
                          style={{ ...styles.toggleSwitch, background: t.enabled ? '#107C10' : 'rgba(0, 0, 0, 0.15)' }}
                          onClick={() => handleToggleEnabled(t)}
                          title={t.enabled ? '点击禁用' : '点击启用'}
                        >
                          <div style={{ ...styles.toggleKnob, transform: t.enabled ? 'translateX(18px)' : 'translateX(0)' }} />
                        </button>
                        <button style={{ ...styles.iconButton, color: '#005FB8' }} onClick={() => openEdit(t)} title="编辑">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button style={{ ...styles.iconButton, color: '#C42B1C' }} onClick={() => handleDelete(t.id)} title="删除">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
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
    whiteSpace: 'nowrap',
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
  formGroup: { marginBottom: '16px', flex: 1 },
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
    boxSizing: 'border-box',
  },
  formSelect: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '13px',
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    outline: 'none',
    boxSizing: 'border-box',
  },
  valueRow: {
    display: 'flex',
    gap: '12px',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  toggleSwitch: {
    position: 'relative',
    width: '40px', height: '20px',
    borderRadius: '999px', border: 'none',
    cursor: 'pointer', padding: 0,
  },
  toggleKnob: {
    position: 'absolute',
    top: '3px', left: '3px',
    width: '14px', height: '14px',
    borderRadius: '50%', background: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  toggleLabel: {
    fontSize: '13px',
    color: '#5B5B5B',
    fontWeight: 500,
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
    marginTop: '16px', paddingTop: '16px',
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
    padding: '80px 24px',
    background: 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    borderRadius: '12px',
  },
  emptyTitle: {
    fontSize: '15px', fontWeight: 600,
    color: '#5B5B5B', marginBottom: '4px',
  },
  emptyDesc: { fontSize: '13px', color: '#8A8A8A' },
  groupList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  deviceGroup: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '16px',
  },
  deviceGroupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingBottom: '12px',
    marginBottom: '12px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  deviceGroupName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    flex: 1,
  },
  deviceGroupCount: {
    fontSize: '11px',
    color: '#8A8A8A',
    background: 'rgba(0, 0, 0, 0.04)',
    padding: '2px 8px',
    borderRadius: '999px',
  },
  thresholdList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  thresholdCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.04)',
  },
  thresholdInfo: {
    flex: 1,
    minWidth: 0,
  },
  thresholdPropRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  thresholdProp: {
    padding: '2px 8px',
    borderRadius: '4px',
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  enabledBadge: {
    padding: '1px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
  },
  enabledBadgeOn: {
    background: 'rgba(16, 124, 16, 0.1)',
    color: '#107C10',
  },
  enabledBadgeOff: {
    background: 'rgba(0, 0, 0, 0.06)',
    color: '#8A8A8A',
  },
  thresholdRange: {
    fontSize: '12px',
    color: '#5B5B5B',
  },
  thresholdActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  iconButton: {
    width: '32px', height: '32px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none', color: '#5B5B5B',
    borderRadius: '6px', cursor: 'pointer',
  },
};
