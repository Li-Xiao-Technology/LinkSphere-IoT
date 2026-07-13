import { useState, useEffect } from 'react';
import { exportEnergyData, exportDeviceHistory, exportAuditLogs, downloadBlob } from '../api';
import { getDevices } from '../api';
import { Device } from '../types';

type ExportKind = 'energy' | 'history' | 'audit';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function DataExport() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [energyDeviceId, setEnergyDeviceId] = useState('');
  const [energyStart, setEnergyStart] = useState(daysAgoISO(30));
  const [energyEnd, setEnergyEnd] = useState(todayISO());

  const [historyDeviceId, setHistoryDeviceId] = useState('');
  const [historyStart, setHistoryStart] = useState(daysAgoISO(30));
  const [historyEnd, setHistoryEnd] = useState(todayISO());

  const [auditStart, setAuditStart] = useState(daysAgoISO(30));
  const [auditEnd, setAuditEnd] = useState(todayISO());

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadDevices() {
    setLoadingDevices(true);
    try {
      const list = await getDevices();
      setDevices(list);
      if (list.length > 0) {
        setEnergyDeviceId(list[0].id);
        setHistoryDeviceId(list[0].id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载设备列表失败';
      setError(msg);
    } finally {
      setLoadingDevices(false);
    }
  }

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
  }

  async function runExport(kind: ExportKind, fn: () => Promise<Blob | null>, filename: string) {
    setError('');
    setBusy(kind);
    try {
      const blob = await fn();
      if (!blob) {
        showToast('error', '导出失败，请检查网络或重新登录后重试');
        return;
      }
      downloadBlob(blob, filename);
      showToast('success', '导出成功，文件已开始下载');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '导出失败，请检查网络';
      showToast('error', msg);
    } finally {
      setBusy(null);
    }
  }

  function handleExportEnergy() {
    if (!energyDeviceId) {
      showToast('error', '请选择设备');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    runExport(
      'energy',
      () => exportEnergyData({ deviceId: energyDeviceId, startDate: energyStart, endDate: energyEnd }),
      `energy_${energyDeviceId}_${stamp}.csv`
    );
  }

  function handleExportHistory() {
    if (!historyDeviceId) {
      showToast('error', '请选择设备');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    runExport(
      'history',
      () => exportDeviceHistory(historyDeviceId, { startDate: historyStart, endDate: historyEnd }),
      `device_history_${historyDeviceId}_${stamp}.csv`
    );
  }

  function handleExportAudit() {
    const stamp = new Date().toISOString().slice(0, 10);
    runExport(
      'audit',
      () => exportAuditLogs({ startDate: auditStart, endDate: auditEnd }),
      `audit_logs_${stamp}.csv`
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>数据导出</h2>
          <p style={styles.subtitle}>导出能耗记录、设备状态历史与审计日志为 CSV 文件</p>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {toast && (
        <div style={{ ...styles.toast, ...(toast.type === 'success' ? styles.toastSuccess : styles.toastError) }} className="anim-fade-in">
          {toast.type === 'success' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {loadingDevices ? (
        <div style={styles.loadingState}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <div style={styles.loadingText}>加载设备列表中...</div>
        </div>
      ) : (
        <div style={styles.cardsGrid}>
          <ExportCard
            title="能耗数据导出"
            desc="导出设备的能耗记录（功率、时间等）"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            }
          >
            <DeviceSelect value={energyDeviceId} onChange={setEnergyDeviceId} devices={devices} />
            <DateRange start={energyStart} end={energyEnd} onStart={setEnergyStart} onEnd={setEnergyEnd} />
            <ExportButton onClick={handleExportEnergy} busy={busy === 'energy'} disabled={!energyDeviceId} />
          </ExportCard>

          <ExportCard
            title="设备历史导出"
            desc="导出设备状态变更历史（状态、时间等）"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
            }
          >
            <DeviceSelect value={historyDeviceId} onChange={setHistoryDeviceId} devices={devices} />
            <DateRange start={historyStart} end={historyEnd} onStart={setHistoryStart} onEnd={setHistoryEnd} />
            <ExportButton onClick={handleExportHistory} busy={busy === 'history'} disabled={!historyDeviceId} />
          </ExportCard>

          <ExportCard
            title="审计日志导出"
            desc="导出系统操作审计日志（用户、操作、资源等）"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            }
          >
            <DateRange start={auditStart} end={auditEnd} onStart={setAuditStart} onEnd={setAuditEnd} />
            <ExportButton onClick={handleExportAudit} busy={busy === 'audit'} />
          </ExportCard>
        </div>
      )}
    </div>
  );
}

function ExportCard({ title, desc, icon, children }: { title: string; desc: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardIconWrap}>{icon}</div>
        <div>
          <h3 style={styles.cardTitle}>{title}</h3>
          <p style={styles.cardDesc}>{desc}</p>
        </div>
      </div>
      <div style={styles.cardBody}>{children}</div>
    </div>
  );
}

function DeviceSelect({ value, onChange, devices }: { value: string; onChange: (v: string) => void; devices: Device[] }) {
  return (
    <div style={styles.formGroup}>
      <label style={styles.formLabel}>设备</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.formControl}>
        <option value="">请选择设备</option>
        {devices.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    </div>
  );
}

function DateRange({ start, end, onStart, onEnd }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void }) {
  return (
    <div style={styles.dateRow}>
      <div style={{ ...styles.formGroup, flex: 1, marginBottom: 0 }}>
        <label style={styles.formLabel}>开始日期</label>
        <input type="date" value={start} onChange={(e) => onStart(e.target.value)} style={styles.formControl} />
      </div>
      <div style={{ ...styles.formGroup, flex: 1, marginBottom: 0 }}>
        <label style={styles.formLabel}>结束日期</label>
        <input type="date" value={end} onChange={(e) => onEnd(e.target.value)} style={styles.formControl} />
      </div>
    </div>
  );
}

function ExportButton({ onClick, busy, disabled }: { onClick: () => void; busy: boolean; disabled?: boolean }) {
  return (
    <button
      style={{ ...styles.exportButton, ...(busy || disabled ? styles.exportButtonDisabled : {}) }}
      onClick={onClick}
      disabled={busy || disabled}
    >
      {busy ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
      {busy ? '导出中...' : '导出 CSV'}
    </button>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
  },
  header: {
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
  errorBox: {
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
    border: '1px solid rgba(196, 43, 28, 0.15)',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
    lineHeight: 1.4,
  },
  toastSuccess: {
    background: 'rgba(16, 124, 16, 0.08)',
    color: '#107C10',
    border: '1px solid rgba(16, 124, 16, 0.18)',
  },
  toastError: {
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
    border: '1px solid rgba(196, 43, 28, 0.15)',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    marginBottom: '18px',
  },
  cardIconWrap: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    background: 'rgba(0, 95, 184, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  cardDesc: {
    fontSize: '12.5px',
    color: '#8A8A8A',
    margin: '4px 0 0 0',
    lineHeight: 1.5,
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    flex: 1,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  formLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: '6px',
  },
  formControl: {
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
  dateRow: {
    display: 'flex',
    gap: '12px',
  },
  exportButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
    marginTop: 'auto',
  },
  exportButtonDisabled: {
    background: '#B0B0B0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
  },
  loadingText: {
    marginTop: '12px',
    fontSize: '13px',
    color: '#5B5B5B',
  },
};
