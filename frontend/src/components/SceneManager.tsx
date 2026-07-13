import { useState, useEffect } from 'react';
import { Scene } from '../types';
import { getScenes, createScene, activateScene } from '../api';
import { useDeviceStore } from '../store/deviceStore';
import { SceneTemplateSelector } from './SceneTemplateSelector';

interface ActionRow {
  deviceId: string;
  parameters: Record<string, unknown>;
}

export function SceneManager() {
  const { devices } = useDeviceStore();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [newScene, setNewScene] = useState({
    name: '',
    description: '',
    actions: [] as ActionRow[],
  });

  useEffect(() => {
    loadScenes();
  }, []);

  async function loadScenes() {
    try {
      const data = await getScenes();
      setScenes(data);
    } catch (error) {
      console.error('Failed to load scenes:', error);
    }
  }

  async function handleCreateScene() {
    if (!newScene.name || newScene.actions.length === 0) return;

    try {
      await createScene({
        name: newScene.name,
        description: newScene.description,
        icon: 'star',
        actions: newScene.actions.map((a) => ({
          deviceId: a.deviceId,
          action: 'setState',
          parameters: a.parameters,
        })),
      });
      setIsCreating(false);
      setNewScene({ name: '', description: '', actions: [] });
      loadScenes();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '创建失败';
      alert('创建场景失败：' + msg);
    }
  }

  async function handleActivateScene(sceneId: string) {
    setActivatingId(sceneId);
    try {
      await activateScene(sceneId);
    } catch (error) {
      console.error('Failed to activate scene:', error);
    }
    setActivatingId(null);
  }

  function addAction() {
    setNewScene((prev) => ({
      ...prev,
      actions: [...prev.actions, { deviceId: '', parameters: { power: true } }],
    }));
  }

  function updateAction(index: number, field: string, value: unknown) {
    setNewScene((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    }));
  }

  function removeAction(index: number) {
    setNewScene((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>场景模式</h2>
          <p style={styles.subtitle}>一键执行多设备联动，打造个性化智能家居体验</p>
        </div>
        <div style={styles.headerButtons}>
          <button style={styles.templateButton} onClick={() => setIsTemplateSelectorOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>从模板创建</span>
          </button>
          <button style={styles.addButton} onClick={() => setIsCreating(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>新建场景</span>
          </button>
        </div>
      </div>

      {isCreating && (
        <div style={styles.modalOverlay} className="anim-fade-in" onClick={() => setIsCreating(false)}>
          <div style={styles.modalContent} className="anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>创建场景</h3>
              <button style={styles.closeButton} onClick={() => setIsCreating(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>场景名称</label>
              <input
                type="text"
                value={newScene.name}
                onChange={(e) => setNewScene((prev) => ({ ...prev, name: e.target.value }))}
                style={styles.formInput}
                placeholder="例如：回家模式"
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>场景描述</label>
              <textarea
                value={newScene.description}
                onChange={(e) => setNewScene((prev) => ({ ...prev, description: e.target.value }))}
                style={styles.formTextarea}
                placeholder="描述这个场景的用途"
              />
            </div>

            <div style={styles.formGroup}>
              <div style={styles.actionHeader}>
                <label style={styles.formLabel}>场景动作</label>
                <button style={styles.addActionButton} onClick={addAction}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  添加动作
                </button>
              </div>

              {newScene.actions.length === 0 ? (
                <div style={styles.emptyActions}>暂无动作，点击"添加动作"开始配置</div>
              ) : (
                <div style={styles.actionList}>
                  {newScene.actions.map((action, index) => (
                    <div key={index} style={styles.actionRow}>
                      <select
                        value={action.deviceId}
                        onChange={(e) => updateAction(index, 'deviceId', e.target.value)}
                        style={styles.formSelect}
                      >
                        <option value="">选择设备</option>
                        {devices.map((device) => (
                          <option key={device.id} value={device.id}>
                            {device.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={JSON.stringify(action.parameters)}
                        onChange={(e) => {
                          try {
                            updateAction(index, 'parameters', JSON.parse(e.target.value));
                          } catch {
                            // invalid JSON
                          }
                        }}
                        style={{ ...styles.formInput, flex: 1 }}
                        placeholder='{"power": true}'
                      />
                      <button style={styles.removeButton} onClick={() => removeAction(index)}>
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

            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setIsCreating(false)}>
                取消
              </button>
              <button
                style={{
                  ...styles.confirmButton,
                  ...(!newScene.name || newScene.actions.length === 0 ? styles.confirmButtonDisabled : {}),
                }}
                onClick={handleCreateScene}
                disabled={!newScene.name || newScene.actions.length === 0}
              >
                创建场景
              </button>
            </div>
          </div>
        </div>
      )}

      {scenes.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div style={styles.emptyTitle}>暂无场景</div>
          <div style={styles.emptyDesc}>创建场景以实现多设备联动控制</div>
        </div>
      ) : (
        <div style={styles.sceneGrid}>
          {scenes.map((scene) => (
            <div key={scene.id} style={styles.sceneCard} className="anim-slide-up">
              <div style={styles.sceneHeader}>
                <div style={styles.sceneIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div style={styles.sceneInfo}>
                  <h3 style={styles.sceneName}>{scene.name}</h3>
                  {scene.description && <p style={styles.sceneDescription}>{scene.description}</p>}
                </div>
              </div>

              <div style={styles.sceneStats}>
                <div style={styles.statPill}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <span>{(scene.actions?.length ?? 0)} 个动作</span>
                </div>
              </div>

              <button
                style={{
                  ...styles.activateButton,
                  ...(activatingId === scene.id ? styles.activateButtonLoading : {}),
                }}
                onClick={() => handleActivateScene(scene.id)}
                disabled={activatingId === scene.id}
              >
                {activatingId === scene.id ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
                <span>{activatingId === scene.id ? '执行中...' : '执行场景'}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {isTemplateSelectorOpen && (
        <SceneTemplateSelector
          onClose={() => setIsTemplateSelectorOpen(false)}
          onCreated={() => {
            loadScenes();
          }}
        />
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
  headerButtons: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  templateButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 16px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: 'none',
    color: '#005FB8',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'background var(--w11-duration-fast) var(--w11-ease-standard)',
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
    transition: 'background var(--w11-duration-fast) var(--w11-ease-standard)',
  },
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
    transition: 'border-color var(--w11-duration-fast) var(--w11-ease-standard)',
  },
  formTextarea: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '13px',
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.6)',
    outline: 'none',
    minHeight: '64px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  formSelect: {
    padding: '9px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '13px',
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '140px',
  },
  actionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  addActionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: 'none',
    color: '#005FB8',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
  },
  emptyActions: {
    padding: '24px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#8A8A8A',
    background: 'rgba(0, 0, 0, 0.03)',
    borderRadius: '6px',
  },
  actionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  actionRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  removeButton: {
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(196, 43, 28, 0.08)',
    border: 'none',
    color: '#C42B1C',
    borderRadius: '6px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  modalFooter: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    marginTop: '24px',
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
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px',
    background: 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    borderRadius: '12px',
  },
  emptyIcon: {
    marginBottom: '16px',
  },
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
  sceneGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '14px',
  },
  sceneCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '18px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sceneHeader: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  sceneIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    background: 'rgba(0, 95, 184, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sceneInfo: {
    flex: 1,
    minWidth: 0,
  },
  sceneName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  sceneDescription: {
    fontSize: '12px',
    color: '#8A8A8A',
    margin: '4px 0 0 0',
    lineHeight: 1.4,
  },
  sceneStats: {
    display: 'flex',
    gap: '8px',
  },
  statPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    background: 'rgba(0, 0, 0, 0.04)',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 500,
    color: '#5B5B5B',
  },
  activateButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.2)',
    transition: 'background var(--w11-duration-fast) var(--w11-ease-standard)',
  },
  activateButtonLoading: {
    background: '#1975C5',
    cursor: 'wait',
  },
};