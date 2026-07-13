import { useState, useEffect } from 'react';

interface Firmware {
  id: string;
  brand: string;
  model: string;
  version: string;
  changelog: string | null;
  downloadUrl: string;
  fileSize: number | null;
  releasedAt: string;
  isStable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DeviceFirmwareInfo {
  deviceId: string;
  deviceName: string;
  currentVersion: string | null;
  availableUpdates: Firmware[];
  updateHistory: { version: string; status: string; createdAt: string }[];
}

export function FirmwareCenter() {
  const [firmwares, setFirmwares] = useState<Firmware[]>([]);
  const [devices, setDevices] = useState<DeviceFirmwareInfo[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<DeviceFirmwareInfo | null>(null);
  const [newFirmware, setNewFirmware] = useState({ brand: '', model: '', version: '', changelog: '', downloadUrl: '', fileSize: 0, isStable: true });

  useEffect(() => {
    loadFirmwares();
  }, []);

  async function loadFirmwares() {
    try {
      const response = await fetch('/api/firmware-center', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setFirmwares(data);
    } catch {
      console.error('Failed to load firmwares');
    }
  }

  async function loadDeviceFirmware(deviceId: string) {
    try {
      const response = await fetch(`/api/firmware-center/devices/${deviceId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setCurrentDevice(data);
      setShowDeviceModal(true);
    } catch {
      console.error('Failed to load device firmware info');
    }
  }

  async function createFirmware() {
    if (!newFirmware.brand || !newFirmware.model || !newFirmware.version || !newFirmware.downloadUrl) return;

    try {
      await fetch('/api/firmware-center', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newFirmware)
      });
      setShowCreateModal(false);
      setNewFirmware({ brand: '', model: '', version: '', changelog: '', downloadUrl: '', fileSize: 0, isStable: true });
      loadFirmwares();
    } catch {
      console.error('Failed to create firmware');
    }
  }

  async function updateDeviceFirmware(deviceId: string, version: string) {
    if (!confirm('确定更新设备固件吗？')) return;

    try {
      await fetch(`/api/firmware-center/devices/${deviceId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ version })
      });
      loadDeviceFirmware(deviceId);
    } catch {
      console.error('Failed to update device firmware');
    }
  }

  async function deleteFirmware(firmwareId: string) {
    if (!confirm('确定删除这个固件版本吗？')) return;

    try {
      await fetch(`/api/firmware-center/${firmwareId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      loadFirmwares();
    } catch {
      console.error('Failed to delete firmware');
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  const brands = [...new Set(firmwares.map(f => f.brand))];
  const [selectedBrand, setSelectedBrand] = useState('');
  const filteredFirmwares = selectedBrand ? firmwares.filter(f => f.brand === selectedBrand) : firmwares;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>固件管理中心</h1>
          <p style={styles.subtitle}>管理设备固件版本，支持批量升级和版本回滚</p>
        </div>
        <button
          style={styles.createBtn}
          onClick={() => setShowCreateModal(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          添加固件版本
        </button>
      </div>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tabBtn, background: true ? '#6366F1' : '#F3F4F6', color: true ? 'white' : '#374151' }}
        >
          固件库
        </button>
      </div>

      <div style={styles.filterBar}>
        <div style={styles.brandFilter}>
          <label style={styles.filterLabel}>品牌筛选</label>
          <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} style={styles.filterSelect}>
            <option value="">全部品牌</option>
            {brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.firmwareGrid}>
        {filteredFirmwares.length === 0 ? (
          <div style={styles.emptyState}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p style={styles.emptyText}>暂无固件版本</p>
            <p style={styles.emptySubText}>点击上方按钮添加固件</p>
          </div>
        ) : (
          filteredFirmwares.map(firmware => (
            <div key={firmware.id} style={styles.firmwareCard}>
              <div style={styles.firmwareHeader}>
                <div style={styles.firmwareIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div style={styles.firmwareInfo}>
                  <h3 style={styles.firmwareVersion}>{firmware.version}</h3>
                  <span style={styles.firmwareModel}>{firmware.brand} - {firmware.model}</span>
                </div>
                <div style={styles.firmwareActions}>
                  {firmware.isStable && <span style={styles.stableBadge}>稳定版</span>}
                  <button
                    style={{ ...styles.actionBtn, color: '#EF4444' }}
                    onClick={() => deleteFirmware(firmware.id)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              {firmware.changelog && (
                <div style={styles.firmwareChangelog}>
                  <h4 style={styles.changelogTitle}>更新说明</h4>
                  <p style={styles.changelogContent}>{firmware.changelog}</p>
                </div>
              )}
              <div style={styles.firmwareFooter}>
                <span style={styles.firmwareSize}>{formatFileSize(firmware.fileSize)}</span>
                <span style={styles.firmwareDate}>{formatDate(firmware.releasedAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>添加固件版本</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowCreateModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>品牌</label>
                <input
                  type="text"
                  value={newFirmware.brand}
                  onChange={(e) => setNewFirmware({ ...newFirmware, brand: e.target.value })}
                  placeholder="输入品牌名称"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>型号</label>
                <input
                  type="text"
                  value={newFirmware.model}
                  onChange={(e) => setNewFirmware({ ...newFirmware, model: e.target.value })}
                  placeholder="输入设备型号"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>版本号</label>
                <input
                  type="text"
                  value={newFirmware.version}
                  onChange={(e) => setNewFirmware({ ...newFirmware, version: e.target.value })}
                  placeholder="如: v1.0.0"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>下载链接</label>
                <input
                  type="text"
                  value={newFirmware.downloadUrl}
                  onChange={(e) => setNewFirmware({ ...newFirmware, downloadUrl: e.target.value })}
                  placeholder="固件文件下载地址"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>文件大小 (字节)</label>
                <input
                  type="number"
                  value={newFirmware.fileSize}
                  onChange={(e) => setNewFirmware({ ...newFirmware, fileSize: parseInt(e.target.value) || 0 })}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>更新说明</label>
                <textarea
                  value={newFirmware.changelog}
                  onChange={(e) => setNewFirmware({ ...newFirmware, changelog: e.target.value })}
                  rows={3}
                  placeholder="描述本次更新内容"
                  style={{ ...styles.formInput, minHeight: '80px' }}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>
                  <input
                    type="checkbox"
                    checked={newFirmware.isStable}
                    onChange={(e) => setNewFirmware({ ...newFirmware, isStable: e.target.checked })}
                  />
                  稳定版
                </label>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={() => setShowCreateModal(false)}>取消</button>
              <button style={styles.modalConfirmBtn} onClick={createFirmware} disabled={!newFirmware.brand || !newFirmware.model || !newFirmware.version || !newFirmware.downloadUrl}>创建</button>
            </div>
          </div>
        </div>
      )}

      {showDeviceModal && currentDevice && (
        <div style={styles.modalOverlay} onClick={() => setShowDeviceModal(false)}>
          <div style={{ ...styles.modalCard, maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{currentDevice.deviceName} - 固件管理</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowDeviceModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ ...styles.modalBody, overflowY: 'auto', maxHeight: '500px' }}>
              <div style={styles.currentVersionCard}>
                <div style={styles.currentVersionHeader}>
                  <span style={styles.currentVersionLabel}>当前版本</span>
                  <span style={styles.currentVersionValue}>{currentDevice.currentVersion || '未知'}</span>
                </div>
              </div>

              {currentDevice.availableUpdates.length > 0 ? (
                <div style={styles.updatesSection}>
                  <h4 style={styles.updatesTitle}>可用更新</h4>
                  {currentDevice.availableUpdates.map(update => (
                    <div key={update.id} style={styles.updateCard}>
                      <div style={styles.updateInfo}>
                        <span style={styles.updateVersion}>{update.version}</span>
                        {update.isStable && <span style={styles.stableBadgeSmall}>稳定版</span>}
                      </div>
                      <button
                        style={styles.updateBtn}
                        onClick={() => updateDeviceFirmware(currentDevice.deviceId, update.version)}
                      >
                        更新
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.noUpdateSection}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>当前已是最新版本</span>
                </div>
              )}

              {currentDevice.updateHistory.length > 0 && (
                <div style={styles.historySection}>
                  <h4 style={styles.historyTitle}>更新历史</h4>
                  <div style={styles.historyList}>
                    {currentDevice.updateHistory.map((history, index) => (
                      <div key={index} style={styles.historyItem}>
                        <span style={styles.historyVersion}>{history.version}</span>
                        <span style={styles.historyStatus}>{history.status}</span>
                        <span style={styles.historyDate}>{formatDate(history.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={() => setShowDeviceModal(false)}>关闭</button>
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
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    cursor: 'pointer'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px'
  },
  tabBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  filterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  brandFilter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  filterLabel: {
    fontSize: '14px',
    color: '#6B7280'
  },
  filterSelect: {
    padding: '8px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none'
  },
  firmwareGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '20px'
  },
  emptyState: {
    gridColumn: '1 / -1',
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
  firmwareCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  firmwareHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px'
  },
  firmwareIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: '#EEF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  firmwareInfo: {
    flex: 1,
    marginLeft: '12px'
  },
  firmwareVersion: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1F2937',
    margin: 0
  },
  firmwareModel: {
    fontSize: '13px',
    color: '#6B7280'
  },
  firmwareActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  stableBadge: {
    fontSize: '12px',
    padding: '2px 8px',
    background: '#10B98120',
    color: '#10B981',
    borderRadius: '4px',
    fontWeight: 500
  },
  stableBadgeSmall: {
    fontSize: '11px',
    padding: '1px 6px',
    background: '#10B98120',
    color: '#10B981',
    borderRadius: '3px'
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
  firmwareChangelog: {
    background: '#F9FAFB',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '12px'
  },
  changelogTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    margin: 0,
    marginBottom: '8px'
  },
  changelogContent: {
    fontSize: '13px',
    color: '#6B7280',
    margin: 0
  },
  firmwareFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  firmwareSize: {
    fontSize: '13px',
    color: '#6B7280'
  },
  firmwareDate: {
    fontSize: '13px',
    color: '#6B7280'
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
  currentVersionCard: {
    background: '#EEF2FF',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '20px'
  },
  currentVersionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  currentVersionLabel: {
    fontSize: '14px',
    color: '#6366F1',
    fontWeight: 500
  },
  currentVersionValue: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1F2937'
  },
  updatesSection: {
    marginBottom: '20px'
  },
  updatesTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    margin: 0,
    marginBottom: '12px'
  },
  updateCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#F9FAFB',
    borderRadius: '8px',
    marginBottom: '8px'
  },
  updateInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  updateVersion: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1F2937'
  },
  updateBtn: {
    padding: '6px 12px',
    background: '#6366F1',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '13px',
    cursor: 'pointer'
  },
  noUpdateSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '20px',
    background: '#10B98120',
    borderRadius: '8px',
    color: '#10B981',
    fontSize: '14px'
  },
  historySection: {
    marginTop: '20px'
  },
  historyTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    margin: 0,
    marginBottom: '12px'
  },
  historyList: {
    background: '#F9FAFB',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px',
    borderBottom: '1px solid #E5E7EB'
  },
  historyVersion: {
    fontSize: '13px',
    color: '#374151'
  },
  historyStatus: {
    fontSize: '13px',
    color: '#10B981'
  },
  historyDate: {
    fontSize: '13px',
    color: '#6B7280'
  }
};
