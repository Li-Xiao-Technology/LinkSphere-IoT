import { Device } from '../types';

interface DeviceInfoPanelProps {
  device: Device;
  onClose: () => void;
}

export function DeviceInfoPanel({ device, onClose }: DeviceInfoPanelProps) {
  const formatValue = (value: string | number | undefined): string => {
    if (value === undefined || value === null || value === '') return '-';
    return String(value);
  };

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getNetworkTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      wifi: 'Wi-Fi',
      bluetooth: '蓝牙',
      ethernet: '有线网络',
    };
    return map[type] || type.toUpperCase();
  };

  const getNetworkStrengthLabel = (strength: number | undefined): string => {
    if (strength === undefined) return '-';
    if (strength >= 80) return `${strength}% (强)`;
    if (strength >= 50) return `${strength}% (中)`;
    if (strength > 0) return `${strength}% (弱)`;
    return `${strength}%`;
  };

  const infoItems = [
    { label: '产品名称', value: device.name },
    { label: '产品型号', value: formatValue(device.model) },
    { label: '序列号 (SN)', value: formatValue(device.sn) },
    { label: '网络类型', value: getNetworkTypeLabel(device.connectionType) },
    { label: '网络名称', value: formatValue(device.networkName) },
    { label: '网络强度', value: getNetworkStrengthLabel(device.networkStrength) },
    { label: 'MAC 地址', value: formatValue(device.macAddress) },
    { label: 'IP 地址', value: formatValue(device.ipAddress) },
    { label: '固件版本', value: formatValue(device.firmwareVersion) },
    { label: '最后同步', value: formatDate(device.lastSyncTime) },
  ];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.iconWrapper}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <span style={styles.title}>设备信息</span>
          </div>
          <button style={styles.closeButton} onClick={onClose} title="关闭">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={styles.content}>
          <div style={styles.deviceIdentity}>
            <div style={styles.deviceName}>{device.name}</div>
            <div style={styles.deviceId}>ID: {device.id}</div>
          </div>

          <div style={styles.infoList}>
            {infoItems.map((item, index) => (
              <div key={index} className="device-info-row">
                <span style={styles.infoLabel}>{item.label}</span>
                <span style={styles.infoValue}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.35)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.15s ease-out',
    padding: '20px',
  },
  panel: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    borderRadius: '16px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04)',
    width: '100%',
    maxWidth: '420px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'scaleIn 0.2s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  iconWrapper: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'rgba(0, 95, 184, 0.1)',
    color: '#005FB8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  closeButton: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: '#5B5B5B',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
  },
  content: {
    padding: '20px',
    overflowY: 'auto',
  },
  deviceIdentity: {
    textAlign: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
  },
  deviceName: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1A1A1A',
    marginBottom: '4px',
  },
  deviceId: {
    fontSize: '11px',
    color: '#8A8A8A',
    fontFamily: 'monospace',
  },
  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '8px',
    transition: 'background 0.12s',
  },
  infoLabel: {
    fontSize: '13px',
    color: '#5B5B5B',
    fontWeight: 500,
  },
  infoValue: {
    fontSize: '13px',
    color: '#1A1A1A',
    fontWeight: 600,
    textAlign: 'right',
    maxWidth: '55%',
    wordBreak: 'break-all',
  },
};
