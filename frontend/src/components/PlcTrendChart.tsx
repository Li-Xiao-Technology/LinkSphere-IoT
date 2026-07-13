import React, { useState, useEffect } from 'react';

interface HistoryDataPoint {
  timestamp: string;
  value: number;
  unit?: string;
}

interface PlcTrendChartProps {
  deviceId: string;
  property: string;
  title: string;
  color?: string;
  hours?: number;
}

export const PlcTrendChart: React.FC<PlcTrendChartProps> = ({
  deviceId,
  property,
  title,
  color = '#1890ff',
  hours = 24,
}) => {
  const [data, setData] = useState<HistoryDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/plc/devices/${deviceId}/history/trend?property=${property}&hours=${hours}`);
        const result = await response.json();
        setData(result.data || []);
      } catch (error) {
        console.error('Failed to fetch trend data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [deviceId, property, hours]);

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        加载中...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={styles.empty}>
        暂无历史数据
      </div>
    );
  }

  const minValue = Math.min(...data.map(d => d.value)) * 0.9;
  const maxValue = Math.max(...data.map(d => d.value)) * 1.1;
  const valueRange = maxValue - minValue || 1;

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((point.value - minValue) / valueRange) * 100;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,100 ${points} 100,100`;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const currentValue = data[data.length - 1]?.value || 0;
  const unit = data[0]?.unit || '';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>{title}</div>
        <div style={styles.currentValue}>
          <span style={{ color }}>{currentValue.toFixed(1)}</span>
          <span style={styles.unit}>{unit}</span>
        </div>
      </div>
      <div style={styles.chartArea}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={styles.svg}>
          <defs>
            <linearGradient id={`gradient-${property}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill={`url(#gradient-${property})`} />
          <polyline points={points} fill="none" stroke={color} strokeWidth="0.5" />
        </svg>
        <div style={styles.timeAxis}>
          {data.length > 0 && (
            <>
              <span>{formatTime(data[0].timestamp)}</span>
              <span>{formatTime(data[Math.floor(data.length / 2)].timestamp)}</span>
              <span>{formatTime(data[data.length - 1].timestamp)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#666',
  },
  currentValue: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#333',
  },
  unit: {
    fontSize: '14px',
    fontWeight: 400,
    color: '#999',
    marginLeft: '4px',
  },
  chartArea: {
    height: '120px',
    position: 'relative',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  timeAxis: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#999',
    marginTop: '8px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '120px',
    color: '#999',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid #e0e0e0',
    borderTopColor: '#1890ff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginRight: '8px',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '120px',
    color: '#999',
  },
};
