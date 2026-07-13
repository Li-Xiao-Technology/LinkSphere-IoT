import { useState, useEffect } from 'react';
import { DeviceType, Brand } from '../types';
import { DeviceCard } from './DeviceCard';
import { useDeviceStore } from '../store/deviceStore';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

const deviceTypes: { value: DeviceType | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: '全部', icon: 'M3 6h18M3 12h18M3 18h18' },
  { value: 'light', label: '智能灯', icon: 'M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14' },
  { value: 'switch', label: '开关', icon: 'M3 5h18v14H3zM8 12h.01M16 12h.01' },
  { value: 'sensor', label: '传感器', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { value: 'airconditioner', label: '空调', icon: 'M3 5h18v14H3zM6 10h12M6 14h8' },
  { value: 'waterheater', label: '热水器', icon: 'M5 2h14v20H5zM9 7h6M9 11h6M12 14v3' },
  { value: 'airpurifier', label: '净化器', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v10M7 12h10' },
  { value: 'refrigerator', label: '冰箱', icon: 'M5 2h14v20H5zM12 2v20M8 6h4M8 14h4' },
  { value: 'plc', label: 'PLC', icon: 'M4 4h16v16H4zM9 9h6v6H9z' },
];

const brands: { value: Brand | 'all'; label: string; color: string }[] = [
  { value: 'all', label: '全部品牌', color: '#5B5B5B' },
  { value: 'mijia', label: '米家', color: '#FF6900' },
  { value: 'haier', label: '海尔', color: '#0090E8' },
  { value: 'midea', label: '美的', color: '#EB0A2B' },
];

interface DeviceListProps {
  onViewHistory?: (deviceId: string, deviceName: string) => void;
}

export function DeviceList({ onViewHistory }: DeviceListProps) {
  const { devices: rawDevices, filterType, filterBrand, setFilters } = useDeviceStore();
  const isMobile = useIsMobile();
  const devices = Array.isArray(rawDevices) ? rawDevices : [];

  const filteredDevices = devices.filter((device) => {
    const typeMatch = filterType === 'all' || device.type === filterType;
    const brandMatch = filterBrand === 'all' || device.brand === filterBrand;
    return typeMatch && brandMatch;
  });

  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const offlineCount = devices.length - onlineCount;

  const stats = [
    {
      label: '设备总数',
      value: devices.length,
      color: '#005FB8',
      bg: 'rgba(0, 95, 184, 0.08)',
      icon: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    },
    {
      label: '在线设备',
      value: onlineCount,
      color: '#107C10',
      bg: 'rgba(16, 124, 16, 0.08)',
      icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    },
    {
      label: '离线设备',
      value: offlineCount,
      color: '#C42B1C',
      bg: 'rgba(196, 43, 28, 0.08)',
      icon: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    },
    {
      label: '支持品牌',
      value: new Set(devices.map((d) => d.brand)).size,
      color: '#CA5010',
      bg: 'rgba(202, 80, 16, 0.08)',
      icon: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
    },
  ];

  return (
    <div style={{ ...styles.container, ...(isMobile ? styles.containerMobile : {}) }}>
      <div style={{ ...styles.statsBar, ...(isMobile ? styles.statsBarMobile : {}) }}>
        {stats.map((stat, index) => (
          <div key={index} style={styles.statCard} className="anim-slide-up">
            <div style={{ ...styles.statIcon, background: stat.bg, color: stat.color }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: stat.icon }} />
            </div>
            <div style={styles.statContent}>
              <div style={styles.statValue}>{stat.value}</div>
              <div style={styles.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...styles.filterBar, ...(isMobile ? styles.filterBarMobile : {}) }}>
        <div style={styles.filterGroup}>
          <span style={styles.filterTitle}>类型</span>
          <div style={styles.filterChips}>
            {deviceTypes.map((type) => {
              const isActive = filterType === type.value;
              return (
                <button
                  key={type.value}
                  style={{
                    ...styles.filterChip,
                    ...(isActive ? styles.filterChipActive : {}),
                  }}
                  onClick={() => setFilters(type.value as DeviceType | 'all', filterBrand)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: type.icon }} />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.filterGroup}>
          <span style={styles.filterTitle}>品牌</span>
          <div style={styles.filterChips}>
            {brands.map((brand) => {
              const isActive = filterBrand === brand.value;
              return (
                <button
                  key={brand.value}
                  style={{
                    ...styles.filterChip,
                    ...(isActive ? styles.filterChipActive : {}),
                  }}
                  onClick={() => setFilters(filterType, brand.value as Brand | 'all')}
                >
                  {brand.value !== 'all' && (
                    <span style={{ ...styles.brandDot, background: brand.color }} />
                  )}
                  <span>{brand.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filteredDevices.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <div style={styles.emptyTitle}>未找到匹配的设备</div>
          <div style={styles.emptyDesc}>尝试调整筛选条件或重新发现设备</div>
        </div>
      ) : (
        <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : {}) }}>
          {filteredDevices.map((device) => (
            <DeviceCard key={device.id} device={device} onViewHistory={onViewHistory} />
          ))}
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
  containerMobile: {
    padding: '12px',
  },
  statsBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    marginBottom: '20px',
  },
  statsBarMobile: {
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    marginBottom: '12px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '8px',
    padding: '14px 16px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
  },
  statIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  statValue: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#1A1A1A',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: '12px',
    color: '#5B5B5B',
    marginTop: '2px',
  },
  filterBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px',
    background: 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    borderRadius: '8px',
    padding: '12px 16px',
  },
  filterBarMobile: {
    gap: '8px',
    marginBottom: '12px',
    padding: '10px 12px',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  filterTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#5B5B5B',
    minWidth: '36px',
    letterSpacing: '0.02em',
  },
  filterChips: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  filterChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 500,
    transition:
      'background var(--w11-duration-fast) var(--w11-ease-standard), color var(--w11-duration-fast) var(--w11-ease-standard), border-color var(--w11-duration-fast) var(--w11-ease-standard)',
  },
  filterChipActive: {
    background: '#005FB8',
    color: '#FFFFFF',
    borderColor: '#005FB8',
  },
  brandDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, 300px)',
    gap: '14px',
    justifyContent: 'flex-start',
  },
  gridMobile: {
    gridTemplateColumns: '1fr',
    gap: '10px',
  },
};
