import { useState, useEffect } from 'react';
import { SceneTemplate } from '../types';
import { getSceneTemplates, createSceneFromTemplate } from '../api';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const iconMap: Record<string, React.ReactNode> = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  'door-open': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
      <path d="M9 22V12h6v10" />
      <circle cx="14" cy="7" r="1" />
    </svg>
  ),
  moon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  tv: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  ),
  sun: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  ),
};

export function SceneTemplateSelector({ onClose, onCreated }: Props) {
  const [templates, setTemplates] = useState<SceneTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SceneTemplate | null>(null);
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await getSceneTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!selectedTemplate) return;
    
    setCreating(true);
    try {
      await createSceneFromTemplate(selectedTemplate.id, {
        name: customName || selectedTemplate.name,
        description: selectedTemplate.description,
      });
      onCreated();
      onClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '创建失败';
      alert('从模板创建场景失败：' + msg);
    }
    setCreating(false);
  }

  function handleSelectTemplate(template: SceneTemplate) {
    setSelectedTemplate(template);
    setCustomName('');
  }

  if (loading) {
    return (
      <div style={styles.modalOverlay} onClick={onClose}>
        <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <div style={styles.loading}>加载模板中...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>场景模板库</h3>
          <button style={styles.closeButton} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!selectedTemplate ? (
          <>
            <p style={styles.subtitle}>选择预设模板快速创建场景，降低配置门槛</p>
            
            <div style={styles.templateGrid}>
              {templates.map((template) => (
                <div
                  key={template.id}
                  style={styles.templateCard}
                  onClick={() => handleSelectTemplate(template)}
                >
                  <div style={styles.templateIcon}>
                    {iconMap[template.icon || 'star'] || (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    )}
                  </div>
                  <div style={styles.templateInfo}>
                    <h4 style={styles.templateName}>{template.name}</h4>
                    <p style={styles.templateDesc}>{template.description}</p>
                    <div style={styles.templateMeta}>
                      <span style={styles.templateCategory}>{template.category}</span>
                      <span style={styles.templateActions}>{template.actions.length} 个动作</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <button style={styles.backButton} onClick={() => setSelectedTemplate(null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              返回模板列表
            </button>

            <div style={styles.previewSection}>
              <div style={styles.previewHeader}>
                <div style={styles.templateIconLarge}>
                  {iconMap[selectedTemplate.icon || 'star'] || (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  )}
                </div>
                <div>
                  <h4 style={styles.previewName}>{selectedTemplate.name}</h4>
                  <p style={styles.previewDesc}>{selectedTemplate.description}</p>
                </div>
              </div>

              <div style={styles.actionsPreview}>
                <h5 style={styles.actionsLabel}>场景动作预览</h5>
                <div style={styles.actionListPreview}>
                  {selectedTemplate.actions.map((action, index) => (
                    <div key={index} style={styles.actionItemPreview}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      <span style={styles.actionTextPreview}>
                        {getActionDescription(action)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>自定义场景名称（可选）</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  style={styles.formInput}
                  placeholder={selectedTemplate.name}
                />
              </div>

              <p style={styles.note}>
                创建后可在场景详情中编辑设备映射和参数设置
              </p>
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setSelectedTemplate(null)}>
                取消
              </button>
              <button
                style={{
                  ...styles.confirmButton,
                  ...(creating ? styles.confirmButtonDisabled : {}),
                }}
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                )}
                <span>{creating ? '创建中...' : '应用模板'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function getActionDescription(action: { deviceId: string; action: string; parameters?: Record<string, unknown> }): string {
  const params = action.parameters || {};
  
  if (params.power === false) {
    return `关闭设备`;
  }
  if (params.power === true) {
    if (params.brightness) {
      return `开启并设置亮度 ${params.brightness}%`;
    }
    if (params.temperature) {
      return `开启并设置温度 ${params.temperature}°C`;
    }
    if (params.mode) {
      return `开启并切换至 ${params.mode} 模式`;
    }
    if (params.position === 'closed') {
      return `关闭窗帘`;
    }
    return `开启设备`;
  }
  
  return `调整设备状态`;
}

const styles: { [key: string]: React.CSSProperties } = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    width: '560px',
    maxWidth: '92vw',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 14px 28px rgba(0, 0, 0, 0.18), 0 0 8px rgba(0, 0, 0, 0.08)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  modalTitle: {
    fontSize: '17px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  closeButton: {
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
    transition: 'background var(--w11-duration-fast) var(--w11-ease-standard)',
  },
  subtitle: {
    fontSize: '13px',
    color: '#5B5B5B',
    marginBottom: '16px',
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#8A8A8A',
    fontSize: '13px',
  },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '12px',
  },
  templateCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '10px',
    padding: '14px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    gap: '12px',
  },
  templateIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    background: 'rgba(0, 95, 184, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#005FB8',
  },
  templateInfo: {
    flex: 1,
    minWidth: 0,
  },
  templateName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
    marginBottom: '4px',
  },
  templateDesc: {
    fontSize: '12px',
    color: '#8A8A8A',
    margin: 0,
    lineHeight: 1.4,
    marginBottom: '6px',
  },
  templateMeta: {
    display: 'flex',
    gap: '8px',
  },
  templateCategory: {
    padding: '2px 8px',
    background: 'rgba(0, 95, 184, 0.08)',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 500,
    color: '#005FB8',
  },
  templateActions: {
    padding: '2px 8px',
    background: 'rgba(0, 0, 0, 0.04)',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 500,
    color: '#5B5B5B',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    marginBottom: '16px',
  },
  previewSection: {
    marginBottom: '20px',
  },
  previewHeader: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
    padding: '14px',
    background: 'rgba(0, 95, 184, 0.04)',
    borderRadius: '8px',
  },
  templateIconLarge: {
    width: '52px',
    height: '52px',
    borderRadius: '10px',
    background: 'rgba(0, 95, 184, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#005FB8',
  },
  previewName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
    marginBottom: '4px',
  },
  previewDesc: {
    fontSize: '13px',
    color: '#5B5B5B',
    margin: 0,
    lineHeight: 1.5,
  },
  actionsPreview: {
    marginBottom: '16px',
  },
  actionsLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: '10px',
  },
  actionListPreview: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  actionItemPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
  },
  actionTextPreview: {
    fontSize: '12px',
    color: '#1A1A1A',
  },
  formGroup: {
    marginBottom: '12px',
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
    transition: 'border-color var(--w11-duration-fast) var(--w11-ease-standard)',
  },
  note: {
    fontSize: '12px',
    color: '#8A8A8A',
    margin: 0,
    padding: '8px 12px',
    background: 'rgba(0, 0, 0, 0.03)',
    borderRadius: '6px',
  },
  modalFooter: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
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
  confirmButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
  confirmButtonDisabled: {
    background: '#B0B0B0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
};