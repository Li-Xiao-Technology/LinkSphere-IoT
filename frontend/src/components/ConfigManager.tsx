import { useState, useRef } from 'react';
import { exportConfig, importConfig, downloadBlob, ExportedConfig, ImportResult } from '../api';

interface PreviewCounts {
  devices: number;
  rules: number;
  scenes: number;
  schedules: number;
  rooms: number;
  webhooks: number;
  thresholds: number;
}

const EMPTY_COUNTS: PreviewCounts = {
  devices: 0,
  rules: 0,
  scenes: 0,
  schedules: 0,
  rooms: 0,
  webhooks: 0,
  thresholds: 0,
};

function countOf(cfg: ExportedConfig | null): PreviewCounts {
  if (!cfg) return EMPTY_COUNTS;
  return {
    devices: Array.isArray(cfg.devices) ? cfg.devices.length : 0,
    rules: Array.isArray(cfg.rules) ? cfg.rules.length : 0,
    scenes: Array.isArray(cfg.scenes) ? cfg.scenes.length : 0,
    schedules: Array.isArray(cfg.schedules) ? cfg.schedules.length : 0,
    rooms: Array.isArray(cfg.rooms) ? cfg.rooms.length : 0,
    webhooks: Array.isArray(cfg.webhooks) ? cfg.webhooks.length : 0,
    thresholds: Array.isArray(cfg.thresholds) ? cfg.thresholds.length : 0,
  };
}

function formatResult(r: ImportResult): string {
  const parts: string[] = [];
  parts.push(`设备 ${r.devices} 个`);
  parts.push(`规则 ${r.rules} 个`);
  parts.push(`场景 ${r.scenes} 个`);
  parts.push(`计划 ${r.schedules} 个`);
  parts.push(`房间 ${r.rooms} 个`);
  parts.push(`Webhook ${r.webhooks} 个`);
  parts.push(`阈值 ${r.thresholds} 个`);
  return `成功导入: ${parts.join(', ')}`;
}

export function ConfigManager() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ExportedConfig | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setError('');
    setNotice('');
    setExporting(true);
    try {
      const data = await exportConfig();
      if (!data) {
        setError('导出失败，请检查网络或重新登录后重试');
        return;
      }
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `config_export_${stamp}.json`);
      setNotice('配置已成功导出为 JSON 文件');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '导出失败，请检查网络';
      setError(msg);
    } finally {
      setExporting(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    setNotice('');
    setImportResult(null);
    const file = e.target.files?.[0];
    if (!file) {
      setImportPreview(null);
      setImportFileName('');
      return;
    }
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = JSON.parse(text) as ExportedConfig;
        if (typeof parsed !== 'object' || parsed === null) {
          setError('配置文件格式无效：应为 JSON 对象');
          setImportPreview(null);
          return;
        }
        setImportPreview(parsed);
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : '配置文件解析失败';
        setError(`无法解析 JSON 文件: ${msg}`);
        setImportPreview(null);
      }
    };
    reader.onerror = () => {
      setError('读取文件失败，请重试');
      setImportPreview(null);
    };
    reader.readAsText(file);
  }

  function clearImport() {
    setImportPreview(null);
    setImportFileName('');
    setImportResult(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleImport() {
    setError('');
    setNotice('');
    if (!importPreview) {
      setError('请先选择要导入的配置文件');
      return;
    }
    setImporting(true);
    try {
      const result = await importConfig(importPreview);
      if (!result || !result.success) {
        setError('导入失败，请检查配置文件内容或服务端日志');
        return;
      }
      setImportResult(result.imported);
      setNotice(formatResult(result.imported));
      setImportPreview(null);
      setImportFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '导入失败，请检查网络';
      setError(msg);
    } finally {
      setImporting(false);
    }
  }

  const counts = countOf(importPreview);
  const totalItems = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>配置管理</h2>
          <p style={styles.subtitle}>导入或导出系统配置，便于备份与迁移</p>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}
      {notice && !error && <div style={styles.successBox}>{notice}</div>}

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardIconWrap}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={styles.cardTitle}>导出配置</h3>
            <p style={styles.cardDesc}>将当前系统的设备、规则、场景、计划、房间、Webhook 与阈值导出为 JSON 文件</p>
          </div>
        </div>
        <button
          style={{ ...styles.primaryButton, ...(exporting ? styles.primaryButtonDisabled : {}) }}
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : null}
          {exporting ? '导出中...' : '导出配置'}
        </button>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardIconWrap}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={styles.cardTitle}>导入配置</h3>
            <p style={styles.cardDesc}>从 JSON 文件导入配置，导入后所有 ID 将重新生成以避免冲突</p>
          </div>
        </div>

        <div style={styles.warningBox}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C42B1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div style={styles.warningText}>
            导入时会重新生成所有设备、规则、场景、计划、房间等资源的 ID，原有的关联关系会按新 ID 重建。此操作不可撤销，请确认导入内容正确。
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.formLabel}>选择配置文件</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            style={styles.fileInput}
          />
        </div>

        {importPreview && (
          <div style={styles.previewBox} className="anim-fade-in">
            <div style={styles.previewHeader}>
              <span style={styles.previewTitle}>配置预览</span>
              {importFileName && <span style={styles.previewFileName}>{importFileName}</span>}
            </div>
            <div style={styles.previewMeta}>即将导入 {totalItems} 个条目：</div>
            <div style={styles.countGrid}>
              <CountPill label="设备" value={counts.devices} />
              <CountPill label="规则" value={counts.rules} />
              <CountPill label="场景" value={counts.scenes} />
              <CountPill label="计划" value={counts.schedules} />
              <CountPill label="房间" value={counts.rooms} />
              <CountPill label="Webhook" value={counts.webhooks} />
              <CountPill label="阈值" value={counts.thresholds} />
            </div>
          </div>
        )}

        {importResult && (
          <div style={styles.successBox} className="anim-fade-in">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#107C10" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div>{formatResult(importResult)}</div>
          </div>
        )}

        <div style={styles.importActions}>
          {importPreview && (
            <button style={styles.cancelButton} onClick={clearImport} disabled={importing}>
              清除
            </button>
          )}
          <button
            style={{ ...styles.primaryButton, ...(!importPreview || importing ? styles.primaryButtonDisabled : {}) }}
            onClick={handleImport}
            disabled={!importPreview || importing}
          >
            {importing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : null}
            {importing ? '导入中...' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.countPill}>
      <span style={styles.countLabel}>{label}</span>
      <span style={styles.countValue}>{value}</span>
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
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
    border: '1px solid rgba(196, 43, 28, 0.15)',
  },
  successBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    background: 'rgba(16, 124, 16, 0.08)',
    color: '#107C10',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
    border: '1px solid rgba(16, 124, 16, 0.18)',
    lineHeight: 1.5,
  },
  card: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    marginBottom: '16px',
  },
  cardHeader: {
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
    marginBottom: '16px',
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
    fontSize: '16px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  cardDesc: {
    fontSize: '13px',
    color: '#8A8A8A',
    margin: '4px 0 0 0',
    lineHeight: 1.5,
  },
  warningBox: {
    display: 'flex',
    gap: '10px',
    background: 'rgba(255, 140, 0, 0.08)',
    padding: '12px 14px',
    borderRadius: '8px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 140, 0, 0.2)',
  },
  warningText: {
    fontSize: '12.5px',
    color: '#8A5A00',
    lineHeight: 1.6,
    flex: 1,
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
  fileInput: {
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
  previewBox: {
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
    padding: '14px',
    marginBottom: '16px',
    border: '1px solid rgba(0, 0, 0, 0.05)',
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  previewTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  previewFileName: {
    fontSize: '12px',
    color: '#8A8A8A',
    maxWidth: '60%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  previewMeta: {
    fontSize: '12px',
    color: '#5B5B5B',
    marginBottom: '10px',
  },
  countGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: '8px',
  },
  countPill: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '8px 10px',
    background: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.05)',
  },
  countLabel: {
    fontSize: '11px',
    color: '#8A8A8A',
    fontWeight: 500,
  },
  countValue: {
    fontSize: '16px',
    color: '#005FB8',
    fontWeight: 700,
  },
  importActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '9px 20px',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
  },
  primaryButtonDisabled: {
    background: '#B0B0B0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  cancelButton: {
    padding: '9px 20px',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none',
    color: '#1A1A1A',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
};
