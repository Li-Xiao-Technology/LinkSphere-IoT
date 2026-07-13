import { useState, useEffect, useCallback } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import {
  DeviceTag,
  getDeviceTags,
  createDeviceTag,
  updateDeviceTag,
  deleteDeviceTag,
  getDeviceTagsByDevice,
  assignDeviceTags,
  removeDeviceTag,
} from '../api';
import { showConfirm } from '../utils/confirm';

const PRESET_COLORS = [
  '#005FB8',
  '#107C10',
  '#C42B1C',
  '#8B5CF6',
  '#D83B01',
  '#038387',
  '#5B5B5B',
  '#E3008C',
];

export function DeviceTagManager() {
  const { devices, loadDevices } = useDeviceStore();
  const [tags, setTags] = useState<DeviceTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 标签创建/编辑表单
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 设备标签分配
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [deviceTags, setDeviceTags] = useState<DeviceTag[]>([]);
  const [loadingDeviceTags, setLoadingDeviceTags] = useState(false);
  const [deviceError, setDeviceError] = useState('');

  const loadTags = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getDeviceTags();
      setTags(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载标签失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
    if (devices.length === 0) loadDevices();
  }, [loadTags, devices.length, loadDevices]);

  const loadDeviceTags = useCallback(async (deviceId: string) => {
    if (!deviceId) {
      setDeviceTags([]);
      return;
    }
    setLoadingDeviceTags(true);
    setDeviceError('');
    try {
      const data = await getDeviceTagsByDevice(deviceId);
      setDeviceTags(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载设备标签失败';
      setDeviceError(msg);
      setDeviceTags([]);
    } finally {
      setLoadingDeviceTags(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDeviceId) {
      loadDeviceTags(selectedDeviceId);
    } else {
      setDeviceTags([]);
    }
  }, [selectedDeviceId, loadDeviceTags]);

  function openCreate() {
    setFormName('');
    setFormColor(PRESET_COLORS[0]);
    setEditingId(null);
    setFormError('');
    setIsEditing(true);
  }

  function openEdit(tag: DeviceTag) {
    setFormName(tag.name);
    setFormColor(tag.color);
    setEditingId(tag.id);
    setFormError('');
    setIsEditing(true);
  }

  async function handleSubmit() {
    setFormError('');
    if (!formName.trim()) {
      setFormError('请输入标签名称');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await updateDeviceTag(editingId, { name: formName.trim(), color: formColor });
      } else {
        await createDeviceTag({ name: formName.trim(), color: formColor });
      }
      setIsEditing(false);
      loadTags();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败，请稍后重试';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteTag(id: string) {
    if (!showConfirm('确定要删除这个标签吗？将同时移除所有设备的该标签关联。')) return;
    try {
      await deleteDeviceTag(id);
      loadTags();
      if (selectedDeviceId) loadDeviceTags(selectedDeviceId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除失败';
      setError(msg);
    }
  }

  async function handleAddTagToDevice(tag: DeviceTag) {
    if (!selectedDeviceId) return;
    const exists = deviceTags.some((t) => t.id === tag.id);
    if (exists) return;
    try {
      const newTagIds = [...deviceTags.map((t) => t.id), tag.id];
      await assignDeviceTags(selectedDeviceId, newTagIds);
      loadDeviceTags(selectedDeviceId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '添加标签失败';
      setDeviceError(msg);
    }
  }

  async function handleRemoveTagFromDevice(tagId: string) {
    if (!selectedDeviceId) return;
    try {
      await removeDeviceTag(selectedDeviceId, tagId);
      loadDeviceTags(selectedDeviceId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '移除标签失败';
      setDeviceError(msg);
    }
  }

  const deviceTagIds = new Set(deviceTags.map((t) => t.id));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>设备标签管理</h2>
          <p style={styles.subtitle}>管理标签分类，并为设备分配标签以便快速筛选</p>
        </div>
        <button style={styles.addButton} onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>新建标签</span>
        </button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {isEditing && (
        <div style={styles.modalOverlay} onClick={() => setIsEditing(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{editingId ? '编辑标签' : '新建标签'}</h3>
              <button style={styles.closeButton} onClick={() => setIsEditing(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>标签名称</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={styles.formInput}
                placeholder="例如：客厅设备"
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>颜色</label>
              <div style={styles.colorGrid}>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    style={{
                      ...styles.colorSwatch,
                      background: color,
                      ...(formColor === color ? styles.colorSwatchActive : {}),
                    }}
                    onClick={() => setFormColor(color)}
                  />
                ))}
              </div>
              <div style={styles.customColorRow}>
                <input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  style={styles.colorPicker}
                />
                <span style={styles.colorValue}>{formColor}</span>
              </div>
            </div>

            <div style={styles.previewRow}>
              <span style={styles.previewLabel}>预览：</span>
              <span style={{ ...styles.previewTag, background: formColor }}>
                {formName || '标签名称'}
              </span>
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

      <div style={styles.splitLayout}>
        {/* 左侧：标签管理 */}
        <div style={styles.leftPanel}>
          <h3 style={styles.sectionTitle}>标签列表 ({tags.length})</h3>
          {loading ? (
            <div style={styles.loadingState}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span style={styles.loadingText}>加载中...</span>
            </div>
          ) : tags.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyTitle}>暂无标签</div>
              <div style={styles.emptyDesc}>创建标签以分类管理设备</div>
            </div>
          ) : (
            <div style={styles.tagList}>
              {tags.map((tag) => (
                <div key={tag.id} style={styles.tagItem}>
                  <span style={{ ...styles.colorDot, background: tag.color }} />
                  <span style={styles.tagName}>{tag.name}</span>
                  {tag._count !== undefined && (
                    <span style={styles.tagCount}>{tag._count.devices}</span>
                  )}
                  <button style={{ ...styles.tagIconButton, color: '#005FB8' }} onClick={() => openEdit(tag)} title="编辑">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button style={{ ...styles.tagIconButton, color: '#C42B1C' }} onClick={() => handleDeleteTag(tag.id)} title="删除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：设备标签分配 */}
        <div style={styles.rightPanel}>
          <h3 style={styles.sectionTitle}>设备标签分配</h3>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>选择设备</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              style={styles.deviceSelect}
            >
              <option value="">请选择设备</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {deviceError && <div style={styles.errorBanner}>{deviceError}</div>}

          {selectedDeviceId && (
            <>
              <div style={styles.subSectionTitle}>当前标签</div>
              {loadingDeviceTags ? (
                <div style={styles.loadingInline}>加载中...</div>
              ) : deviceTags.length === 0 ? (
                <div style={styles.emptyInline}>该设备暂无标签</div>
              ) : (
                <div style={styles.deviceTagList}>
                  {deviceTags.map((tag) => (
                    <span key={tag.id} style={{ ...styles.deviceTagChip, background: tag.color }}>
                      <span style={styles.deviceTagText}>{tag.name}</span>
                      <button
                        style={styles.deviceTagRemove}
                        onClick={() => handleRemoveTagFromDevice(tag.id)}
                        title="移除标签"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div style={styles.subSectionTitle}>添加标签</div>
              <div style={styles.addTagList}>
                {tags.length === 0 ? (
                  <div style={styles.emptyInline}>请先创建标签</div>
                ) : (
                  tags.map((tag) => {
                    const assigned = deviceTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        style={{
                          ...styles.addTagButton,
                          ...(assigned ? styles.addTagButtonDisabled : {}),
                        }}
                        onClick={() => !assigned && handleAddTagToDevice(tag)}
                        disabled={assigned}
                      >
                        <span style={{ ...styles.colorDot, background: tag.color }} />
                        <span>{tag.name}</span>
                        {assigned && <span style={styles.assignedText}>已添加</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          {!selectedDeviceId && (
            <div style={styles.emptyState}>
              <div style={styles.emptyTitle}>未选择设备</div>
              <div style={styles.emptyDesc}>请从上方下拉框选择一个设备</div>
            </div>
          )}
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
  splitLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  leftPanel: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '16px',
  },
  rightPanel: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '16px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: '0 0 14px 0',
    letterSpacing: '-0.01em',
  },
  subSectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#5B5B5B',
    margin: '16px 0 8px 0',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    gap: '10px',
  },
  loadingText: {
    fontSize: '13px',
    color: '#5B5B5B',
  },
  loadingInline: {
    fontSize: '12px',
    color: '#8A8A8A',
    padding: '8px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  emptyTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#5B5B5B',
    marginBottom: '4px',
  },
  emptyDesc: {
    fontSize: '12px',
    color: '#8A8A8A',
  },
  emptyInline: {
    fontSize: '12px',
    color: '#8A8A8A',
    padding: '8px',
    fontStyle: 'italic',
  },
  tagList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  tagItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.05)',
  },
  colorDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
  },
  tagName: {
    fontSize: '13px',
    color: '#1A1A1A',
    fontWeight: 500,
    flex: 1,
  },
  tagCount: {
    fontSize: '11px',
    color: '#8A8A8A',
    background: 'rgba(0, 0, 0, 0.06)',
    padding: '1px 8px',
    borderRadius: '999px',
  },
  tagIconButton: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '4px',
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
    width: '440px',
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
    boxSizing: 'border-box',
  },
  colorGrid: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid transparent',
    cursor: 'pointer',
    padding: 0,
  },
  colorSwatchActive: {
    borderColor: '#1A1A1A',
    boxShadow: '0 0 0 2px #FFFFFF inset',
  },
  customColorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '10px',
  },
  colorPicker: {
    width: '36px',
    height: '28px',
    padding: 0,
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '4px',
    cursor: 'pointer',
    background: 'transparent',
  },
  colorValue: {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#5B5B5B',
  },
  previewRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  previewLabel: {
    fontSize: '12px',
    color: '#8A8A8A',
  },
  previewTag: {
    padding: '3px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    color: '#FFFFFF',
    fontWeight: 600,
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
  deviceSelect: {
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
  deviceTagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  deviceTagChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 6px 3px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    color: '#FFFFFF',
    fontWeight: 600,
  },
  deviceTagText: {
    fontSize: '12px',
  },
  deviceTagRemove: {
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.3)',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '50%',
    padding: 0,
  },
  addTagList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  addTagButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    color: '#1A1A1A',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    textAlign: 'left',
  },
  addTagButtonDisabled: {
    background: 'rgba(0, 0, 0, 0.02)',
    color: '#8A8A8A',
    cursor: 'not-allowed',
    border: '1px solid rgba(0, 0, 0, 0.04)',
  },
  assignedText: {
    marginLeft: 'auto',
    fontSize: '11px',
    color: '#107C10',
    fontWeight: 600,
  },
};
