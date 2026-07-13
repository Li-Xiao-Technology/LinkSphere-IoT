import { useState, useEffect } from 'react';
import { Schedule } from '../types';
import { getSchedules, createSchedule, toggleSchedule, deleteSchedule } from '../api';
import { useDeviceStore } from '../store/deviceStore';
import { showConfirm } from '../utils/confirm';

interface ParsedAction {
  deviceId: string;
  parameters: Record<string, unknown>;
}

const presetCronExpressions: { label: string; value: string }[] = [
  { label: '每天 08:00', value: '0 8 * * *' },
  { label: '每天 22:00', value: '0 22 * * *' },
  { label: '工作日 08:00', value: '0 8 * * 1-5' },
  { label: '周末 09:00', value: '0 9 * * 0,6' },
  { label: '每天 12:00', value: '0 12 * * *' },
  { label: '每天 18:00', value: '0 18 * * *' },
];

function formatCron(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [minute, hour, day, month, weekday] = parts;
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const time = `${hour}:${minute.padStart(2, '0')}`;

  if (weekday !== '*') {
    if (weekday.includes('-')) {
      const [start, end] = weekday.split('-').map(Number);
      if (start === 1 && end === 5) return `工作日 ${time}`;
      if (start === 0 && end === 6) return `每天 ${time}`;
    }
    if (weekday.includes(',')) {
      const days = weekday.split(',').map(Number);
      if (days.length === 2 && days.includes(0) && days.includes(6)) {
        return `周末 ${time}`;
      }
    }
    const dayName = weekdays[parseInt(weekday)] || weekday;
    return `${dayName} ${time}`;
  }
  if (day !== '*' || month !== '*') return cron;
  return `每天 ${time}`;
}

export function ScheduleManager() {
  const { devices } = useDeviceStore();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    cronExpression: '0 8 * * *',
    deviceId: '',
    parameters: { power: true } as Record<string, unknown>,
  });

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    try {
      const data = await getSchedules();
      setSchedules(data);
    } catch (error) {
      console.error('Failed to load schedules:', error);
    }
  }

  async function handleCreateSchedule() {
    if (!newSchedule.name || !newSchedule.deviceId) return;

    try {
      await createSchedule({
        name: newSchedule.name,
        cronExpression: newSchedule.cronExpression,
        action: JSON.stringify({
          deviceId: newSchedule.deviceId,
          parameters: newSchedule.parameters,
        }),
        enabled: true,
      });
      setIsCreating(false);
      setNewSchedule({
        name: '',
        cronExpression: '0 8 * * *',
        deviceId: '',
        parameters: { power: true },
      });
      loadSchedules();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '创建失败';
      alert('创建定时任务失败：' + msg);
    }
  }

  async function handleToggleSchedule(id: string) {
    setTogglingId(id);
    try {
      await toggleSchedule(id);
      loadSchedules();
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
    setTogglingId(null);
  }

  async function handleDeleteSchedule(id: string) {
    if (!showConfirm('确定要删除这个定时任务吗？')) return;
    try {
      await deleteSchedule(id);
      loadSchedules();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  }

  const isCustomCron = !presetCronExpressions.some((p) => p.value === newSchedule.cronExpression);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>定时任务</h2>
          <p style={styles.subtitle}>按设定时间自动执行设备控制，让智能生活更省心</p>
        </div>
        <button style={styles.addButton} onClick={() => setIsCreating(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>新建任务</span>
        </button>
      </div>

      {isCreating && (
        <div style={styles.modalOverlay} className="anim-fade-in" onClick={() => setIsCreating(false)}>
          <div style={styles.modalContent} className="anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>创建定时任务</h3>
              <button style={styles.closeButton} onClick={() => setIsCreating(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>任务名称</label>
              <input
                type="text"
                value={newSchedule.name}
                onChange={(e) => setNewSchedule((prev) => ({ ...prev, name: e.target.value }))}
                style={styles.formInput}
                placeholder="例如：早晨自动开灯"
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>执行时间</label>
              <div style={styles.presetGrid}>
                {presetCronExpressions.map((preset) => (
                  <button
                    key={preset.value}
                    style={{
                      ...styles.presetButton,
                      ...(newSchedule.cronExpression === preset.value ? styles.presetButtonActive : {}),
                    }}
                    onClick={() => setNewSchedule((prev) => ({ ...prev, cronExpression: preset.value }))}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  style={{
                    ...styles.presetButton,
                    ...(isCustomCron ? styles.presetButtonActive : {}),
                  }}
                  onClick={() => setNewSchedule((prev) => ({ ...prev, cronExpression: '0 6 * * *' }))}
                >
                  自定义
                </button>
              </div>
              {isCustomCron && (
                <input
                  type="text"
                  value={newSchedule.cronExpression}
                  onChange={(e) => setNewSchedule((prev) => ({ ...prev, cronExpression: e.target.value }))}
                  style={{ ...styles.formInput, marginTop: '8px', fontFamily: 'monospace' }}
                  placeholder="Cron 表达式：分 时 日 月 周"
                />
              )}
              <p style={styles.cronHint}>格式：minute hour day month weekday（例：0 8 * * * 表示每天 8:00）</p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>执行设备</label>
              <select
                value={newSchedule.deviceId}
                onChange={(e) => setNewSchedule((prev) => ({ ...prev, deviceId: e.target.value }))}
                style={styles.formSelect}
              >
                <option value="">选择设备</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>执行动作</label>
              <input
                type="text"
                value={JSON.stringify(newSchedule.parameters)}
                onChange={(e) => {
                  try {
                    setNewSchedule((prev) => ({ ...prev, parameters: JSON.parse(e.target.value) }));
                  } catch {
                    // invalid JSON
                  }
                }}
                style={styles.formInput}
                placeholder='{"power": true}'
              />
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setIsCreating(false)}>
                取消
              </button>
              <button
                style={{
                  ...styles.confirmButton,
                  ...(!newSchedule.name || !newSchedule.deviceId ? styles.confirmButtonDisabled : {}),
                }}
                onClick={handleCreateSchedule}
                disabled={!newSchedule.name || !newSchedule.deviceId}
              >
                创建任务
              </button>
            </div>
          </div>
        </div>
      )}

      {schedules.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div style={styles.emptyTitle}>暂无定时任务</div>
          <div style={styles.emptyDesc}>创建定时任务以实现自动化控制</div>
        </div>
      ) : (
        <div style={styles.scheduleList}>
          {schedules.map((schedule) => {
            let action: ParsedAction;
            try {
              action = JSON.parse(schedule.action);
            } catch {
              action = { deviceId: '', parameters: {} };
            }
            const device = devices.find((d) => d.id === action.deviceId);

            return (
              <div key={schedule.id} style={styles.scheduleCard} className="anim-slide-up">
                <div style={styles.scheduleHeader}>
                  <div
                    style={{
                      ...styles.scheduleIcon,
                      background: schedule.enabled ? 'rgba(16, 124, 16, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                      color: schedule.enabled ? '#107C10' : '#8A8A8A',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div style={styles.scheduleInfo}>
                    <h3 style={styles.scheduleName}>{schedule.name}</h3>
                    <div style={styles.scheduleTime}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>{formatCron(schedule.cronExpression)}</span>
                    </div>
                  </div>
                  <button
                    style={{
                      ...styles.toggleSwitch,
                      background: schedule.enabled ? '#107C10' : 'rgba(0, 0, 0, 0.15)',
                    }}
                    onClick={() => handleToggleSchedule(schedule.id)}
                    disabled={togglingId === schedule.id}
                  >
                    <div
                      style={{
                        ...styles.toggleKnob,
                        transform: schedule.enabled ? 'translateX(18px)' : 'translateX(0)',
                      }}
                    />
                  </button>
                  <button
                    style={styles.deleteButton}
                    onClick={() => handleDeleteSchedule(schedule.id)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>

                <div style={styles.scheduleAction}>
                  <div style={styles.actionDevice}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span>{device?.name || '未知设备'}</span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                  <div style={styles.actionParams}>
                    <code>{JSON.stringify(action.parameters)}</code>
                  </div>
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
  },
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
  },
  presetButton: {
    padding: '8px 10px',
    background: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all var(--w11-duration-fast) var(--w11-ease-standard)',
  },
  presetButtonActive: {
    background: '#005FB8',
    color: '#FFFFFF',
    borderColor: '#005FB8',
  },
  cronHint: {
    fontSize: '11px',
    color: '#8A8A8A',
    margin: '6px 0 0 0',
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
  scheduleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  scheduleCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '16px 18px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  scheduleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  scheduleIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scheduleInfo: {
    flex: 1,
    minWidth: 0,
  },
  scheduleName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  scheduleTime: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    marginTop: '4px',
    fontSize: '12px',
    color: '#5B5B5B',
    fontWeight: 500,
  },
  toggleSwitch: {
    position: 'relative',
    width: '40px',
    height: '20px',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: 'background var(--w11-duration-normal) var(--w11-ease-standard)',
  },
  toggleKnob: {
    position: 'absolute',
    top: '3px',
    left: '3px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    transition: 'transform var(--w11-duration-normal) var(--w11-ease-standard)',
  },
  deleteButton: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: 'none',
    background: 'rgba(239, 68, 68, 0.08)',
    color: '#EF4444',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--w11-duration-fast) var(--w11-ease-standard)',
  },
  scheduleAction: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    background: 'rgba(0, 0, 0, 0.03)',
    borderRadius: '8px',
  },
  actionDevice: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#1A1A1A',
  },
  actionParams: {
    fontSize: '12px',
    color: '#5B5B5B',
    fontFamily: 'monospace',
    background: 'rgba(0, 0, 0, 0.04)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
};