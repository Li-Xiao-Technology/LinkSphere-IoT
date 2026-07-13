import { useState, useEffect, useCallback } from 'react';
import {
  WebhookConfig,
  WebhookDelivery,
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookDeliveries,
} from '../api';
import { showConfirm } from '../utils/confirm';

const WEBHOOK_EVENTS = [
  'device.offline',
  'device.online',
  'energy.anomaly',
  'rule.triggered',
  'threshold.exceeded',
  'schedule.executed',
  'firmware.updated',
  'device.controlled',
];

const METHOD_OPTIONS = ['GET', 'POST', 'PUT'];

interface FormState {
  name: string;
  url: string;
  method: string;
  headers: string;
  events: string[];
}

const EMPTY_FORM: FormState = {
  name: '',
  url: '',
  method: 'POST',
  headers: '',
  events: [],
};

function parseEvents(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseHeaders(raw?: string | null): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; statusCode?: number | null; durationMs?: number } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getWebhooks();
      setWebhooks(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载 Webhook 列表失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError('');
    setIsEditing(true);
  }

  function openEdit(webhook: WebhookConfig) {
    setForm({
      name: webhook.name,
      url: webhook.url,
      method: webhook.method,
      headers: parseHeaders(webhook.headers),
      events: parseEvents(webhook.events),
    });
    setEditingId(webhook.id);
    setFormError('');
    setIsEditing(true);
  }

  function toggleEvent(event: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  }

  async function handleSubmit() {
    setFormError('');
    if (!form.name.trim()) {
      setFormError('请输入 Webhook 名称');
      return;
    }
    if (!form.url.trim()) {
      setFormError('请输入 Webhook URL');
      return;
    }

    let parsedHeaders: Record<string, string> | null = null;
    if (form.headers.trim()) {
      try {
        parsedHeaders = JSON.parse(form.headers);
      } catch {
        setFormError('Headers JSON 格式错误，请检查');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        url: form.url.trim(),
        method: form.method,
        headers: parsedHeaders,
        events: form.events,
      };
      if (editingId) {
        await updateWebhook(editingId, payload);
      } else {
        await createWebhook(payload);
      }
      setIsEditing(false);
      loadWebhooks();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败，请稍后重试';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleEnabled(webhook: WebhookConfig) {
    try {
      await updateWebhook(webhook.id, { enabled: !webhook.enabled });
      loadWebhooks();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '切换状态失败';
      setError(msg);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    setTestResult(null);
    try {
      const result = await testWebhook(id);
      if (result) {
        setTestResult({ id, success: result.success, statusCode: result.statusCode, durationMs: result.durationMs });
      } else {
        setTestResult({ id, success: false });
      }
      if (expandedId === id) {
        loadDeliveries(id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '测试请求失败';
      setError(msg);
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!showConfirm('确定要删除这个 Webhook 吗？相关投递记录也会被删除。')) return;
    try {
      await deleteWebhook(id);
      if (expandedId === id) setExpandedId(null);
      loadWebhooks();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除失败';
      setError(msg);
    }
  }

  async function loadDeliveries(id: string) {
    setLoadingDeliveries(true);
    try {
      const res = await getWebhookDeliveries(id, { page: 1, pageSize: 10 });
      setDeliveries(res.data);
    } catch (err) {
      console.error('Failed to load deliveries:', err);
      setDeliveries([]);
    } finally {
      setLoadingDeliveries(false);
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDeliveries([]);
    } else {
      setExpandedId(id);
      setTestResult(null);
      loadDeliveries(id);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Webhook 管理</h2>
          <p style={styles.subtitle}>配置事件订阅，将系统事件推送到外部服务</p>
        </div>
        <button style={styles.addButton} onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>新建 Webhook</span>
        </button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {isEditing && (
        <div style={styles.modalOverlay} onClick={() => setIsEditing(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{editingId ? '编辑 Webhook' : '新建 Webhook'}</h3>
              <button style={styles.closeButton} onClick={() => setIsEditing(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                style={styles.formInput}
                placeholder="例如：通知服务"
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>URL</label>
              <input
                type="text"
                value={form.url}
                onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                style={styles.formInput}
                placeholder="https://example.com/webhook"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>请求方法</label>
              <div style={styles.methodGrid}>
                {METHOD_OPTIONS.map((m) => (
                  <button
                    key={m}
                    style={{ ...styles.methodButton, ...(form.method === m ? styles.methodButtonActive : {}) }}
                    onClick={() => setForm((prev) => ({ ...prev, method: m }))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>自定义 Headers (JSON)</label>
              <textarea
                value={form.headers}
                onChange={(e) => setForm((prev) => ({ ...prev, headers: e.target.value }))}
                style={styles.formTextarea}
                placeholder={'{\n  "Authorization": "Bearer token"\n}'}
                rows={4}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>订阅事件</label>
              <div style={styles.eventGrid}>
                {WEBHOOK_EVENTS.map((event) => {
                  const checked = form.events.includes(event);
                  return (
                    <label key={event} style={styles.eventItem}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEvent(event)}
                        style={styles.eventCheckbox}
                      />
                      <span style={styles.eventLabel}>{event}</span>
                    </label>
                  );
                })}
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
      ) : webhooks.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyTitle}>暂无 Webhook 配置</div>
          <div style={styles.emptyDesc}>创建 Webhook 以订阅系统事件</div>
        </div>
      ) : (
        <div style={styles.list}>
          {webhooks.map((webhook) => {
            const events = parseEvents(webhook.events);
            const isExpanded = expandedId === webhook.id;
            return (
              <div key={webhook.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.cardInfo}>
                    <div style={styles.cardTitleRow}>
                      <h3 style={styles.cardTitle}>{webhook.name}</h3>
                      <span style={{ ...styles.methodPill, ...(webhook.enabled ? {} : styles.methodPillDisabled) }}>
                        {webhook.method}
                      </span>
                    </div>
                    <div style={styles.cardUrl}>{webhook.url}</div>
                    <div style={styles.cardEvents}>
                      {events.length === 0 ? (
                        <span style={styles.noEvents}>未订阅事件</span>
                      ) : (
                        events.map((ev) => (
                          <span key={ev} style={styles.eventTag}>{ev}</span>
                        ))
                      )}
                    </div>
                  </div>
                  <button
                    style={{ ...styles.toggleSwitch, background: webhook.enabled ? '#107C10' : 'rgba(0, 0, 0, 0.15)' }}
                    onClick={() => handleToggleEnabled(webhook)}
                    title={webhook.enabled ? '已启用' : '已禁用'}
                  >
                    <div style={{ ...styles.toggleKnob, transform: webhook.enabled ? 'translateX(18px)' : 'translateX(0)' }} />
                  </button>
                </div>

                {testResult && testResult.id === webhook.id && (
                  <div style={{ ...styles.testResultBanner, ...(testResult.success ? styles.testSuccess : styles.testFailure) }}>
                    {testResult.success ? '测试成功' : '测试失败'}
                    {testResult.statusCode !== undefined && testResult.statusCode !== null && ` · 状态码 ${testResult.statusCode}`}
                    {testResult.durationMs !== undefined && ` · 耗时 ${testResult.durationMs}ms`}
                  </div>
                )}

                <div style={styles.cardActions}>
                  <button
                    style={{ ...styles.testButton, ...(testingId === webhook.id ? styles.testButtonLoading : {}) }}
                    onClick={() => handleTest(webhook.id)}
                    disabled={testingId === webhook.id}
                  >
                    {testingId === webhook.id ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                    <span>测试</span>
                  </button>
                  <button style={styles.expandButton} onClick={() => toggleExpand(webhook.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    <span>投递记录</span>
                  </button>
                  <button style={{ ...styles.iconButton, color: '#005FB8' }} onClick={() => openEdit(webhook)} title="编辑">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button style={{ ...styles.iconButton, color: '#C42B1C' }} onClick={() => handleDelete(webhook.id)} title="删除">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>

                {isExpanded && (
                  <div style={styles.deliverySection}>
                    <div style={styles.deliveryHeader}>
                      <span style={styles.deliveryTitle}>最近投递记录</span>
                    </div>
                    {loadingDeliveries ? (
                      <div style={styles.deliveryLoading}>加载中...</div>
                    ) : deliveries.length === 0 ? (
                      <div style={styles.deliveryEmpty}>暂无投递记录</div>
                    ) : (
                      <div style={styles.deliveryList}>
                        {deliveries.map((d) => (
                          <div key={d.id} style={styles.deliveryItem}>
                            <span style={{ ...styles.deliveryStatus, ...(d.success ? styles.deliveryStatusSuccess : styles.deliveryStatusFail) }}>
                              {d.success ? '成功' : '失败'}
                            </span>
                            <span style={styles.deliveryEvent}>{d.event}</span>
                            <span style={styles.deliveryCode}>
                              {d.statusCode !== null && d.statusCode !== undefined ? `${d.statusCode}` : '无响应'}
                            </span>
                            <span style={styles.deliveryTime}>{formatTime(d.deliveredAt)}</span>
                          </div>
                        ))}
                      </div>
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
  formTextarea: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.6)',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  methodGrid: {
    display: 'flex',
    gap: '8px',
  },
  methodButton: {
    flex: 1,
    padding: '9px',
    background: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  methodButtonActive: {
    background: '#005FB8',
    color: '#FFFFFF',
    borderColor: '#005FB8',
  },
  eventGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px',
  },
  eventItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    cursor: 'pointer',
  },
  eventCheckbox: {
    cursor: 'pointer',
    accentColor: '#005FB8',
  },
  eventLabel: {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#1A1A1A',
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
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
  },
  cardHeader: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardTitle: {
    fontSize: '15px', fontWeight: 600,
    color: '#1A1A1A', margin: 0,
    letterSpacing: '-0.01em',
  },
  methodPill: {
    padding: '2px 8px', borderRadius: '4px',
    fontSize: '11px', fontWeight: 600,
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
    fontFamily: 'monospace',
  },
  methodPillDisabled: {
    background: 'rgba(0, 0, 0, 0.06)',
    color: '#8A8A8A',
  },
  cardUrl: {
    fontSize: '12px',
    color: '#5B5B5B',
    marginTop: '4px',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  cardEvents: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '8px',
  },
  eventTag: {
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    background: 'rgba(0, 0, 0, 0.04)',
    color: '#5B5B5B',
    fontFamily: 'monospace',
  },
  noEvents: {
    fontSize: '12px',
    color: '#8A8A8A',
    fontStyle: 'italic',
  },
  toggleSwitch: {
    position: 'relative',
    width: '40px', height: '20px',
    borderRadius: '999px', border: 'none',
    cursor: 'pointer', padding: 0, flexShrink: 0,
  },
  toggleKnob: {
    position: 'absolute',
    top: '3px', left: '3px',
    width: '14px', height: '14px',
    borderRadius: '50%', background: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  testResultBanner: {
    marginTop: '12px',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
  },
  testSuccess: {
    background: 'rgba(16, 124, 16, 0.08)',
    color: '#107C10',
    border: '1px solid rgba(16, 124, 16, 0.15)',
  },
  testFailure: {
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
    border: '1px solid rgba(196, 43, 28, 0.15)',
  },
  cardActions: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  testButton: {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '5px 12px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: 'none', color: '#005FB8',
    borderRadius: '6px', cursor: 'pointer',
    fontSize: '12px', fontWeight: 500,
  },
  testButtonLoading: {
    background: 'rgba(0, 95, 184, 0.04)',
    cursor: 'wait',
  },
  expandButton: {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '5px 12px',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none', color: '#5B5B5B',
    borderRadius: '6px', cursor: 'pointer',
    fontSize: '12px', fontWeight: 500,
  },
  iconButton: {
    width: '32px', height: '32px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none', color: '#5B5B5B',
    borderRadius: '6px', cursor: 'pointer',
    marginLeft: 'auto',
  },
  deliverySection: {
    marginTop: '12px',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.05)',
  },
  deliveryHeader: {
    marginBottom: '8px',
  },
  deliveryTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#5B5B5B',
  },
  deliveryLoading: {
    fontSize: '12px',
    color: '#8A8A8A',
    padding: '8px',
  },
  deliveryEmpty: {
    fontSize: '12px',
    color: '#8A8A8A',
    padding: '8px',
  },
  deliveryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  deliveryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 8px',
    background: 'rgba(255, 255, 255, 0.5)',
    borderRadius: '4px',
    fontSize: '12px',
  },
  deliveryStatus: {
    padding: '1px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
    flexShrink: 0,
  },
  deliveryStatusSuccess: {
    background: 'rgba(16, 124, 16, 0.1)',
    color: '#107C10',
  },
  deliveryStatusFail: {
    background: 'rgba(196, 43, 28, 0.1)',
    color: '#C42B1C',
  },
  deliveryEvent: {
    fontFamily: 'monospace',
    color: '#5B5B5B',
    flex: 1,
  },
  deliveryCode: {
    fontFamily: 'monospace',
    color: '#1A1A1A',
    fontWeight: 600,
  },
  deliveryTime: {
    color: '#8A8A8A',
    fontSize: '11px',
    whiteSpace: 'nowrap',
  },
};
