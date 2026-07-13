import { useState, useEffect } from 'react';
import { Device, ModbusRegisterMapping, DeviceState } from '../types';
import { getModbusRegisters, updateModbusRegisters, getS7SmartTemplate, setDeviceState } from '../api';
import { PlcTrendChart } from './PlcTrendChart';

interface PlcSettingsPanelProps {
  device: Device;
  deviceState?: DeviceState;
  onClose: () => void;
  onUpdated?: () => void;
}

export function PlcSettingsPanel({ device, deviceState, onClose, onUpdated }: PlcSettingsPanelProps) {
  const [registers, setRegisters] = useState<ModbusRegisterMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'registers' | 'info' | 'trend'>('data');
  const [editingRegister, setEditingRegister] = useState<ModbusRegisterMapping | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [localState, setLocalState] = useState<DeviceState | undefined>(deviceState);

  useEffect(() => {
    loadRegisters();
    if (deviceState) {
      setLocalState(deviceState);
    }
  }, [device.id]);

  async function loadRegisters() {
    setLoading(true);
    try {
      const result = await getModbusRegisters(device.id);
      if (result?.registers) {
        setRegisters(result.registers);
      }
    } catch (err) {
      console.error('Failed to load registers:', err);
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateModbusRegisters(device.id, registers);
      if (result?.success) {
        onUpdated?.();
        onClose();
      }
    } catch (err) {
      console.error('Failed to save registers:', err);
    }
    setSaving(false);
  }

  async function handleLoadTemplate() {
    try {
      const template = await getS7SmartTemplate();
      if (template?.registerMap) {
        setRegisters(template.registerMap);
      }
    } catch (err) {
      console.error('Failed to load template:', err);
    }
  }

  function handleAddRegister() {
    const newRegister: ModbusRegisterMapping = {
      property: `reg_${Date.now()}`,
      type: 'holding',
      address: 0,
      quantity: 1,
      dataType: 'int16',
      writable: true,
      scale: 1,
      unit: '',
    };
    setRegisters([...registers, newRegister]);
    setEditingRegister(newRegister);
    setShowAddForm(true);
  }

  function handleEditRegister(reg: ModbusRegisterMapping) {
    setEditingRegister({ ...reg });
    setShowAddForm(true);
  }

  function handleDeleteRegister(index: number) {
    const newRegisters = [...registers];
    newRegisters.splice(index, 1);
    setRegisters(newRegisters);
  }

  function handleSaveEdit() {
    if (!editingRegister) return;
    const idx = registers.findIndex(r => r.property === editingRegister.property);
    if (idx >= 0) {
      const newRegisters = [...registers];
      newRegisters[idx] = editingRegister;
      setRegisters(newRegisters);
    } else {
      setRegisters([...registers, editingRegister]);
    }
    setShowAddForm(false);
    setEditingRegister(null);
  }

  async function handleToggleOutput(coilKey: string) {
    const currentVal = localState?.[coilKey as keyof DeviceState];
    const newVal = !currentVal;
    try {
      await setDeviceState(device.id, { [coilKey]: newVal });
      setLocalState(prev => ({ ...prev, [coilKey]: newVal } as DeviceState));
    } catch (err) {
      console.error('Failed to toggle output:', err);
    }
  }

  function getTypeLabel(type: string) {
    const map: Record<string, string> = {
      coil: '线圈 (Q)',
      discrete: '离散输入 (I)',
      holding: '保持寄存器 (VW)',
      input: '输入寄存器 (AIW)',
    };
    return map[type] || type;
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{device.name} - PLC 设置</h2>
            <p style={styles.subtitle}>{device.model || 'PLC'} · {device.ipAddress || ''}</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(activeTab === 'data' ? styles.tabActive : {}) }} onClick={() => setActiveTab('data')}>
            寄存器数据
          </button>
          <button style={{ ...styles.tab, ...(activeTab === 'trend' ? styles.tabActive : {}) }} onClick={() => setActiveTab('trend')}>
            趋势图表
          </button>
          <button style={{ ...styles.tab, ...(activeTab === 'registers' ? styles.tabActive : {}) }} onClick={() => setActiveTab('registers')}>
            寄存器映射
          </button>
          <button style={{ ...styles.tab, ...(activeTab === 'info' ? styles.tabActive : {}) }} onClick={() => setActiveTab('info')}>
            设备信息
          </button>
        </div>

        <div style={styles.content}>
          {activeTab === 'data' && (
            <div style={styles.section}>
              {!localState ? (
                <div style={styles.emptyState}>暂无数据，请确保设备已连接</div>
              ) : (
                <>
                  <div style={styles.plcSection}>
                    <div style={styles.plcSectionTitle}>输出 (Q)</div>
                    <div style={styles.ioGrid}>
                      {[0, 1, 2, 3, 4, 5, 6, 7].map(bit => {
                        const coilKey = bit === 0 ? 'power' : `coil${bit}`;
                        const val = localState?.[coilKey as keyof DeviceState];
                        return (
                          <button
                            key={`q-${bit}`}
                            style={{
                              ...styles.ioBit,
                              ...(val ? styles.ioBitOn : styles.ioBitOff),
                            }}
                            onClick={() => handleToggleOutput(coilKey)}
                            title={`Q0.${bit}`}
                          >
                            <div style={styles.ioBitLabel}>Q0.{bit}</div>
                            <div style={{ ...styles.ioDot, ...(val ? styles.ioDotOn : styles.ioDotOff) }} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={styles.plcSection}>
                    <div style={styles.plcSectionTitle}>输入 (I)</div>
                    <div style={styles.ioGrid}>
                      {[0, 1, 2, 3, 4, 5, 6, 7].map(bit => {
                        const inputKey = `input${bit}`;
                        const val = localState?.[inputKey as keyof DeviceState];
                        return (
                          <div
                            key={`i-${bit}`}
                            style={{
                              ...styles.ioBit,
                              ...styles.ioBitReadOnly,
                              ...(val ? styles.ioBitOn : styles.ioBitOff),
                            }}
                            title={`I0.${bit}`}
                          >
                            <div style={styles.ioBitLabel}>I0.{bit}</div>
                            <div style={{ ...styles.ioDot, ...(val ? styles.ioDotOn : styles.ioDotOff) }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={styles.plcSection}>
                    <div style={styles.plcSectionTitle}>寄存器数据</div>
                    <div style={styles.registerList}>
                      {['value', 'temperature', 'humidity', 'pressure', 'analogInput0', 'analogInput1'].map(key => {
                        const val = localState?.[key as keyof DeviceState];
                        if (val === undefined) return null;
                        const labelMap: Record<string, string> = {
                          value: 'VW0 (数值)',
                          temperature: '温度',
                          humidity: '湿度',
                          pressure: '压力',
                          analogInput0: 'AIW0',
                          analogInput1: 'AIW1',
                        };
                        const unitMap: Record<string, string> = {
                          temperature: '°C',
                          humidity: '%',
                          pressure: 'kPa',
                        };
                        return (
                          <div key={key} style={styles.registerItem}>
                            <span style={styles.registerLabel}>{labelMap[key] || key}</span>
                            <span style={styles.registerValue}>
                              {typeof val === 'number' ? val.toFixed(1) : String(val)}
                              {unitMap[key] || ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'trend' && (
            <div style={styles.section}>
              <div style={styles.trendGrid}>
                <PlcTrendChart deviceId={device.id} property="temperature" title="温度" color="#ff6b6b" />
                <PlcTrendChart deviceId={device.id} property="humidity" title="湿度" color="#4ecdc4" />
                <PlcTrendChart deviceId={device.id} property="pressure" title="压力" color="#45b7d1" />
                <PlcTrendChart deviceId={device.id} property="value" title="VW0" color="#96ceb4" />
              </div>
            </div>
          )}

          {activeTab === 'registers' && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>寄存器列表 ({registers.length})</span>
                <div style={styles.actionRow}>
                  <button style={styles.secondaryBtn} onClick={handleLoadTemplate}>
                    加载默认模板
                  </button>
                  <button style={styles.primaryBtn} onClick={handleAddRegister}>
                    + 添加寄存器
                  </button>
                </div>
              </div>

              {loading ? (
                <div style={styles.emptyState}>加载中...</div>
              ) : registers.length === 0 ? (
                <div style={styles.emptyState}>
                  <p>暂无寄存器映射</p>
                  <button style={styles.primaryBtn} onClick={handleLoadTemplate}>加载默认模板</button>
                </div>
              ) : (
                <div style={styles.registerTable}>
                  <div style={styles.tableHeader}>
                    <div style={{ ...styles.th, flex: 1.5 }}>属性名</div>
                    <div style={{ ...styles.th, flex: 1.2 }}>类型</div>
                    <div style={styles.th}>地址</div>
                    <div style={styles.th}>数据类型</div>
                    <div style={styles.th}>缩放</div>
                    <div style={styles.th}>单位</div>
                    <div style={{ ...styles.th, flex: 0.6 }}>可写</div>
                    <div style={{ ...styles.th, flex: 1 }}>操作</div>
                  </div>
                  {registers.map((reg, idx) => (
                    <div key={idx} style={styles.tableRow}>
                      <div style={{ ...styles.td, flex: 1.5 }}>{reg.property}</div>
                      <div style={{ ...styles.td, flex: 1.2 }}>{getTypeLabel(reg.type)}</div>
                      <div style={styles.td}>{reg.address}</div>
                      <div style={styles.td}>{reg.dataType}</div>
                      <div style={styles.td}>{reg.scale ?? 1}</div>
                      <div style={styles.td}>{reg.unit || '-'}</div>
                      <div style={{ ...styles.td, flex: 0.6 }}>{reg.writable ? '是' : '否'}</div>
                      <div style={{ ...styles.td, flex: 1, gap: '6px' }}>
                        <button style={styles.linkBtn} onClick={() => handleEditRegister(reg)}>编辑</button>
                        <button style={{ ...styles.linkBtn, color: '#C42B1C' }} onClick={() => handleDeleteRegister(idx)}>删除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'info' && (
            <div style={styles.infoSection}>
              <div className="device-info-row" style={styles.infoRow}>
                <span style={styles.infoLabel}>设备名称</span>
                <span style={styles.infoValue}>{device.name}</span>
              </div>
              <div className="device-info-row" style={styles.infoRow}>
                <span style={styles.infoLabel}>设备型号</span>
                <span style={styles.infoValue}>{device.model || '-'}</span>
              </div>
              <div className="device-info-row" style={styles.infoRow}>
                <span style={styles.infoLabel}>设备类型</span>
                <span style={styles.infoValue}>PLC</span>
              </div>
              <div className="device-info-row" style={styles.infoRow}>
                <span style={styles.infoLabel}>IP 地址</span>
                <span style={styles.infoValue}>{device.ipAddress || '-'}</span>
              </div>
              <div className="device-info-row" style={styles.infoRow}>
                <span style={styles.infoLabel}>连接方式</span>
                <span style={styles.infoValue}>以太网 (Modbus TCP)</span>
              </div>
              <div className="device-info-row" style={styles.infoRow}>
                <span style={styles.infoLabel}>设备状态</span>
                <span style={{ ...styles.infoValue, color: device.status === 'online' ? '#107C10' : '#C42B1C' }}>
                  {device.status === 'online' ? '在线' : '离线'}
                </span>
              </div>
              <div className="device-info-row" style={styles.infoRow}>
                <span style={styles.infoLabel}>SN 序列号</span>
                <span style={styles.infoValue}>{device.sn || '-'}</span>
              </div>
              <div className="device-info-row" style={styles.infoRow}>
                <span style={styles.infoLabel}>固件版本</span>
                <span style={styles.infoValue}>{device.firmwareVersion || '-'}</span>
              </div>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>取消</button>
          <button style={styles.saveBtn} onClick={handleSave} disabled={saving || loading}>
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>

        {showAddForm && editingRegister && (
          <div style={styles.modalOverlay} onClick={() => { setShowAddForm(false); setEditingRegister(null); }}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
              <h3 style={styles.modalTitle}>编辑寄存器</h3>
              <div style={styles.formGroup}>
                <label style={styles.label}>属性名</label>
                <input
                  style={styles.input}
                  value={editingRegister.property}
                  onChange={e => setEditingRegister({ ...editingRegister, property: e.target.value })}
                  placeholder="如: temperature"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>寄存器类型</label>
                <select
                  style={styles.select}
                  value={editingRegister.type}
                  onChange={e => setEditingRegister({ ...editingRegister, type: e.target.value as ModbusRegisterMapping['type'] })}
                >
                  <option value="coil">线圈 (Coil / Q区)</option>
                  <option value="discrete">离散输入 (Discrete / I区)</option>
                  <option value="holding">保持寄存器 (Holding / VW区)</option>
                  <option value="input">输入寄存器 (Input / AIW区)</option>
                </select>
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>起始地址</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={editingRegister.address}
                    onChange={e => setEditingRegister({ ...editingRegister, address: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>数量</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={editingRegister.quantity}
                    onChange={e => setEditingRegister({ ...editingRegister, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>数据类型</label>
                  <select
                    style={styles.select}
                    value={editingRegister.dataType}
                    onChange={e => setEditingRegister({ ...editingRegister, dataType: e.target.value as ModbusRegisterMapping['dataType'] })}
                  >
                    <option value="bool">bool</option>
                    <option value="int16">int16</option>
                    <option value="uint16">uint16</option>
                    <option value="float32">float32</option>
                    <option value="string">string</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>缩放系数</label>
                  <input
                    type="number"
                    step="0.1"
                    style={styles.input}
                    value={editingRegister.scale ?? 1}
                    onChange={e => setEditingRegister({ ...editingRegister, scale: parseFloat(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>单位</label>
                  <input
                    style={styles.input}
                    value={editingRegister.unit || ''}
                    onChange={e => setEditingRegister({ ...editingRegister, unit: e.target.value })}
                    placeholder="如: °C, %, kPa"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>可写</label>
                  <select
                    style={styles.select}
                    value={editingRegister.writable ? 'true' : 'false'}
                    onChange={e => setEditingRegister({ ...editingRegister, writable: e.target.value === 'true' })}
                  >
                    <option value="true">是</option>
                    <option value="false">否</option>
                  </select>
                </div>
              </div>
              <div style={styles.modalActions}>
                <button style={styles.cancelBtn} onClick={() => { setShowAddForm(false); setEditingRegister(null); }}>取消</button>
                <button style={styles.primaryBtn} onClick={handleSaveEdit}>确认</button>
              </div>
            </div>
          </div>
        )}
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
    background: 'rgba(0, 0, 0, 0.4)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'fadeIn 0.2s ease-out',
  },
  panel: {
    background: '#FFFFFF',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
    animation: 'slideUp 0.25s ease-out',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px 28px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  title: { fontSize: '20px', fontWeight: 700, color: '#1A1A1A', margin: 0 },
  subtitle: { fontSize: '13px', color: '#8A8A8A', marginTop: '4px', margin: 0 },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#8A8A8A',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    padding: '16px 28px 0',
  },
  tab: {
    padding: '8px 20px',
    border: 'none',
    background: 'rgba(0, 0, 0, 0.04)',
    color: '#5B5B5B',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  tabActive: {
    background: 'rgba(0, 95, 184, 0.1)',
    color: '#005FB8',
    fontWeight: 600,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 28px',
  },
  section: {},
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: { fontSize: '15px', fontWeight: 600, color: '#1A1A1A' },
  actionRow: { display: 'flex', gap: '8px' },
  primaryBtn: {
    padding: '8px 16px',
    background: '#005FB8',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  secondaryBtn: {
    padding: '8px 16px',
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
    border: '1px solid rgba(0, 95, 184, 0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  registerTable: {
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex',
    background: 'rgba(0, 0, 0, 0.03)',
    padding: '10px 14px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#5B5B5B',
  },
  th: { flex: 1, textAlign: 'left' },
  tableRow: {
    display: 'flex',
    padding: '10px 14px',
    borderTop: '1px solid rgba(0, 0, 0, 0.04)',
    fontSize: '13px',
    color: '#1A1A1A',
    alignItems: 'center',
  },
  td: { flex: 1, display: 'flex', alignItems: 'center', gap: '8px' },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#005FB8',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 4px',
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: '#8A8A8A',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  infoSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderRadius: '8px',
    cursor: 'default',
    transition: 'background 0.15s',
  },
  infoLabel: { fontSize: '13px', color: '#5B5B5B', fontWeight: 500 },
  infoValue: { fontSize: '13px', color: '#1A1A1A', fontWeight: 500 },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '20px 28px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  cancelBtn: {
    padding: '10px 24px',
    background: 'rgba(0, 0, 0, 0.04)',
    color: '#5B5B5B',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  saveBtn: {
    padding: '10px 24px',
    background: '#005FB8',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '16px',
    zIndex: 10,
  },
  modalContent: {
    background: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    width: '90%',
    maxWidth: '480px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
  },
  modalTitle: { fontSize: '17px', fontWeight: 600, color: '#1A1A1A', margin: '0 0 20px 0' },
  formGroup: { marginBottom: '14px' },
  formRow: { display: 'flex', gap: '12px' },
  label: { display: 'block', fontSize: '12px', color: '#5B5B5B', marginBottom: '6px', fontWeight: 500 },
  input: {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    background: '#FFFFFF',
    boxSizing: 'border-box',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
  plcSection: { marginBottom: '20px' },
  plcSectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#5B5B5B',
    marginBottom: '10px',
  },
  ioGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  ioBit: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 6px',
    borderRadius: '10px',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    background: 'rgba(0, 0, 0, 0.02)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  ioBitReadOnly: { cursor: 'default' },
  ioBitOn: {
    background: 'rgba(16, 124, 16, 0.08)',
    borderColor: 'rgba(16, 124, 16, 0.3)',
  },
  ioBitOff: {
    background: 'rgba(0, 0, 0, 0.02)',
  },
  ioBitLabel: {
    fontSize: '11px',
    color: '#5B5B5B',
    fontWeight: 500,
  },
  ioDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    transition: 'all 0.2s',
  },
  ioDotOn: {
    background: '#107C10',
    boxShadow: '0 0 8px rgba(16, 124, 16, 0.5)',
  },
  ioDotOff: {
    background: '#BDBDBD',
  },
  registerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  registerItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
    fontSize: '13px',
  },
  registerLabel: { color: '#5B5B5B' },
  registerValue: { color: '#1A1A1A', fontWeight: 600 },
};
