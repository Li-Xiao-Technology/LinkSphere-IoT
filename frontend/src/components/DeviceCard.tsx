import { useState, useEffect, useCallback, useRef } from 'react';
import { Device, DeviceState } from '../types';
import { getDeviceState, setDeviceState, deleteDevice, pairYeelightBLE } from '../api';
import { useDeviceStore } from '../store/deviceStore';
import { DeviceInfoPanel } from './DeviceInfoPanel';

interface DeviceCardProps {
  device: Device;
  onStateChange?: (deviceId: string, state: DeviceState | null) => void;
  onViewHistory?: (deviceId: string, deviceName: string) => void;
  onQuickAction?: (deviceId: string, action: string, value?: unknown) => void;
  customIcon?: string;
  compact?: boolean;
}

const brandConfig: Record<string, { color: string; bg: string; name: string }> = {
  mijia: { color: '#FF6900', bg: 'rgba(255, 105, 0, 0.1)', name: '米家' },
  miio: { color: '#FF6900', bg: 'rgba(255, 105, 0, 0.1)', name: '米家' },
  haier: { color: '#0090E8', bg: 'rgba(0, 144, 232, 0.1)', name: '海尔' },
  midea: { color: '#EB0A2B', bg: 'rgba(235, 10, 43, 0.1)', name: '美的' },
  ModbusTCP: { color: '#6B7280', bg: 'rgba(107, 114, 128, 0.1)', name: 'Modbus' },
};

const typeConfig: Record<string, { icon: string; name: string }> = {
  light: {
    icon: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
    name: '智能灯',
  },
  switch: {
    icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/>',
    name: '智能开关',
  },
  sensor: {
    icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="2.5"/>',
    name: '传感器',
  },
  airconditioner: {
    icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 10h12M6 14h8"/><circle cx="16" cy="14" r="1"/>',
    name: '空调',
  },
  plc: {
    icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>',
    name: 'PLC控制器',
  },
  waterheater: {
    icon: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M12 14v3"/>',
    name: '热水器',
  },
  airpurifier: {
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>',
    name: '空气净化器',
  },
  refrigerator: {
    icon: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 2v20"/><path d="M8 6h4M8 14h4"/>',
    name: '冰箱',
  },
  vacuum: {
    icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 8v8"/>',
    name: '扫地机器人',
  },
  humidifier: {
    icon: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M12 6v6"/><path d="M9 9h6"/>',
    name: '加湿器',
  },
  powerstrip: {
    icon: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="7" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="17" cy="12" r="2"/>',
    name: '插线板',
  },
  gateway: {
    icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>',
    name: '网关',
  },
  unknown: {
    icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 15h6"/>',
    name: '设备',
  },
};

export function DeviceCard({ device, onStateChange, onViewHistory, onQuickAction, customIcon, compact = false }: DeviceCardProps) {
  const [state, setState] = useState<DeviceState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [pairingDevice, setPairingDevice] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMoreMenu]);

  const loadState = useCallback(async () => {
    setIsLoading(true);
    try {
      const deviceState = await getDeviceState(device.id);
      setState(deviceState);
      onStateChange?.(device.id, deviceState);
      console.log(`[DeviceCard] ${device.name} (${device.type}) state loaded:`, deviceState);
    } catch (error) {
      console.error(`[DeviceCard] Failed to load state for ${device.name}:`, error);
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.id]);

  useEffect(() => {
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState]);

  async function handleTogglePower() {
    if (!state || isUpdating) return;
    const newPower = !state.power;
    setIsUpdating(true);
    setIsAnimating(true);
    try {
      await setDeviceState(device.id, { power: newPower });
      setState((prev) => (prev ? { ...prev, power: newPower } : null));
      onStateChange?.(device.id, { ...state, power: newPower });
      setTimeout(() => setIsAnimating(false), 300);
    } catch (error) {
      console.error('Failed to update device state:', error);
      setIsAnimating(false);
    }
    setIsUpdating(false);
  }

  async function handleQuickAction(action: string, value?: unknown) {
    if (isUpdating) return;
    setIsUpdating(true);
    setIsAnimating(true);
    try {
      await setDeviceState(device.id, { [action]: value });
      setState((prev) => (prev ? { ...prev, [action]: value } : null));
      onStateChange?.(device.id, { ...state, [action]: value } as DeviceState);
      onQuickAction?.(device.id, action, value);
      setTimeout(() => setIsAnimating(false), 300);
    } catch (error) {
      console.error('Failed to execute quick action:', error);
      setIsAnimating(false);
    }
    setIsUpdating(false);
  }

  async function handleSliderChange(property: string, value: number) {
    if (!state || isUpdating) return;
    try {
      await setDeviceState(device.id, { [property]: value });
      setState((prev) => (prev ? { ...prev, [property]: value } : null));
    } catch (error) {
      console.error('Failed to update device state:', error);
    }
  }

  async function handleSliderCommit(property: string, value: number) {
    onStateChange?.(device.id, { ...state, [property]: value } as DeviceState);
  }

  async function handleDelete() {
    if (!window.confirm(`确定删除设备「${device.name}」吗？此操作不可恢复。`)) return;
    try {
      const result = await deleteDevice(device.id);
      if (result?.success) {
        useDeviceStore.getState().loadDevices();
      }
    } catch (error) {
      console.error('Failed to delete device:', error);
    }
  }

  function getQuickActions(): { label: string; action: string; value: unknown; icon: string }[] {
    const actions: { label: string; action: string; value: unknown; icon: string }[] = [];

    if (device.type === 'light') {
      actions.push(
        { label: '最亮', action: 'brightness', value: 100, icon: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>' },
        { label: '适中', action: 'brightness', value: 50, icon: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>' },
        { label: '微光', action: 'brightness', value: 20, icon: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>' },
      );
    } else if (device.type === 'airconditioner') {
      actions.push(
        { label: '制冷', action: 'mode', value: 'cool', icon: '<path d="M12 2v20M2 12h20M6 6l12 12M18 6L6 18"/><circle cx="12" cy="12" r="3"/>' },
        { label: '制热', action: 'mode', value: 'heat', icon: '<path d="M12 2v20M2 12h20"/><path d="M8 8l8 8M16 8l-8 8" />' },
        { label: '自动', action: 'mode', value: 'auto', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
      );
    } else if (device.type === 'waterheater') {
      actions.push(
        { label: '节能', action: 'temperature', value: 55, icon: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>' },
        { label: '标准', action: 'temperature', value: 65, icon: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/><circle cx="12" cy="12" r="1"/>' },
        { label: '速热', action: 'temperature', value: 75, icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
      );
    }
    return actions;
  }

  const isOnline = device.status === 'online';
  const brand = brandConfig[device.brand] || brandConfig.mijia;
  const type = typeConfig[device.type] || typeConfig.switch;
  const isPowered = !!(state?.power);
  const quickActions = getQuickActions();
  const deviceIcon = customIcon || type.icon;

  return (
    <div
      style={{
        ...styles.card,
        opacity: isOnline ? 1 : 0.6,
        ...(isOnline ? {} : { filter: 'grayscale(0.5)' }),
        ...(isAnimating ? { transform: 'scale(0.98)' } : {}),
      }}
      className="anim-slide-up device-card-touch"
      onTouchStart={() => setShowQuickActions(true)}
      onMouseLeave={() => setShowQuickActions(false)}
    >
      <div style={{ ...styles.accentBar, background: brand.color, ...(isPowered && isOnline ? { animation: 'pulse 2s infinite' } : {}) }} />

      <div style={styles.cardHeader}>
        <div style={{
          ...styles.iconContainer,
          background: brand.bg,
          color: brand.color,
          ...(isPowered && isOnline ? { boxShadow: `0 0 12px ${brand.color}40` } : {}),
          ...(isAnimating ? { animation: 'iconPulse 0.3s ease-out' } : {}),
        }}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: deviceIcon }}
          />
        </div>
        <div style={styles.deviceInfo}>
          <h3 style={styles.deviceName}>{device.name}</h3>
          <div style={styles.deviceMeta}>
            <span style={{ ...styles.brandTag, background: brand.bg, color: brand.color }}>
              {brand.name}
            </span>
            <span style={styles.typeTag}>{type.name}</span>
          </div>
        </div>
        <div style={styles.statusContainer}>
          <div
            style={{
              ...styles.statusDot,
              background: isOnline ? '#107C10' : '#C42B1C',
              boxShadow: isOnline ? '0 0 0 3px rgba(16, 124, 16, 0.15)' : '0 0 0 3px rgba(196, 43, 28, 0.15)',
              ...(isOnline ? { animation: 'statusPulse 2s infinite' } : {}),
            }}
          />
        </div>
      </div>

      <div style={styles.cardContent}>
        {(device.type === 'light' ||
          device.type === 'switch' ||
          device.type === 'airconditioner' ||
          device.type === 'waterheater' ||
          device.type === 'airpurifier') ? (
          <button
            style={{
              ...styles.powerButton,
              background: isPowered ? '#107C10' : 'rgba(0, 0, 0, 0.04)',
              color: isPowered ? '#FFFFFF' : '#5B5B5B',
              ...(isAnimating ? { transform: 'scale(0.95)' } : {}),
              opacity: isLoading ? 0.5 : 1,
            }}
            onClick={handleTogglePower}
            disabled={isUpdating || isLoading || !state}
          >
            {isLoading ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            )}
            <span>{isLoading ? '加载中...' : isPowered ? '开启' : '关闭'}</span>
          </button>
        ) : (
          <div style={styles.powerPlaceholder} />
        )}

        {quickActions.length > 0 && (
          <div style={styles.quickActions}>
            {quickActions.map((action, index) => (
              <button
                key={index}
                style={styles.quickActionButton}
                className="quick-action-button touch-feedback"
                onClick={() => handleQuickAction(action.action, action.value)}
                disabled={isUpdating || isLoading || !state}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: action.icon }} />
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {device.type === 'light' && (
          <div style={styles.controlRow}>
            <div style={styles.controlHeader}>
              <span style={styles.controlLabel}>亮度</span>
              <span style={styles.controlValue}>{isLoading ? '--' : (state?.brightness ?? '--')}%</span>
            </div>
            <div style={styles.sliderContainer}>
              <input
                type="range"
                min="0"
                max="100"
                value={state?.brightness ?? 50}
                onChange={(e) => handleSliderChange('brightness', parseInt(e.target.value))}
                onMouseUp={(e) => handleSliderCommit('brightness', parseInt((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handleSliderCommit('brightness', parseInt((e.target as HTMLInputElement).value))}
                style={styles.slider}
                className="w11-slider"
                disabled={isLoading || !state}
              />
            </div>
          </div>
        )}

        {device.type === 'light' && device.brand === 'yeelight-ble' && (
          <div style={styles.controlRow}>
            <div style={styles.controlHeader}>
              <span style={styles.controlLabel}>色温</span>
              <span style={styles.controlValue}>{isLoading ? '--' : (state?.colorTemp ?? '--')}%</span>
            </div>
            <div style={styles.sliderContainer}>
              <input
                type="range"
                min="0"
                max="100"
                value={state?.colorTemp ?? 50}
                onChange={(e) => handleSliderChange('colorTemp', parseInt(e.target.value))}
                onMouseUp={(e) => handleSliderCommit('colorTemp', parseInt((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handleSliderCommit('colorTemp', parseInt((e.target as HTMLInputElement).value))}
                style={styles.slider}
                className="w11-slider"
                disabled={isLoading || !state}
              />
            </div>
          </div>
        )}

        {device.type === 'light' && device.brand === 'yeelight-ble' && (
          <div style={styles.extraControls}>
            <button
              style={styles.extraButton}
              onClick={() => {
                  const delay = window.prompt('设置延时关灯时间（分钟）：', '30');
                  if (delay !== null) {
                    const minutes = parseInt(delay);
                    if (!isNaN(minutes) && minutes >= 0) {
                      handleQuickAction('delayOff', minutes);
                    }
                  }
                }}
              disabled={isLoading || !state}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{state?.delayOff ? `${state.delayOff}分钟` : '延时关灯'}</span>
            </button>
          </div>
        )}

        {device.type === 'light' && device.brand === 'yeelight-ble' && (
          <div style={styles.modeButtons}>
            <button
              style={{ ...styles.modeButton, ...(state?.mode === 'reading' ? styles.modeButtonActive : {}) }}
              onClick={() => handleQuickAction('mode', 'reading')}
              disabled={isLoading || !state}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span>阅读</span>
            </button>
            <button
              style={{ ...styles.modeButton, ...(state?.mode === 'sleep' ? styles.modeButtonActive : {}) }}
              onClick={() => handleQuickAction('mode', 'sleep')}
              disabled={isLoading || !state}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>睡眠</span>
            </button>
            <button
              style={{ ...styles.modeButton, ...(state?.mode === 'night' ? styles.modeButtonActive : {}) }}
              onClick={() => handleQuickAction('mode', 'night')}
              disabled={isLoading || !state}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>夜灯</span>
            </button>
            <button
              style={{ ...styles.modeButton, ...(state?.mode === 'color' ? styles.modeButtonActive : {}) }}
              onClick={() => handleQuickAction('mode', 'color')}
              disabled={isLoading || !state}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>彩色</span>
            </button>
          </div>
        )}

        {device.type === 'airconditioner' && (
          <div style={styles.controlRow}>
            <div style={styles.controlHeader}>
              <span style={styles.controlLabel}>温度</span>
              <span style={styles.controlValue}>{isLoading ? '--' : (state?.temperature ?? '--')}°C</span>
            </div>
            <div style={styles.sliderContainer}>
              <input
                type="range"
                min="16"
                max="30"
                value={state?.temperature ?? 24}
                onChange={(e) => handleSliderChange('temperature', parseInt(e.target.value))}
                onMouseUp={(e) => handleSliderCommit('temperature', parseInt((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handleSliderCommit('temperature', parseInt((e.target as HTMLInputElement).value))}
                style={styles.slider}
                className="w11-slider"
                disabled={isLoading || !state}
              />
            </div>
          </div>
        )}

        {device.type === 'waterheater' && (
          <div style={styles.controlRow}>
            <div style={styles.controlHeader}>
              <span style={styles.controlLabel}>水温</span>
              <span style={styles.controlValue}>{isLoading ? '--' : (state?.temperature ?? '--')}°C</span>
            </div>
            <div style={styles.sliderContainer}>
              <input
                type="range"
                min="40"
                max="80"
                value={state?.temperature ?? 60}
                onChange={(e) => handleSliderChange('temperature', parseInt(e.target.value))}
                onMouseUp={(e) => handleSliderCommit('temperature', parseInt((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handleSliderCommit('temperature', parseInt((e.target as HTMLInputElement).value))}
                style={styles.slider}
                className="w11-slider"
                disabled={isLoading || !state}
              />
            </div>
          </div>
        )}

        {device.type === 'sensor' && (
          <div style={styles.sensorGrid}>
            <div style={styles.sensorItem}>
              <div style={styles.sensorIcon}>🌡️</div>
              <div style={styles.sensorValue}>{isLoading ? '--' : (state?.temperature ?? '--')}°C</div>
              <div style={styles.sensorLabel}>温度</div>
            </div>
            <div style={styles.sensorItem}>
              <div style={styles.sensorIcon}>💧</div>
              <div style={styles.sensorValue}>{isLoading ? '--' : (state?.humidity ?? '--')}%</div>
              <div style={styles.sensorLabel}>湿度</div>
            </div>
          </div>
        )}

        {device.type === 'refrigerator' && (
          <div style={styles.sensorGrid}>
            <div style={styles.sensorItem}>
              <div style={styles.sensorIcon}>❄️</div>
              <div style={styles.sensorValue}>{isLoading ? '--' : (state?.temperature ?? '--')}°C</div>
              <div style={styles.controlLabel}>冷藏</div>
            </div>
          </div>
        )}

        {state?.mode && (
          <div style={styles.modeInfo}>
            <span style={styles.modeLabel}>运行模式</span>
            <span style={styles.modeValue}>{state.mode}</span>
          </div>
        )}
      </div>

      <div style={styles.cardFooter}>
        <div style={styles.connectionBadge}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {device.connectionType === 'wifi' && (
              <>
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </>
            )}
            {device.connectionType === 'bluetooth' && (
              <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
            )}
            {device.connectionType === 'ethernet' && (
              <>
                <rect x="2" y="8" width="20" height="8" rx="1" />
                <line x1="6" y1="12" x2="6.01" y2="12" />
              </>
            )}
          </svg>
          <span>{device.connectionType.toUpperCase()}</span>
        </div>
        <div style={styles.footerActions} ref={menuRef}>
          {device.firmwareVersion && (
            <span style={styles.firmwareVersion}>v{device.firmwareVersion}</span>
          )}
          <button
            style={styles.moreButton}
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            title="更多操作"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {showMoreMenu && (
            <div style={styles.moreMenu} className="device-more-menu">
              <button className="device-more-menu-item" onClick={() => { setShowInfoPanel(true); setShowMoreMenu(false); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <span>设备信息</span>
              </button>
              {onViewHistory && (
                <button className="device-more-menu-item" onClick={() => { onViewHistory(device.id, device.name); setShowMoreMenu(false); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>历史记录</span>
                </button>
              )}
              {device.brand === 'yeelight-ble' && (
                <button className="device-more-menu-item" disabled={pairingDevice} onClick={async () => {
                  setShowMoreMenu(false);
                  if (!window.confirm('⚠️ 蓝牙配对需要物理操作\n\n1. 确保灯具已开启并在电脑附近\n2. 点击确定后系统将自动连接设备\n3. **听到滴声后，请在30秒内旋转灯具顶部旋钮**完成配对\n\n配对成功后连接会保持稳定。')) return;
                  setPairingDevice(true);
                  try {
                    const result = await pairYeelightBLE(device.id);
                    setPairingDevice(false);
                    if (result.success) {
                      window.alert('🔔 配对已发起！\n\n请立即旋转灯具顶部旋钮完成配对！\n\n• 听到滴声表示配对成功\n• 配对后连接将保持稳定\n• 如果没有滴声，请确保灯具已开机并靠近电脑');
                    } else {
                      window.alert('配对失败，请确保设备已开机并在附近，然后重试。');
                    }
                  } catch (error) {
                    setPairingDevice(false);
                    window.alert(`配对失败：${(error as Error).message}`);
                  }
                }}>
                  {pairingDevice ? (
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
              <button className="device-more-menu-item danger" onClick={() => { handleDelete(); setShowMoreMenu(false); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>删除设备</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {showInfoPanel && <DeviceInfoPanel device={device} onClose={() => setShowInfoPanel(false)} />}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  card: {
    position: 'relative',
    background: 'var(--w11-bg-card)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid var(--w11-stroke)',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: 'var(--w11-shadow-2)',
    transition:
      'box-shadow var(--w11-duration-normal) var(--w11-ease-standard), transform var(--w11-duration-normal) var(--w11-ease-standard), background var(--w11-duration-normal) var(--w11-ease-standard)',
    touchAction: 'manipulation',
    width: '300px',
    height: '360px',
    display: 'flex',
    flexDirection: 'column',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    opacity: 0.9,
    transition: 'opacity 0.3s ease',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '14px',
    marginTop: '4px',
  },
  iconContainer: {
    width: '42px',
    height: '42px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'box-shadow 0.3s ease, transform 0.3s ease',
  },
  deviceInfo: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    fontSize: '14px',
    fontWeight: 600,
    margin: 0,
    color: 'var(--w11-text-primary)',
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  deviceMeta: {
    display: 'flex',
    gap: '6px',
    marginTop: '4px',
    alignItems: 'center',
  },
  brandTag: {
    padding: '1px 7px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
  },
  typeTag: {
    padding: '1px 7px',
    borderRadius: '4px',
    background: 'rgba(0, 0, 0, 0.04)',
    color: '#5B5B5B',
    fontSize: '11px',
    fontWeight: 500,
  },
  statusContainer: {
    flexShrink: 0,
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    transition: 'box-shadow 0.3s ease',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '24px 0',
  },
  errorContainer: {
    textAlign: 'center',
    color: '#C42B1C',
    padding: '24px 0',
    fontSize: '13px',
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  powerButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'background var(--w11-duration-fast) var(--w11-ease-standard), transform var(--w11-duration-fast) var(--w11-ease-standard)',
    touchAction: 'manipulation',
    minHeight: '44px',
  },
  powerPlaceholder: {
    height: '44px',
  },
  quickActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    animation: 'slideIn 0.2s ease-out',
  },
  quickActionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: '1px solid rgba(0, 95, 184, 0.15)',
    borderRadius: '6px',
    color: '#005FB8',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    touchAction: 'manipulation',
    minHeight: '36px',
  },
  controlRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  controlHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: '12px',
    color: '#5B5B5B',
    fontWeight: 500,
  },
  controlValue: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  sliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  slider: {
    width: '100%',
    height: '6px',
    appearance: 'none',
    WebkitAppearance: 'none',
    background: 'rgba(0, 0, 0, 0.1)',
    borderRadius: '999px',
    outline: 'none',
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  sensorGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    padding: '4px 0',
  },
  sensorItem: {
    background: 'rgba(0, 0, 0, 0.03)',
    borderRadius: '8px',
    padding: '12px 8px',
    textAlign: 'center',
  },
  sensorIcon: {
    fontSize: '20px',
    marginBottom: '4px',
  },
  sensorValue: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1A1A1A',
    letterSpacing: '-0.02em',
  },
  modeInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'rgba(0, 95, 184, 0.06)',
    borderRadius: '6px',
  },
  modeLabel: {
    fontSize: '12px',
    color: '#5B5B5B',
  },
  modeValue: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#005FB8',
    textTransform: 'capitalize',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid var(--w11-stroke-divider)',
    position: 'relative',
    zIndex: 10,
  },
  footerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    color: '#1A1A1A',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'background 0.12s',
    textAlign: 'left',
    width: '100%',
  },
  menuItemDanger: {
    color: '#C42B1C',
  },
  connectionBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: '#5B5B5B',
    fontWeight: 500,
  },
  firmwareVersion: {
    fontSize: '11px',
    color: '#8A8A8A',
  },
  extraControls: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  extraButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 12px',
    background: 'var(--w11-bg-layer-alt)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--w11-text-secondary)',
    cursor: 'pointer',
    transition: 'background 0.15s ease, transform 0.1s ease',
  },
  modeButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
    marginTop: '8px',
  },
  modeButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 4px',
    background: 'rgba(0, 0, 0, 0.03)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 500,
    color: '#5B5B5B',
    cursor: 'pointer',
    transition: 'background 0.15s ease, transform 0.1s ease',
  },
  modeButtonActive: {
    background: 'rgba(0, 95, 184, 0.1)',
    color: '#005FB8',
  },
};
