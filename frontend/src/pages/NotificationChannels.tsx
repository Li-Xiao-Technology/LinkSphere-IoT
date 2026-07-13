import { useState, useEffect } from 'react';

interface NotificationChannel {
  id: string;
  name: string;
  type: string;
  config: Record<string, string>;
  enabled: boolean;
  events: string[];
  createdAt: string;
  updatedAt: string;
}

export function NotificationChannels() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [currentChannel, setCurrentChannel] = useState<NotificationChannel | null>(null);
  const [newChannel, setNewChannel] = useState({ name: '', type: '', config: {} as Record<string, string> });
  const [testMessage, setTestMessage] = useState('This is a test notification from LinkSphere');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadChannels();
  }, []);

  async function loadChannels() {
    try {
      const response = await fetch('/api/notification-channels', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setChannels(data);
    } catch {
      console.error('Failed to load notification channels');
    }
  }

  async function createChannel() {
    if (!newChannel.name || !newChannel.type) return;

    try {
      await fetch('/api/notification-channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: newChannel.name,
          type: newChannel.type,
          config: newChannel.config,
          enabled: true,
          events: ['device.offline', 'device.online', 'alert.threshold']
        })
      });
      setShowCreateModal(false);
      setNewChannel({ name: '', type: '', config: {} });
      loadChannels();
    } catch {
      console.error('Failed to create notification channel');
    }
  }

  async function updateChannel() {
    if (!currentChannel) return;

    try {
      await fetch(`/api/notification-channels/${currentChannel.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: currentChannel.name,
          config: currentChannel.config,
          enabled: currentChannel.enabled
        })
      });
      setShowEditModal(false);
      loadChannels();
    } catch {
      console.error('Failed to update notification channel');
    }
  }

  async function deleteChannel(channelId: string) {
    if (!confirm('确定删除这个通知渠道吗？')) return;

    try {
      await fetch(`/api/notification-channels/${channelId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      loadChannels();
    } catch {
      console.error('Failed to delete notification channel');
    }
  }

  async function testChannel() {
    if (!currentChannel) return;

    try {
      const response = await fetch(`/api/notification-channels/${currentChannel.id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ message: testMessage })
      });
      const data = await response.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: '测试失败' });
    }
  }

  const channelTypes = [
    { value: 'email', label: '邮件通知', icon: 'mail', fields: ['recipient'] },
    { value: 'dingtalk', label: '钉钉机器人', icon: 'message-square', fields: ['webhookUrl'] },
    { value: 'wework', label: '企业微信', icon: 'message-square', fields: ['webhookUrl'] },
    { value: 'telegram', label: 'Telegram', icon: 'send', fields: ['botToken', 'chatId'] }
  ];

  const getChannelIcon = (type: string) => {
    const channelType = channelTypes.find(t => t.value === type);
    return channelType?.icon || 'bell';
  };

  const renderConfigFields = (type: string, config: Record<string, string>, onChange: (config: Record<string, string>) => void) => {
    const channelType = channelTypes.find(t => t.value === type);
    if (!channelType) return null;

    return channelType.fields.map(field => (
      <div key={field} style={styles.formGroup}>
        <label style={styles.formLabel}>
          {field === 'recipient' && '收件人邮箱'}
          {field === 'webhookUrl' && 'Webhook URL'}
          {field === 'botToken' && 'Bot Token'}
          {field === 'chatId' && 'Chat ID'}
        </label>
        <input
          type="text"
          value={config[field] || ''}
          onChange={(e) => onChange({ ...config, [field]: e.target.value })}
          placeholder={field === 'recipient' ? 'example@email.com' : undefined}
          style={styles.formInput}
        />
      </div>
    ));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>通知渠道</h1>
        <p style={styles.subtitle}>配置外部通知渠道，接收设备告警、状态变化等消息</p>
      </div>

      <button
        style={styles.createBtn}
        onClick={() => setShowCreateModal(true)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        添加通知渠道
      </button>

      <div style={styles.channelsList}>
        {channels.length === 0 ? (
          <div style={styles.emptyState}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p style={styles.emptyText}>暂无通知渠道</p>
            <p style={styles.emptySubText}>点击上方按钮添加通知渠道</p>
          </div>
        ) : (
          channels.map(channel => (
            <div key={channel.id} style={styles.channelCard}>
              <div style={styles.channelHeader}>
                <div style={{ ...styles.channelIcon, color: channel.enabled ? '#6366F1' : '#9CA3AF' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div style={styles.channelInfo}>
                  <h3 style={styles.channelName}>{channel.name}</h3>
                  <span style={styles.channelType}>{channelTypes.find(t => t.value === channel.type)?.label || channel.type}</span>
                </div>
                <div style={styles.channelActions}>
                  <button
                    style={{ ...styles.statusToggle, background: channel.enabled ? '#10B981' : '#EF4444' }}
                    onClick={() => {
                      setCurrentChannel({ ...channel, enabled: !channel.enabled });
                      updateChannel();
                    }}
                  >
                    {channel.enabled ? '已启用' : '已禁用'}
                  </button>
                  <button
                    style={styles.actionBtn}
                    onClick={() => { setCurrentChannel(channel); setShowTestModal(true); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </button>
                  <button
                    style={styles.actionBtn}
                    onClick={() => { setCurrentChannel(channel); setShowEditModal(true); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    style={{ ...styles.actionBtn, color: '#EF4444' }}
                    onClick={() => deleteChannel(channel.id)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <div style={styles.channelEvents}>
                <span style={styles.eventsLabel}>订阅事件:</span>
                {channel.events.map(event => (
                  <span key={event} style={styles.eventTag}>
                    {event.replace('.', ': ')}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>添加通知渠道</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowCreateModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>渠道名称</label>
                <input
                  type="text"
                  value={newChannel.name}
                  onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                  placeholder="输入渠道名称"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>渠道类型</label>
                <div style={styles.typeSelector}>
                  {channelTypes.map(type => (
                    <button
                      key={type.value}
                      style={{ ...styles.typeOption, borderColor: newChannel.type === type.value ? '#6366F1' : '#E5E7EB', background: newChannel.type === type.value ? '#6366F110' : 'white' }}
                      onClick={() => setNewChannel({ ...newChannel, type: type.value })}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              {newChannel.type && renderConfigFields(newChannel.type, newChannel.config, (config) => setNewChannel({ ...newChannel, config }))}
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={() => setShowCreateModal(false)}>取消</button>
              <button style={styles.modalConfirmBtn} onClick={createChannel} disabled={!newChannel.name || !newChannel.type}>创建</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && currentChannel && (
        <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>编辑通知渠道</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowEditModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>渠道名称</label>
                <input
                  type="text"
                  value={currentChannel.name}
                  onChange={(e) => setCurrentChannel({ ...currentChannel, name: e.target.value })}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>渠道类型</label>
                <input type="text" value={channelTypes.find(t => t.value === currentChannel.type)?.label || currentChannel.type} disabled style={{ ...styles.formInput, background: '#F3F4F6' }} />
              </div>
              {renderConfigFields(currentChannel.type, currentChannel.config, (config) => setCurrentChannel({ ...currentChannel, config }))}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>
                  <input
                    type="checkbox"
                    checked={currentChannel.enabled}
                    onChange={(e) => setCurrentChannel({ ...currentChannel, enabled: e.target.checked })}
                  />
                  启用此渠道
                </label>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={() => setShowEditModal(false)}>取消</button>
              <button style={styles.modalConfirmBtn} onClick={updateChannel} disabled={!currentChannel.name}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showTestModal && currentChannel && (
        <div style={styles.modalOverlay} onClick={() => setShowTestModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>测试通知渠道</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowTestModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>测试消息</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={3}
                  style={{ ...styles.formInput, minHeight: '80px' }}
                />
              </div>
              {testResult && (
                <div style={{ ...styles.testResult, background: testResult.success ? '#10B98120' : '#EF444420' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {testResult.success ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                    )}
                    <span style={{ color: testResult.success ? '#10B981' : '#EF4444' }}>{testResult.message}</span>
                  </div>
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={() => setShowTestModal(false)}>取消</button>
              <button style={styles.modalConfirmBtn} onClick={testChannel}>发送测试消息</button>
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
    maxWidth: '800px',
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
    cursor: 'pointer',
    marginBottom: '24px'
  },
  channelsList: {
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
  channelCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  channelHeader: {
    display: 'flex',
    alignItems: 'center'
  },
  channelIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: '#F3F4F6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  channelInfo: {
    flex: 1,
    marginLeft: '16px'
  },
  channelName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1F2937',
    margin: 0
  },
  channelType: {
    fontSize: '13px',
    color: '#6B7280'
  },
  channelActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statusToggle: {
    padding: '6px 12px',
    borderRadius: '20px',
    border: 'none',
    color: 'white',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer'
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
  channelEvents: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #E5E7EB'
  },
  eventsLabel: {
    fontSize: '13px',
    color: '#6B7280'
  },
  eventTag: {
    fontSize: '12px',
    padding: '4px 8px',
    background: '#EEF2FF',
    color: '#6366F1',
    borderRadius: '4px'
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
    flexWrap: 'wrap',
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
  testResult: {
    padding: '12px',
    borderRadius: '8px',
    marginTop: '12px'
  }
};
