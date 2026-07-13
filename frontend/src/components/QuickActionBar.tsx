import { useState, useEffect } from 'react';
import { Device, DeviceState } from '../types';
import { getDevices, getDeviceState, setDeviceState } from '../api';
import { useDeviceStore } from '../store/deviceStore';

interface QuickDevice {
  id: string;
  name: string;
  type: string;
  power?: boolean;
}

export function QuickActionBar() {
  const { devices: rawDevices } = useDeviceStore();
  const devices = Array.isArray(rawDevices) ? rawDevices : [];
  const [quickDevices, setQuickDevices] = useState<QuickDevice[]>([]);
  const [deviceStates, setDeviceStates] = useState<Record<string, DeviceState>>({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('quickDevices');
    if (saved) {
      try {
        setQuickDevices(JSON.parse(saved));
      } catch {
        setQuickDevices([]);
      }
    }
  }, []);

  useEffect(() => {
    loadDeviceStates();
  }, [quickDevices]);

  useEffect(() => {
    localStorage.setItem('quickDevices', JSON.stringify(quickDevices));
  }, [quickDevices]);

  async function loadDeviceStates() {
    const states: Record<string, DeviceState> = {};
    for (const device of quickDevices) {
      try {
        const state = await getDeviceState(device.id);
        if (state) {
          states[device.id] = state;
        }
      } catch (error) {
        console.error(`Failed to load state for ${device.id}:`, error);
      }
    }
    setDeviceStates(states);
  }

  function toggleDevice(deviceId: string) {
    const currentState = deviceStates[deviceId];
    const newPower = !currentState?.power;
    
    setDeviceState(deviceId, { power: newPower });
    setDeviceStates(prev => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], power: newPower }
    }));
    
    setQuickDevices(prev => prev.map(d => 
      d.id === deviceId ? { ...d, power: newPower } : d
    ));
  }

  function addDevice(device: Device) {
    if (!quickDevices.find(d => d.id === device.id)) {
      setQuickDevices(prev => [...prev, { id: device.id, name: device.name, type: device.type, power: false }]);
    }
  }

  function removeDevice(deviceId: string) {
    setQuickDevices(prev => prev.filter(d => d.id !== deviceId));
  }

  const availableDevices = devices.filter(d => !quickDevices.find(qd => qd.id === d.id));

  return (
    <div style={styles.container}>
      <div style={styles.bar}>
        <div style={styles.quickItems}>
          {quickDevices.map(device => (
            <div key={device.id} style={styles.quickItem}>
              <button
                style={{
                  ...styles.quickButton,
                  ...(deviceStates[device.id]?.power ? styles.quickButtonActive : {}),
                }}
                onClick={() => toggleDevice(device.id)}
                title={device.name}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {device.type === 'light' && <path d="M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />}
                  {device.type === 'switch' && <path d="M3 5h18v14H3zM8 12h.01M16 12h.01" />}
                  {device.type === 'airconditioner' && <path d="M3 5h18v14H3zM6 10h12M6 14h8" />}
                  {device.type === 'waterheater' && <path d="M22 12h-4l-3 9L9 3l-3 9H2" />}
                  {device.type === 'airpurifier' && <path d="M3 12h18M12 3v18M8 16l4-4 4 4" />}
                  {device.type === 'refrigerator' && <path d="M21 10V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M7 10h10M7 14h10M17 8v8" />}
                  {device.type === 'sensor' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                </svg>
              </button>
              {expanded && (
                <button style={styles.removeButton} onClick={() => removeDevice(device.id)}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          
          {quickDevices.length === 0 && (
            <div style={styles.emptyHint}>
              <span style={styles.emptyText}>添加常用设备</span>
            </div>
          )}
        </div>
        
        <button style={styles.expandButton} onClick={() => setExpanded(!expanded)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {expanded ? <path d="M19 9l-7 7-7-7" /> : <path d="M5 15l7-7 7 7" />}
          </svg>
        </button>
      </div>

      {expanded && availableDevices.length > 0 && (
        <div style={styles.addPanel}>
          <div style={styles.addPanelHeader}>
            <span style={styles.addPanelTitle}>添加到快捷栏</span>
          </div>
          <div style={styles.addPanelContent}>
            {availableDevices.map(device => (
              <button key={device.id} style={styles.addButton} onClick={() => addDevice(device)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {device.type === 'light' && <path d="M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />}
                  {device.type === 'switch' && <path d="M3 5h18v14H3zM8 12h.01M16 12h.01" />}
                  {device.type === 'airconditioner' && <path d="M3 5h18v14H3zM6 10h12M6 14h8" />}
                  {device.type === 'waterheater' && <path d="M22 12h-4l-3 9L9 3l-3 9H2" />}
                  {device.type === 'airpurifier' && <path d="M3 12h18M12 3v18M8 16l4-4 4 4" />}
                  {device.type === 'refrigerator' && <path d="M21 10V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M7 10h10M7 14h10M17 8v8" />}
                  {device.type === 'sensor' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                </svg>
                <span>{device.name}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 500,
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
  },
  quickItems: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
    overflowX: 'auto',
    paddingRight: '10px',
  },
  quickItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  quickButton: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '10px',
    color: '#5B5B5B',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },
  quickButtonActive: {
    background: '#005FB8',
    border: '1px solid #005FB8',
    color: '#FFFFFF',
  },
  removeButton: {
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(220, 53, 69, 0.1)',
    border: 'none',
    borderRadius: '4px',
    color: '#DC3545',
    cursor: 'pointer',
    padding: '2px',
  },
  emptyHint: {
    flex: 1,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: '13px',
    color: '#8A8A8A',
  },
  expandButton: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 95, 184, 0.08)',
    border: '1px solid rgba(0, 95, 184, 0.15)',
    borderRadius: '10px',
    color: '#005FB8',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },
  addPanel: {
    background: '#FFFFFF',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
    maxHeight: '300px',
    overflow: 'hidden',
  },
  addPanelHeader: {
    padding: '12px 20px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  addPanelTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1A1A1A',
  },
  addPanelContent: {
    padding: '12px 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '10px',
    maxHeight: '240px',
    overflowY: 'auto',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    background: 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#1A1A1A',
    transition: 'all 0.15s ease',
    textAlign: 'left',
  },
};