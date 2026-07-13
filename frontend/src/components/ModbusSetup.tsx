import { useState, useEffect } from 'react';
import { addModbusDevice, testModbusConnection, scanModbusNetwork, ModbusRegisterMapping, ModbusScanResult, getModbusNetworkInfo, ModbusNetworkInfo, readModbusRawRegister, writeModbusRawRegister, getDevices } from '../api';
import { Device } from '../types';

function parseFloat32BE(values: number[]): string {
  if (values.length < 2) return 'N/A';
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint16(0, values[0] ?? 0, false); // 大端
  view.setUint16(2, values[1] ?? 0, false);
  const float = view.getFloat32(0, false);
  return float.toFixed(4);
}

interface ModbusSetupProps {
  onDeviceAdded?: () => void;
}

export function ModbusSetup({ onDeviceAdded }: ModbusSetupProps) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('502');
  const [slaveId, setSlaveId] = useState('1');
  const [name, setName] = useState('');
  const [model, setModel] = useState('2SR20B');
  const [testing, setTesting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [testResult, setTestResult] = useState<{ connected: boolean; message: string } | null>(null);
  const [scanResults, setScanResults] = useState<ModbusScanResult | null>(null);
  const [error, setError] = useState('');
  const [networkInfo, setNetworkInfo] = useState<ModbusNetworkInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'setup' | 'debug'>('setup');
  const [plcDevices, setPlcDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [debugType, setDebugType] = useState<'coil' | 'discrete' | 'holding' | 'input'>('holding');
  const [debugAddress, setDebugAddress] = useState('0');
  const [debugQuantity, setDebugQuantity] = useState('1');
  const [debugValue, setDebugValue] = useState('');
  const [debugResult, setDebugResult] = useState<unknown>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState('');
  const [debugMode, setDebugMode] = useState<'read' | 'write'>('read');

  useEffect(() => {
    loadNetworkInfo();
    loadPlcDevices();
  }, []);

  async function loadPlcDevices() {
    try {
      const devices = await getDevices();
      const plcList = devices.filter(d => d.type === 'plc' || d.brand === 'ModbusTCP');
      setPlcDevices(plcList);
      if (plcList.length > 0 && !selectedDevice) {
        setSelectedDevice(plcList[0].id);
      }
    } catch (err) {
      console.error('Failed to load PLC devices:', err);
    }
  }

  async function loadNetworkInfo() {
    try {
      const info = await getModbusNetworkInfo();
      if (info) {
        setNetworkInfo(info);
      }
    } catch (err) {
      console.error('Failed to load network info:', err);
    }
  }

  async function handleTest() {
    if (!host) { setError('请输入PLC的IP地址'); return; }
    setTesting(true);
    setError('');
    setTestResult(null);

    try {
      const result = await testModbusConnection(host, parseInt(port) || 502, parseInt(slaveId) || 1);
      if (result?.connected) {
        setTestResult({ connected: true, message: `连接成功！${result.host}:${result.port} (Slave ${result.slaveId})` });
      } else {
        setTestResult({ connected: false, message: '连接失败，请检查IP地址、端口和PLC配置' });
      }
    } catch (err) {
      setTestResult({ connected: false, message: `连接错误：${(err as Error).message}` });
    }
    setTesting(false);
  }

  async function handleAdd() {
    if (!host) { setError('请输入PLC的IP地址'); return; }
    setAdding(true);
    setError('');

    try {
      const result = await addModbusDevice({
        name: name || `PLC ${host}`,
        host,
        port: parseInt(port) || 502,
        slaveId: parseInt(slaveId) || 1,
        model,
      });

      if (result) {
        setTestResult({ connected: true, message: `设备添加成功！ID: ${result.id}` });
        onDeviceAdded?.();
        loadPlcDevices();
      } else {
        setError('添加设备失败');
      }
    } catch (err) {
      setError(`添加失败：${(err as Error).message}`);
    }
    setAdding(false);
  }

  async function handleScan() {
    setScanning(true);
    setError('');
    setScanResults(null);

    try {
      let baseIpToScan = '';
      if (host) {
        const parts = host.split('.');
        if (parts.length >= 3) {
          baseIpToScan = parts.slice(0, 3).join('.');
        }
      }
      if (!baseIpToScan && networkInfo?.defaultBaseIp) {
        baseIpToScan = networkInfo.defaultBaseIp;
      }
      const result = await scanModbusNetwork(baseIpToScan, parseInt(port) || 502, parseInt(slaveId) || 1);
      setScanResults(result);
    } catch (err) {
      setError(`扫描失败：${(err as Error).message}`);
    }
    setScanning(false);
  }

  async function handleDebugRead() {
    if (!selectedDevice) { setDebugError('请选择设备'); return; }
    setDebugLoading(true);
    setDebugError('');
    setDebugResult(null);

    try {
      const result = await readModbusRawRegister(
        selectedDevice,
        debugType,
        parseInt(debugAddress) || 0,
        parseInt(debugQuantity) || 1
      );
      if (result) {
        setDebugResult(result.value);
      } else {
        setDebugError('读取失败');
      }
    } catch (err) {
      setDebugError(`读取错误：${(err as Error).message}`);
    }
    setDebugLoading(false);
  }

  async function handleDebugWrite() {
    if (!selectedDevice) { setDebugError('请选择设备'); return; }
    if (debugValue === '') { setDebugError('请输入写入值'); return; }
    setDebugLoading(true);
    setDebugError('');
    setDebugResult(null);

    try {
      let val: boolean | number;
      if (debugType === 'coil') {
        val = debugValue === 'true' || debugValue === '1' || debugValue === 'TRUE';
      } else {
        val = parseFloat(debugValue) || 0;
      }
      const result = await writeModbusRawRegister(
        selectedDevice,
        debugType as 'coil' | 'holding',
        parseInt(debugAddress) || 0,
        val
      );
      if (result?.success) {
        setDebugResult({ written: val });
      } else {
        setDebugError('写入失败');
      }
    } catch (err) {
      setDebugError(`写入错误：${(err as Error).message}`);
    }
    setDebugLoading(false);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Modbus TCP 设备配置</h2>
          <p style={styles.subtitle}>连接 2SR20B / S7-200 SMART PLC</p>
        </div>
        <div style={styles.badge}>Modbus TCP</div>
      </div>

      <div style={styles.tabs}>
        <button style={{ ...styles.tab, ...(activeTab === 'setup' ? styles.tabActive : {}) }} onClick={() => setActiveTab('setup')}>
          连接配置
        </button>
        <button style={{ ...styles.tab, ...(activeTab === 'debug' ? styles.tabActive : {}) }} onClick={() => setActiveTab('debug')}>
          调试终端
        </button>
      </div>

      <div style={styles.panel}>
        {activeTab === 'setup' && (
          <>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>连接配置</h3>

          <div style={styles.formGroup}>
            <label style={styles.label}>设备名称</label>
            <input style={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="如：生产线PLC" />
          </div>

          <div style={styles.row}>
            <div style={{ ...styles.formGroup, flex: 2 }}>
              <label style={styles.label}>PLC IP 地址 *</label>
              <input style={styles.input} value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.1.10" />
            </div>
            <div style={{ ...styles.formGroup, flex: 1 }}>
              <label style={styles.label}>端口</label>
              <input style={styles.input} value={port} onChange={e => setPort(e.target.value)} placeholder="502" />
            </div>
            <div style={{ ...styles.formGroup, flex: 1 }}>
              <label style={styles.label}>Slave ID</label>
              <input style={styles.input} value={slaveId} onChange={e => setSlaveId(e.target.value)} placeholder="1" />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>PLC 型号</label>
            <select style={styles.select} value={model} onChange={e => setModel(e.target.value)}>
              <option value="2SR20B">2SR20B (兼容 S7-200 SMART)</option>
              <option value="S7-200SMART">S7-200 SMART</option>
              <option value="S7-1200">S7-1200</option>
              <option value="S7-1500">S7-1500</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          <div style={styles.buttonRow}>
            <button style={styles.testButton} onClick={handleTest} disabled={testing || !host}>
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button style={styles.scanButton} onClick={handleScan} disabled={scanning}>
              {scanning ? '扫描中...' : '扫描局域网'}
            </button>
            <button style={styles.addButton} onClick={handleAdd} disabled={adding || !host}>
              {adding ? '添加中...' : '添加设备'}
            </button>
          </div>

          {testResult && (
            <div style={{ ...styles.resultBox, ...(testResult.connected ? styles.resultSuccess : styles.resultError) }}>
              <span style={styles.resultIcon}>{testResult.connected ? '✓' : '✗'}</span>
              {testResult.message}
            </div>
          )}

          {error && <div style={styles.errorBox}>{error}</div>}
        </div>

        {scanResults && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                扫描结果 ({scanResults.devices.length} 台设备)
                {scanResults.baseIp && <span style={styles.scanRange}>网段: {scanResults.baseIp}.*</span>}
              </h3>
              {scanResults.devices.length > 0 ? (
                <div style={styles.scanList}>
                  {scanResults.devices.map((device, idx) => (
                    <div key={idx} style={styles.scanItem}>
                      <div style={styles.scanInfo}>
                        <span style={styles.scanHost}>{device.host}</span>
                        <span style={styles.scanPort}>:{device.port} Slave {device.slaveId}</span>
                      </div>
                      <button style={styles.scanAddButton} onClick={() => { setHost(device.host); setPort(String(device.port)); setSlaveId(String(device.slaveId)); }}>
                        使用
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.scanEmpty}>
                  <p>未发现 Modbus TCP 设备</p>
                  <p style={styles.scanEmptyHint}>请检查：1) PLC 是否已上电并连接网络 2) Modbus TCP 服务是否已启用 3) 端口 502 是否开放</p>
                </div>
              )}
            </div>
          )}

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>S7-200 SMART 寄存器映射说明</h3>
          <div style={styles.infoGrid}>
            <div style={styles.infoCard}>
              <div style={styles.infoCardTitle}>线圈 (Q区)</div>
              <div style={styles.infoCardContent}>
                <div>类型：Coil (功能码 01/05)</div>
                <div>地址：0~7 对应 Q0.0~Q0.7</div>
                <div>读写：可读可写</div>
              </div>
            </div>
            <div style={styles.infoCard}>
              <div style={styles.infoCardTitle}>离散输入 (I区)</div>
              <div style={styles.infoCardContent}>
                <div>类型：Discrete (功能码 02)</div>
                <div>地址：0~7 对应 I0.0~I0.7</div>
                <div>读写：只读</div>
              </div>
            </div>
            <div style={styles.infoCard}>
              <div style={styles.infoCardTitle}>保持寄存器 (V区)</div>
              <div style={styles.infoCardContent}>
                <div>类型：Holding (功能码 03/06/16)</div>
                <div>地址：VW0, VW2, VW4...</div>
                <div>读写：可读可写</div>
              </div>
            </div>
            <div style={styles.infoCard}>
              <div style={styles.infoCardTitle}>输入寄存器 (AI)</div>
              <div style={styles.infoCardContent}>
                <div>类型：Input (功能码 04)</div>
                <div>地址：AIW0, AIW2...</div>
                <div>读写：只读</div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.hintBox}>
          <strong>提示：</strong>确保 PLC 已启用 Modbus TCP 服务。S7-200 SMART 需要在编程软件中调用 MBUS_SERVER 指令，并配置好 V 区映射。默认端口 502。
        </div>
          </>
        )}

        {activeTab === 'debug' && (
          <div style={styles.debugSection}>
            <h3 style={styles.sectionTitle}>调试终端</h3>

            <div style={styles.formGroup}>
              <label style={styles.label}>选择设备</label>
              <select
                style={styles.select}
                value={selectedDevice}
                onChange={e => setSelectedDevice(e.target.value)}
              >
                {plcDevices.length === 0 && <option value="">暂无 PLC 设备，请先添加</option>}
                {plcDevices.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.ipAddress})</option>
                ))}
              </select>
            </div>

            <div style={styles.row}>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>操作模式</label>
                <div style={styles.modeSwitch}>
                  <button
                    style={{ ...styles.modeBtn, ...(debugMode === 'read' ? styles.modeBtnActive : {}) }}
                    onClick={() => setDebugMode('read')}
                  >
                    读取
                  </button>
                  <button
                    style={{ ...styles.modeBtn, ...(debugMode === 'write' ? styles.modeBtnActive : {}) }}
                    onClick={() => setDebugMode('write')}
                  >
                    写入
                  </button>
                </div>
              </div>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>寄存器类型</label>
                <select
                  style={styles.select}
                  value={debugType}
                  onChange={e => setDebugType(e.target.value as typeof debugType)}
                >
                  <option value="coil">线圈 (Coil / Q区)</option>
                  <option value="discrete">离散输入 (Discrete / I区)</option>
                  <option value="holding">保持寄存器 (Holding / VW区)</option>
                  <option value="input">输入寄存器 (Input / AIW区)</option>
                </select>
              </div>
            </div>

            <div style={styles.row}>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>起始地址</label>
                <input
                  type="number"
                  style={styles.input}
                  value={debugAddress}
                  onChange={e => setDebugAddress(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>数量</label>
                <input
                  type="number"
                  style={styles.input}
                  value={debugQuantity}
                  onChange={e => setDebugQuantity(e.target.value)}
                  placeholder="1"
                  disabled={debugMode === 'write'}
                />
              </div>
            </div>

            {debugMode === 'write' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  写入值 {debugType === 'coil' ? '(true/false 或 1/0)' : '(数值)'}
                </label>
                <input
                  style={styles.input}
                  value={debugValue}
                  onChange={e => setDebugValue(e.target.value)}
                  placeholder={debugType === 'coil' ? 'true' : '0'}
                />
              </div>
            )}

            <div style={styles.buttonRow}>
              <button
                style={debugMode === 'read' ? styles.addButton : styles.scanButton}
                onClick={debugMode === 'read' ? handleDebugRead : handleDebugWrite}
                disabled={debugLoading || !selectedDevice}
              >
                {debugLoading ? '执行中...' : (debugMode === 'read' ? '读取寄存器' : '写入寄存器')}
              </button>
            </div>

            {debugError && <div style={styles.errorBox}>{debugError}</div>}

            {debugResult !== null && (
              <div style={styles.debugResult}>
                <div style={styles.debugResultTitle}>执行结果</div>
                <pre style={styles.debugResultContent}>
{JSON.stringify(debugResult, null, 2)}
                </pre>
                {Array.isArray(debugResult) && debugResult.length >= 2 && (
                  <div style={styles.float32Result}>
                    <span style={styles.float32Label}>Float32 解析（大端）:</span>
                    <span style={styles.float32Value}>{parseFloat32BE(debugResult)}</span>
                  </div>
                )}
              </div>
            )}

            <div style={styles.quickRef}>
              <div style={styles.quickRefTitle}>快速参考</div>
              <div style={styles.quickRefGrid}>
                <div style={styles.quickRefItem} onClick={() => { setDebugType('coil'); setDebugAddress('0'); setDebugMode('read'); }}>
                  读 Q0.0
                </div>
                <div style={styles.quickRefItem} onClick={() => { setDebugType('coil'); setDebugAddress('0'); setDebugMode('write'); setDebugValue('true'); }}>
                  置位 Q0.0
                </div>
                <div style={styles.quickRefItem} onClick={() => { setDebugType('holding'); setDebugAddress('0'); setDebugMode('read'); }}>
                  读 VW0
                </div>
                <div style={styles.quickRefItem} onClick={() => { setDebugType('holding'); setDebugAddress('0'); setDebugMode('write'); setDebugValue('100'); }}>
                  写 VW0 = 100
                </div>
                <div style={styles.quickRefItem} onClick={() => { setDebugType('input'); setDebugAddress('0'); setDebugMode('read'); }}>
                  读 AIW0
                </div>
                <div style={styles.quickRefItem} onClick={() => { setDebugType('discrete'); setDebugAddress('0'); setDebugMode('read'); }}>
                  读 I0.0
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: { flex: 1, padding: '24px', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#1A1A1A', margin: 0 },
  subtitle: { fontSize: '13px', color: '#5B5B5B', marginTop: '4px', margin: 0 },
  badge: { padding: '6px 14px', background: 'rgba(0, 95, 184, 0.1)', color: '#005FB8', borderRadius: '6px', fontSize: '13px', fontWeight: 600 },
  panel: { background: 'rgba(255, 255, 255, 0.72)', backdropFilter: 'blur(40px)', border: '1px solid rgba(0, 0, 0, 0.06)', borderRadius: '12px', padding: '24px' },
  section: { marginBottom: '24px' },
  sectionTitle: { fontSize: '15px', fontWeight: 600, color: '#1A1A1A', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)' },
  formGroup: { marginBottom: '14px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 500, color: '#5B5B5B', marginBottom: '6px' },
  input: { width: '100%', padding: '10px 14px', border: '1px solid rgba(0, 0, 0, 0.12)', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' },
  select: { width: '100%', padding: '10px 14px', border: '1px solid rgba(0, 0, 0, 0.12)', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' },
  row: { display: 'flex', gap: '12px' },
  buttonRow: { display: 'flex', gap: '10px', marginTop: '16px' },
  testButton: { padding: '10px 20px', background: 'rgba(0, 95, 184, 0.1)', border: '1px solid rgba(0, 95, 184, 0.2)', color: '#005FB8', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 },
  scanButton: { padding: '10px 20px', background: 'rgba(255, 140, 0, 0.1)', border: '1px solid rgba(255, 140, 0, 0.2)', color: '#FF8C00', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 },
  addButton: { padding: '10px 20px', background: '#005FB8', border: 'none', color: '#FFFFFF', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)' },
  resultBox: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '8px', marginTop: '14px', fontSize: '14px', fontWeight: 500 },
  resultSuccess: { background: 'rgba(16, 124, 16, 0.08)', color: '#107C10' },
  resultError: { background: 'rgba(196, 43, 28, 0.08)', color: '#C42B1C' },
  resultIcon: { fontSize: '16px', fontWeight: 700 },
  errorBox: { padding: '12px 16px', background: 'rgba(196, 43, 28, 0.08)', color: '#C42B1C', borderRadius: '8px', marginTop: '14px', fontSize: '14px' },
  scanList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  scanItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0, 0, 0, 0.02)', borderRadius: '8px' },
  scanInfo: { display: 'flex', alignItems: 'center', gap: '8px' },
  scanHost: { fontSize: '14px', fontWeight: 600, color: '#1A1A1A' },
  scanPort: { fontSize: '13px', color: '#5B5B5B' },
  scanAddButton: { padding: '6px 14px', background: 'rgba(0, 95, 184, 0.1)', border: '1px solid rgba(0, 95, 184, 0.2)', color: '#005FB8', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  scanRange: { marginLeft: '10px', fontSize: '12px', color: '#8A8A8A', fontWeight: 400 },
  scanEmpty: { padding: '20px', textAlign: 'center', background: 'rgba(0, 0, 0, 0.02)', borderRadius: '8px' },
  scanEmptyHint: { fontSize: '12px', color: '#8A8A8A', marginTop: '6px', margin: 0 },
  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' },
  infoCard: { padding: '14px', background: 'rgba(0, 0, 0, 0.02)', borderRadius: '8px', border: '1px solid rgba(0, 0, 0, 0.04)' },
  infoCardTitle: { fontSize: '13px', fontWeight: 600, color: '#1A1A1A', marginBottom: '8px' },
  infoCardContent: { fontSize: '12px', color: '#5B5B5B', lineHeight: '1.6' },
  hintBox: { padding: '14px 16px', background: 'rgba(0, 95, 184, 0.06)', borderRadius: '8px', fontSize: '13px', color: '#005FB8', lineHeight: '1.6' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '16px' },
  tab: {
    padding: '10px 24px',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.6)',
    color: '#5B5B5B',
    borderRadius: '10px 10px 0 0',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  tabActive: {
    background: 'rgba(255, 255, 255, 0.88)',
    color: '#005FB8',
    fontWeight: 600,
  },
  debugSection: {},
  modeSwitch: { display: 'flex', gap: '4px', background: 'rgba(0, 0, 0, 0.04)', padding: '4px', borderRadius: '8px' },
  modeBtn: {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    background: 'transparent',
    color: '#5B5B5B',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  modeBtnActive: {
    background: '#FFFFFF',
    color: '#005FB8',
    fontWeight: 600,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
  },
  debugResult: {
    marginTop: '16px',
    padding: '14px 16px',
    background: 'rgba(0, 0, 0, 0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
  },
  debugResultTitle: { fontSize: '13px', fontWeight: 600, color: '#1A1A1A', marginBottom: '8px' },
  debugResultContent: {
    margin: 0,
    fontSize: '12px',
    color: '#5B5B5B',
    fontFamily: 'Consolas, Monaco, monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  quickRef: { marginTop: '24px' },
  quickRefTitle: { fontSize: '13px', fontWeight: 600, color: '#5B5B5B', marginBottom: '10px' },
  quickRefGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '8px',
  },
  quickRefItem: {
    padding: '8px 12px',
    background: 'rgba(0, 95, 184, 0.06)',
    color: '#005FB8',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s',
  },
  float32Result: {
    marginTop: '10px',
    padding: '10px 14px',
    background: 'rgba(16, 124, 16, 0.06)',
    borderRadius: '6px',
    fontSize: '13px',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  float32Label: {
    color: '#5B5B5B',
    fontWeight: 500,
  },
  float32Value: {
    color: '#107C10',
    fontWeight: 700,
    fontFamily: 'Consolas, Monaco, monospace',
  },
};
