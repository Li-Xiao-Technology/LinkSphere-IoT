import { useState, useEffect, useRef } from 'react';
import { Device, DeviceState, Room, Schedule } from '../types';
import { getDeviceState, setDeviceState, getRooms, getSchedules, createSchedule, toggleSchedule, deleteSchedule, deleteDevice, pairYeelightBLE, renameDevice } from '../api';
import { useDeviceStore } from '../store/deviceStore';
import { DeviceInfoPanel } from './DeviceInfoPanel';
import { PlcSettingsPanel } from './PlcSettingsPanel';

interface DeviceControlPanelProps {
  onViewHistory?: (deviceId: string, deviceName: string) => void;
  onQuickAction?: (deviceId: string, action: string, value?: unknown) => void;
}

type DeviceGroup = {
  id: string;
  name: string;
  icon: string;
  devices: Device[];
};

type SelectedDevice = {
  id: string;
  name: string;
  type: string;
};

export function DeviceControlPanel({ onViewHistory, onQuickAction }: DeviceControlPanelProps) {
  const { devices: rawDevices } = useDeviceStore();
  const devices = Array.isArray(rawDevices) ? rawDevices : [];

  const [rooms, setRooms] = useState<Room[]>([]);
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroup[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<SelectedDevice[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [deviceStates, setDeviceStates] = useState<Record<string, DeviceState>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [batchLoading, setBatchLoading] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<{ deviceId: string; deviceName: string } | null>(null);
  const [deviceSchedules, setDeviceSchedules] = useState<Schedule[]>([]);
  const [moreMenuOpen, setMoreMenuOpen] = useState<Record<string, boolean>>({});
  const [infoDevice, setInfoDevice] = useState<Device | null>(null);
  const [settingsDevice, setSettingsDevice] = useState<Device | null>(null);
  const [renameDeviceModal, setRenameDeviceModal] = useState<{ deviceId: string; deviceName: string } | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');
  const [pairingDevice, setPairingDevice] = useState<string | null>(null);
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sliderTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      let clickedInsideMenu = false;
      menuRefs.current.forEach((ref) => {
        if (ref && ref.contains(event.target as Node)) {
          clickedInsideMenu = true;
        }
      });
      if (!clickedInsideMenu) {
        setMoreMenuOpen({});
      }
    }
    if (Object.values(moreMenuOpen).some(Boolean)) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [moreMenuOpen]);

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (devices.length > 0) {
      loadAllDeviceStates();
    }
  }, [devices]);

  useEffect(() => {
    updateDeviceGroups();
  }, [devices, rooms]);

  async function loadRooms() {
    try {
      const roomData = await getRooms();
      setRooms(roomData);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  }

  async function loadAllDeviceStates() {
    const loading: Record<string, boolean> = {};
    devices.forEach(device => {
      loading[device.id] = true;
    });
    setLoadingStates(loading);

    const promises = devices.map(async (device) => {
      try {
        const timeoutPromise = new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 8000)
        );
        
        const statePromise = getDeviceState(device.id);
        const state = await Promise.race([statePromise, timeoutPromise]);
        
        if (state) {
          setDeviceStates(prev => ({
            ...prev,
            [device.id]: state
          }));
        }
      } catch (error) {
        console.error(`Failed to load state for device ${device.id}:`, error);
      }
      
      setLoadingStates(prev => ({
        ...prev,
        [device.id]: false
      }));
    });

    await Promise.allSettled(promises);
  }

  function updateDeviceGroups() {
    const typeGroups: DeviceGroup[] = [
      { id: 'all', name: '全部设备', icon: 'M3 6h18M3 12h18M3 18h18', devices: devices },
      { id: 'light', name: '智能灯', icon: 'M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14', devices: [] },
      { id: 'switch', name: '开关', icon: 'M3 5h18v14H3zM8 12h.01M16 12h.01', devices: [] },
      { id: 'airconditioner', name: '空调', icon: 'M3 5h18v14H3zM6 10h12M6 14h8', devices: [] },
      { id: 'sensor', name: '传感器', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', devices: [] },
      { id: 'plc', name: 'PLC', icon: 'M4 4h16v16H4zM9 9h6v6H9z', devices: [] },
    ];

    devices.forEach(device => {
      const group = typeGroups.find(g => g.id === device.type);
      if (group) {
        group.devices.push(device);
      }
    });

    const roomGroups: DeviceGroup[] = rooms.map(room => ({
      id: `room-${room.id}`,
      name: room.name,
      icon: room.icon,
      devices: devices.filter(d => d.roomId === room.id),
    }));

    setDeviceGroups([...typeGroups, ...roomGroups]);
  }

  function toggleDeviceSelection(device: Device) {
    setSelectedDevices(prev => {
      const isSelected = prev.some(d => d.id === device.id);
      if (isSelected) {
        return prev.filter(d => d.id !== device.id);
      } else {
        return [...prev, { id: device.id, name: device.name, type: device.type }];
      }
    });
  }

  async function handleBatchPower(power: boolean) {
    setBatchLoading(true);
    const targets = batchMode ? selectedDevices : (currentGroup?.devices || []);
    const deviceIds = targets.map(d => 'id' in d ? d.id : (d as SelectedDevice).id);

    try {
      const response = await fetch('/api/batch/power', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ deviceIds, power })
      });
      const data = await response.json();
      if (data.success) {
        deviceIds.forEach(deviceId => {
          setDeviceStates(prev => ({
            ...prev,
            [deviceId]: { ...prev[deviceId], power }
          }));
        });
      }
    } catch (error) {
      console.error('Failed to batch update devices:', error);
    }

    setBatchLoading(false);
    setShowBatchActions(false);
  }

  function selectAllInGroup() {
    if (!currentGroup) return;
    const allSelected = currentGroup.devices.every(d => 
      selectedDevices.some(s => s.id === d.id)
    );
    
    if (allSelected) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(currentGroup.devices.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
      })));
    }
  }

  async function handleQuickSettings(deviceId: string, settings: Partial<DeviceState>) {
    try {
      await setDeviceState(deviceId, settings);
      setDeviceStates(prev => ({
        ...prev,
        [deviceId]: { ...prev[deviceId], ...settings }
      }));
      onQuickAction?.(deviceId, 'settings', settings);
    } catch (error) {
      console.error('Failed to apply quick settings:', error);
    }
  }

  function handleSliderChange(deviceId: string, property: string, value: number) {
    setDeviceStates(prev => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], [property]: value }
    }));

    const key = `${deviceId}-${property}`;
    if (sliderTimers.current[key]) {
      clearTimeout(sliderTimers.current[key]);
    }
    sliderTimers.current[key] = setTimeout(() => {
      handleQuickSettings(deviceId, { [property]: value });
    }, 300);
  }

  async function openScheduleModal(deviceId: string, deviceName: string) {
    const schedules = await getSchedules(deviceId);
    setDeviceSchedules(schedules);
    setScheduleModal({ deviceId, deviceName });
  }

  async function handleCreateSchedule(deviceId: string) {
    const hour = window.prompt('请输入小时 (0-23):', '7');
    const minute = window.prompt('请输入分钟 (0-59):', '0');
    const power = window.confirm('设置为开启状态？');
    
    if (hour !== null && minute !== null) {
      try {
        const cronExpression = `${minute} ${hour} * * *`;
        const action = JSON.stringify({ deviceId, parameters: { power } });
        const name = `${power ? '开启' : '关闭'} (${hour}:${minute})`;
        
        await createSchedule({ name, cronExpression, action, deviceId, enabled: true });
        const schedules = await getSchedules(deviceId);
        setDeviceSchedules(schedules);
      } catch (error) {
        console.error('Failed to create schedule:', error);
        window.alert('创建定时任务失败，请重试');
      }
    }
  }

  async function handleToggleSchedule(scheduleId: string, deviceId: string) {
    await toggleSchedule(scheduleId);
    const schedules = await getSchedules(deviceId);
    setDeviceSchedules(schedules);
  }

  async function handleDeleteSchedule(scheduleId: string, deviceId: string) {
    if (window.confirm('确定删除此定时任务？')) {
      await deleteSchedule(scheduleId);
      const schedules = await getSchedules(deviceId);
      setDeviceSchedules(schedules);
    }
  }

  async function handleDeleteDevice(deviceId: string, deviceName: string) {
    if (!window.confirm(`确定删除设备「${deviceName}」吗？此操作不可恢复。`)) return;
    try {
      const result = await deleteDevice(deviceId);
      if (result?.success) {
        useDeviceStore.getState().loadDevices();
      }
    } catch (error) {
      console.error('Failed to delete device:', error);
    }
  }

  const currentGroup = deviceGroups.find(g => g.id === activeGroup) || deviceGroups[0];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>设备控制面板</h2>
          <p style={styles.subtitle}>集中管理您的智能设备，一键控制全屋智能</p>
        </div>
        <button
          style={{
            ...styles.batchButton,
            ...(batchMode ? styles.batchButtonActive : {}),
          }}
          onClick={() => {
            setBatchMode(!batchMode);
            setSelectedDevices([]);
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span>{batchMode ? '取消批量' : '批量操作'}</span>
        </button>
      </div>

      {batchMode && selectedDevices.length > 0 && (
        <div style={styles.batchActionBar} className="anim-slide-up">
          <div style={styles.selectedInfo}>
            已选择 {selectedDevices.length} 个设备
          </div>
          <div style={styles.batchActions}>
            <button style={styles.batchActionButton} onClick={() => handleBatchPower(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
              <span>全部开启</span>
            </button>
            <button style={styles.batchActionButton} onClick={() => handleBatchPower(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <span>全部关闭</span>
            </button>
            <button style={styles.clearButton} onClick={() => setSelectedDevices([])}>
              清除选择
            </button>
          </div>
        </div>
      )}

      <div style={styles.groupTabs}>
        {deviceGroups.map(group => (
          <button
            key={group.id}
            style={{
              ...styles.groupTab,
              ...(activeGroup === group.id ? styles.groupTabActive : {}),
            }}
            onClick={() => setActiveGroup(group.id)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: group.icon }} />
            <span>{group.name}</span>
            <span style={styles.groupCount}>{group.devices.length}</span>
          </button>
        ))}
      </div>

      {currentGroup && currentGroup.devices.length > 0 && (
        <div style={styles.quickActionBar}>
          {batchMode ? (
            <>
              <button style={styles.quickActionBtn} onClick={selectAllInGroup}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <span>
                  {currentGroup.devices.every(d => selectedDevices.some(s => s.id === d.id)) 
                    ? '取消全选' 
                    : '全选当前组'}
                </span>
              </button>
            </>
          ) : (
            <>
              <button 
                style={{ ...styles.quickActionBtn, ...styles.quickActionOn }} 
                onClick={() => handleBatchPower(true)}
                disabled={batchLoading}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                  <line x1="12" y1="2" x2="12" y2="12" />
                </svg>
                <span>一键全开</span>
              </button>
              <button 
                style={styles.quickActionBtn} 
                onClick={() => handleBatchPower(false)}
                disabled={batchLoading}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                <span>一键全关</span>
              </button>
            </>
          )}
          {batchLoading && (
            <div style={styles.batchLoadingIndicator}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span>执行中...</span>
            </div>
          )}
        </div>
      )}

      {currentGroup && currentGroup.devices.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <div style={styles.emptyTitle}>该组暂无设备</div>
          <div style={styles.emptyDesc}>尝试添加设备或选择其他分组</div>
        </div>
      ) : (
        <div style={styles.deviceGrid}>
          {currentGroup?.devices.map(device => (
            <div
              key={device.id}
              style={{
                ...styles.deviceItem,
                cursor: batchMode ? 'pointer' : 'default',
                ...(selectedDevices.some(d => d.id === device.id) ? styles.deviceItemSelected : {}),
              }}
              onClick={() => batchMode && toggleDeviceSelection(device)}
              className="anim-slide-up"
            >
              {batchMode && (
                <div style={{
                  ...styles.selectionCheckbox,
                  ...(selectedDevices.some(d => d.id === device.id) ? styles.selectionCheckboxChecked : {}),
                }}>
                  {selectedDevices.some(d => d.id === device.id) && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              )}

              <div style={styles.deviceHeader}>
                <div style={styles.deviceIconContainer}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {device.type === 'light' && <path d="M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />}
                    {device.type === 'switch' && <rect x="3" y="5" width="18" height="14" rx="2" />}
                    {device.type === 'airconditioner' && <rect x="3" y="5" width="18" height="14" rx="2" />}
                    {device.type === 'sensor' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                    {device.type === 'plc' && (<><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /></>)}
                  </svg>
                </div>
                <div style={styles.deviceBasicInfo}>
                  <h3 style={styles.deviceName}>{device.name}</h3>
                  <div style={styles.deviceStatusRow}>
                    <div style={{
                      ...styles.statusBadge,
                      ...(device.status === 'online' ? styles.statusBadgeOnline : styles.statusBadgeOffline),
                    }}>
                      {device.status === 'online' ? '在线' : '离线'}
                    </div>
                    {!batchMode && loadingStates[device.id] && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              {!batchMode && (
                <div style={styles.deviceControls}>
                  {(device.type === 'light' || device.type === 'switch' || device.type === 'airconditioner' || device.type === 'waterheater' || device.type === 'airpurifier' || device.type === 'refrigerator') && (
                    <button
                      style={{
                        ...styles.powerToggle,
                        ...(deviceStates[device.id]?.power ? styles.powerToggleOn : {}),
                        ...(loadingStates[device.id] ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                      }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (loadingStates[device.id]) return;
                        const currentPower = deviceStates[device.id]?.power ?? false;
                        const newPower = !currentPower;
                        await setDeviceState(device.id, { power: newPower });
                        setDeviceStates(prev => ({
                          ...prev,
                          [device.id]: { ...prev[device.id], power: newPower }
                        }));
                      }}
                      disabled={loadingStates[device.id]}
                    >
                      {loadingStates[device.id] ? '加载中...' : (deviceStates[device.id]?.power ? '开启' : '关闭')}
                    </button>
                  )}
                  {device.type === 'plc' && (
                    <button
                      style={{
                        ...styles.powerToggle,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      disabled
                    >
                      开启
                    </button>
                  )}

                  {device.type === 'light' && deviceStates[device.id]?.brightness !== undefined && (
                    <div style={styles.sliderControl}>
                      <div style={styles.sliderHeader}>
                        <span style={styles.sliderLabel}>亮度</span>
                        <span style={styles.sliderValue}>{deviceStates[device.id]?.brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={deviceStates[device.id]?.brightness || 0}
                        onChange={(e) => {
                          handleSliderChange(device.id, 'brightness', parseInt(e.target.value));
                        }}
                        style={styles.slider}
                      />
                    </div>
                  )}

                  {device.type === 'light' && deviceStates[device.id]?.ct !== undefined && (
                    <div style={styles.sliderControl}>
                      <div style={styles.sliderHeader}>
                        <span style={styles.sliderLabel}>色温</span>
                        <span style={styles.sliderValue}>{deviceStates[device.id]?.ct}K</span>
                      </div>
                      <input
                        type="range"
                        min="1700"
                        max="6500"
                        value={deviceStates[device.id]?.ct || 4000}
                        onChange={(e) => {
                          handleSliderChange(device.id, 'ct', parseInt(e.target.value));
                        }}
                        style={styles.slider}
                      />
                    </div>
                  )}

                  {device.type === 'light' && deviceStates[device.id]?.rgb !== undefined && (
                    <div style={styles.colorControl}>
                      <span style={styles.sliderLabel}>颜色</span>
                      <div style={styles.colorPickerRow}>
                        {['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3', '#FFFFFF', '#FF69B4', '#00CED1'].map(color => {
                          const rgbVal = parseInt(color.replace('#', ''), 16);
                          const isActive = deviceStates[device.id]?.rgb === rgbVal;
                          return (
                            <button
                              key={color}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                border: isActive ? '2px solid #333' : '2px solid transparent',
                                backgroundColor: color,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleQuickSettings(device.id, { rgb: rgbVal });
                              }}
                              title={color}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {device.type === 'airconditioner' && deviceStates[device.id]?.temperature !== undefined && (
                    <div style={styles.sliderControl}>
                      <div style={styles.sliderHeader}>
                        <span style={styles.sliderLabel}>温度</span>
                        <span style={styles.sliderValue}>{deviceStates[device.id]?.temperature}°C</span>
                      </div>
                      <input
                        type="range"
                        min="16"
                        max="30"
                        value={deviceStates[device.id]?.temperature || 24}
                        onChange={(e) => {
                          handleSliderChange(device.id, 'temperature', parseInt(e.target.value));
                        }}
                        style={styles.slider}
                      />
                    </div>
                  )}

                  {device.type === 'waterheater' && deviceStates[device.id]?.temperature !== undefined && (
                    <div style={styles.sliderControl}>
                      <div style={styles.sliderHeader}>
                        <span style={styles.sliderLabel}>水温</span>
                        <span style={styles.sliderValue}>{deviceStates[device.id]?.temperature}°C</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="75"
                        value={deviceStates[device.id]?.temperature || 40}
                        onChange={(e) => {
                          handleSliderChange(device.id, 'temperature', parseInt(e.target.value));
                        }}
                        style={styles.slider}
                      />
                    </div>
                  )}

                  {device.type === 'refrigerator' && deviceStates[device.id]?.temperature !== undefined && (
                    <div style={styles.sliderControl}>
                      <div style={styles.sliderHeader}>
                        <span style={styles.sliderLabel}>冷藏温度</span>
                        <span style={styles.sliderValue}>{deviceStates[device.id]?.temperature}°C</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="10"
                        step="1"
                        value={deviceStates[device.id]?.temperature || 4}
                        onChange={(e) => {
                          handleSliderChange(device.id, 'temperature', parseInt(e.target.value));
                        }}
                        style={styles.slider}
                      />
                    </div>
                  )}

                  {device.type === 'airpurifier' && deviceStates[device.id]?.value !== undefined && (
                    <div style={styles.sliderControl}>
                      <div style={styles.sliderHeader}>
                        <span style={styles.sliderLabel}>风速</span>
                        <span style={styles.sliderValue}>{deviceStates[device.id]?.value}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={deviceStates[device.id]?.value || 0}
                        onChange={(e) => {
                          handleSliderChange(device.id, 'value', parseInt(e.target.value));
                        }}
                        style={styles.slider}
                      />
                    </div>
                  )}

                  {device.type === 'sensor' && (
                    <div style={styles.sensorReadings}>
                      {deviceStates[device.id]?.temperature !== undefined && (
                        <div style={styles.sensorReading}>
                          <span style={styles.sensorLabel}>温度</span>
                          <span style={styles.sensorValue}>{deviceStates[device.id]?.temperature}°C</span>
                        </div>
                      )}
                      {deviceStates[device.id]?.humidity !== undefined && (
                        <div style={styles.sensorReading}>
                          <span style={styles.sensorLabel}>湿度</span>
                          <span style={styles.sensorValue}>{deviceStates[device.id]?.humidity}%</span>
                        </div>
                      )}
                    </div>
                  )}


                </div>
              )}

              {!batchMode && (
                <div style={styles.deviceFooter} ref={(el) => { if (el) menuRefs.current.set(device.id, el); }}>
                  <button
                    style={styles.moreButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMoreMenuOpen(prev => ({ ...prev, [device.id]: !prev[device.id] }));
                    }}
                    title="更多操作"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="5" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>
                  {moreMenuOpen[device.id] && (
                    <div style={styles.moreMenu} className="device-more-menu">
                      <button className="device-more-menu-item" onClick={() => { setInfoDevice(device); setMoreMenuOpen(prev => ({ ...prev, [device.id]: false })); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        <span>设备信息</span>
                      </button>
                      <button className="device-more-menu-item" onClick={() => { setRenameInputValue(device.name); setRenameDeviceModal({ deviceId: device.id, deviceName: device.name }); setMoreMenuOpen(prev => ({ ...prev, [device.id]: false })); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                        <span>重命名</span>
                      </button>
                      {device.type === 'plc' && (
                        <button className="device-more-menu-item" onClick={() => { setSettingsDevice(device); setMoreMenuOpen(prev => ({ ...prev, [device.id]: false })); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                          <span>PLC 设置</span>
                        </button>
                      )}
                      {device.brand === 'yeelight-ble' && (
                        <button className="device-more-menu-item" disabled={pairingDevice === device.id} onClick={async () => {
                          setMoreMenuOpen(prev => ({ ...prev, [device.id]: false }));
                          if (!window.confirm('即将发起蓝牙配对，请确保灯具已开启并在附近。\n\n点击确定后，系统将扫描蓝牙设备（约15秒），请在提示后30秒内旋转灯具顶部旋钮完成配对。')) return;
                          setPairingDevice(device.id);
                          try {
                            const result = await pairYeelightBLE(device.id);
                            setPairingDevice(null);
                            if (result.success) {
                              window.alert('配对已发起！请在30秒内旋转灯具顶部旋钮完成配对。\n\n配对成功后即可正常控制。');
                            } else {
                              window.alert('配对失败，请确保设备已连接且处于开机状态，或稍后重试。');
                            }
                          } catch (error) {
                            setPairingDevice(null);
                            window.alert(`配对失败：${(error as Error).message}`);
                          }
                        }}>
                          {pairingDevice === device.id ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
                              </svg>
                              <span>正在配对...</span>
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
                              </svg>
                              <span>蓝牙配对</span>
                            </>
                          )}
                        </button>
                      )}
                      <button className="device-more-menu-item" onClick={() => { onViewHistory?.(device.id, device.name); setMoreMenuOpen(prev => ({ ...prev, [device.id]: false })); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>历史记录</span>
                      </button>
                      <button className="device-more-menu-item" onClick={() => { openScheduleModal(device.id, device.name); setMoreMenuOpen(prev => ({ ...prev, [device.id]: false })); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>定时任务</span>
                      </button>
                      <button className="device-more-menu-item danger" onClick={() => { handleDeleteDevice(device.id, device.name); setMoreMenuOpen(prev => ({ ...prev, [device.id]: false })); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span>删除设备</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {infoDevice && <DeviceInfoPanel device={infoDevice} onClose={() => setInfoDevice(null)} />}

      {settingsDevice && (
        <PlcSettingsPanel
          device={settingsDevice}
          deviceState={deviceStates[settingsDevice.id]}
          onClose={() => setSettingsDevice(null)}
          onUpdated={() => { loadAllDeviceStates(); }}
        />
      )}

      {scheduleModal && (
        <div style={styles.modalOverlay} onClick={() => setScheduleModal(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{scheduleModal.deviceName} - 定时任务</h3>
              <button style={styles.modalClose} onClick={() => setScheduleModal(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              {deviceSchedules.length === 0 ? (
                <div style={styles.emptyState}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <p style={styles.emptyText}>暂无定时任务</p>
                  <p style={styles.emptySubtext}>点击下方按钮创建定时任务</p>
                </div>
              ) : (
                <div style={styles.scheduleList}>
                  {deviceSchedules.map(schedule => (
                    <div key={schedule.id} style={styles.scheduleItem}>
                      <div style={styles.scheduleInfo}>
                        <div style={styles.scheduleName}>{schedule.name}</div>
                        <div style={styles.scheduleCron}>{schedule.cronExpression}</div>
                      </div>
                      <div style={styles.scheduleActions}>
                        <button
                          style={{
                            ...styles.toggleButton,
                            ...(schedule.enabled ? styles.toggleButtonOn : {}),
                          }}
                          onClick={() => handleToggleSchedule(schedule.id, scheduleModal.deviceId)}
                        >
                          {schedule.enabled ? '启用' : '禁用'}
                        </button>
                        <button style={styles.deleteButton} onClick={() => handleDeleteSchedule(schedule.id, scheduleModal.deviceId)}>
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.addScheduleButton} onClick={() => handleCreateSchedule(scheduleModal.deviceId)}>
                + 添加定时任务
              </button>
            </div>
          </div>
        </div>
      )}

      {renameDeviceModal && (
        <div style={styles.modalOverlay} onClick={() => setRenameDeviceModal(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>重命名设备</h3>
              <button style={styles.modalClose} onClick={() => setRenameDeviceModal(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#5B5B5B', marginBottom: '8px' }}>设备名称</label>
                <input
                  type="text"
                  value={renameInputValue}
                  onChange={(e) => setRenameInputValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = '#005FB8'; }}
                  onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(0, 0, 0, 0.12)'; }}
                  autoFocus
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button
                style={{
                  ...styles.deleteButton,
                  marginRight: '10px',
                  background: 'rgba(0, 0, 0, 0.04)',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  color: '#5B5B5B',
                }}
                onClick={() => setRenameDeviceModal(null)}
              >
                取消
              </button>
              <button
                style={styles.addScheduleButton}
                onClick={async () => {
                  if (!renameInputValue.trim()) {
                    window.alert('请输入设备名称');
                    return;
                  }
                  const result = await renameDevice(renameDeviceModal.deviceId, renameInputValue.trim());
                  if (result.success) {
                    setRenameDeviceModal(null);
                    useDeviceStore.getState().loadDevices();
                  } else {
                    window.alert('重命名失败，请重试');
                  }
                }}
              >
                确认重命名
              </button>
            </div>
          </div>
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
  batchButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 16px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: '1px solid rgba(0, 95, 184, 0.15)',
    color: '#005FB8',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  batchButtonActive: {
    background: '#005FB8',
    border: '1px solid #005FB8',
    color: '#FFFFFF',
  },
  batchActionBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: '1px solid rgba(0, 95, 184, 0.15)',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  selectedInfo: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#005FB8',
  },
  batchActions: {
    display: 'flex',
    gap: '8px',
  },
  batchActionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 12px',
    background: '#107C10',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'background 0.15s ease',
  },
  clearButton: {
    padding: '7px 12px',
    background: 'transparent',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
  },
  groupTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  groupTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    background: 'rgba(255, 255, 255, 0.5)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '6px',
    color: '#5B5B5B',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  groupTabActive: {
    background: '#005FB8',
    border: '1px solid #005FB8',
    color: '#FFFFFF',
  },
  groupCount: {
    padding: '2px 6px',
    background: 'rgba(0, 0, 0, 0.08)',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
  },
  sensorReadings: {
    display: 'flex',
    gap: '12px',
    padding: '10px 0',
  },
  sensorReading: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 8px',
    background: 'rgba(0, 0, 0, 0.03)',
    borderRadius: '8px',
  },
  sensorLabel: {
    fontSize: '11px',
    color: '#8A8A8A',
    marginBottom: '4px',
  },
  sensorValue: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#1A1A1A',
  },
  colorControl: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '8px',
  },
  colorPickerRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  quickActionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.6)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '10px',
  },
  quickActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none',
    borderRadius: '8px',
    color: '#5B5B5B',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  quickActionOn: {
    background: 'rgba(0, 95, 184, 0.1)',
    color: '#005FB8',
  },
  batchLoadingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginLeft: 'auto',
    fontSize: '12px',
    color: '#005FB8',
    fontWeight: 500,
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
  deviceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
  },
  deviceItem: {
    position: 'relative',
    background: 'var(--w11-bg-card)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid var(--w11-stroke)',
    borderRadius: '10px',
    padding: '14px',
    boxShadow: 'var(--w11-shadow-2)',
    transition: 'all 0.2s ease',
  },
  deviceItemSelected: {
    border: '2px solid var(--w11-accent)',
    background: 'var(--w11-accent-light)',
  },
  selectionCheckbox: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    border: '2px solid rgba(0, 0, 0, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
  },
  selectionCheckboxChecked: {
    background: '#005FB8',
    border: '2px solid #005FB8',
  },
  deviceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  deviceIconContainer: {
    width: '42px',
    height: '42px',
    borderRadius: '8px',
    background: 'rgba(0, 95, 184, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#005FB8',
  },
  deviceBasicInfo: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--w11-text-primary)',
    margin: 0,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  deviceStatusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
  },
  statusBadge: {
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 500,
  },
  statusBadgeOnline: {
    background: 'rgba(16, 124, 16, 0.12)',
    color: '#107C10',
  },
  statusBadgeOffline: {
    background: 'rgba(196, 43, 28, 0.12)',
    color: '#C42B1C',
  },
  deviceControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  powerToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 12px',
    background: 'var(--w11-bg-layer-alt)',
    border: '1px solid var(--w11-stroke)',
    borderRadius: '6px',
    color: 'var(--w11-text-secondary)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  powerToggleOn: {
    background: '#107C10',
    border: '1px solid #107C10',
    color: '#FFFFFF',
  },
  sliderControl: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: '12px',
    color: 'var(--w11-text-secondary)',
    fontWeight: 500,
  },
  sliderValue: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--w11-text-primary)',
  },
  slider: {
    width: '100%',
    height: '6px',
    appearance: 'none',
    WebkitAppearance: 'none',
    background: 'var(--w11-stroke)',
    borderRadius: '999px',
    outline: 'none',
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  deviceFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px solid var(--w11-stroke-divider)',
    position: 'relative',
  },
  moreButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    background: 'transparent',
    border: 'none',
    color: 'var(--w11-text-secondary)',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'background 0.15s, color 0.15s',
  },
  moreMenu: {
    position: 'absolute',
    bottom: '32px',
    right: '0',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '10px',
    padding: '6px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: '140px',
    zIndex: 100,
    animation: 'fadeInUp 0.15s ease-out forwards',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: '#FFFFFF',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '480px',
    maxHeight: '70vh',
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  modalClose: {
    background: 'none',
    border: 'none',
    color: '#8A8A8A',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    transition: 'background 0.15s ease',
  },
  modalBody: {
    padding: '20px',
    maxHeight: '40vh',
    overflowY: 'auto',
  },
  modalFooter: {
    padding: '16px 20px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  addScheduleButton: {
    padding: '10px 20px',
    background: '#005FB8',
    border: '1px solid #005FB8',
    color: '#FFFFFF',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  scheduleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  scheduleItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.03)',
    borderRadius: '8px',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  scheduleCron: {
    fontSize: '11px',
    color: '#8A8A8A',
    marginTop: '4px',
  },
  scheduleActions: {
    display: 'flex',
    gap: '8px',
  },
  toggleButton: {
    padding: '6px 12px',
    background: 'rgba(0, 0, 0, 0.04)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '4px',
    color: '#5B5B5B',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  toggleButtonOn: {
    background: '#107C10',
    border: '1px solid #107C10',
    color: '#FFFFFF',
  },
  deleteButton: {
    padding: '6px 12px',
    background: 'rgba(220, 53, 69, 0.08)',
    border: '1px solid rgba(220, 53, 69, 0.15)',
    borderRadius: '4px',
    color: '#DC3545',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
};