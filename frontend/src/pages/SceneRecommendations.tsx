import { useState, useEffect } from 'react';

interface SceneRecommendation {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  devices: { deviceId: string; action: string; params?: Record<string, unknown> }[];
  confidence: number;
  applied: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Device {
  id: string;
  name: string;
  type: string;
}

export function SceneRecommendations() {
  const [recommendations, setRecommendations] = useState<SceneRecommendation[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
    loadDevices();
  }, []);

  async function loadRecommendations() {
    setLoading(true);
    try {
      const response = await fetch('/api/scene-recommendations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setRecommendations(data);
    } catch {
      console.error('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }

  async function loadDevices() {
    try {
      const response = await fetch('/api/devices', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setDevices(data);
    } catch {
      console.error('Failed to load devices');
    }
  }

  async function generateRecommendations() {
    try {
      const response = await fetch('/api/scene-recommendations/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setRecommendations([...recommendations, ...data.recommendations]);
    } catch {
      console.error('Failed to generate recommendations');
    }
  }

  async function applyRecommendation(recommendationId: string) {
    try {
      const response = await fetch(`/api/scene-recommendations/${recommendationId}/apply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setRecommendations(recommendations.map(r => r.id === recommendationId ? { ...r, applied: true } : r));
      }
    } catch {
      console.error('Failed to apply recommendation');
    }
  }

  async function deleteRecommendation(recommendationId: string) {
    if (!confirm('确定删除这个推荐吗？')) return;

    try {
      await fetch(`/api/scene-recommendations/${recommendationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRecommendations(recommendations.filter(r => r.id !== recommendationId));
    } catch {
      console.error('Failed to delete recommendation');
    }
  }

  const getDeviceName = (deviceId: string) => {
    return devices.find(d => d.id === deviceId)?.name || deviceId;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#10B981';
    if (confidence >= 0.6) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>智能场景推荐</h1>
          <p style={styles.subtitle}>基于您的设备组合，智能推荐适合的场景</p>
        </div>
        <button
          style={styles.generateBtn}
          onClick={generateRecommendations}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
          重新生成推荐
        </button>
      </div>

      {loading ? (
        <div style={styles.loadingState}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
            <circle cx="12" cy="12" r="10" />
          </svg>
          <span>正在分析设备组合...</span>
        </div>
      ) : recommendations.length === 0 ? (
        <div style={styles.emptyState}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <p style={styles.emptyText}>暂无场景推荐</p>
          <p style={styles.emptySubText}>点击上方按钮生成推荐，或添加设备后重试</p>
          <button style={styles.emptyActionBtn} onClick={generateRecommendations}>
            生成推荐
          </button>
        </div>
      ) : (
        <div style={styles.recommendationsGrid}>
          {recommendations.map(recommendation => (
            <div key={recommendation.id} style={{ ...styles.recommendationCard, opacity: recommendation.applied ? 0.6 : 1 }}>
              <div style={styles.recommendationHeader}>
                <div style={{ ...styles.recommendationIcon, background: `${getConfidenceColor(recommendation.confidence)}20`, color: getConfidenceColor(recommendation.confidence) }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div style={styles.recommendationInfo}>
                  <h3 style={styles.recommendationName}>{recommendation.name}</h3>
                  <p style={styles.recommendationDesc}>{recommendation.description}</p>
                </div>
                <div style={styles.recommendationActions}>
                  <div style={{ ...styles.confidenceBadge, background: `${getConfidenceColor(recommendation.confidence)}20`, color: getConfidenceColor(recommendation.confidence) }}>
                    {(recommendation.confidence * 100).toFixed(0)}% 匹配
                  </div>
                  {recommendation.applied ? (
                    <span style={styles.appliedBadge}>已应用</span>
                  ) : (
                    <button
                      style={styles.applyBtn}
                      onClick={() => applyRecommendation(recommendation.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14" />
                        <path d="M12 5l7 7-7 7" />
                      </svg>
                      应用
                    </button>
                  )}
                </div>
              </div>
              <div style={styles.recommendationDevices}>
                <span style={styles.devicesLabel}>涉及设备:</span>
                <div style={styles.devicesList}>
                  {recommendation.devices.map((device, index) => (
                    <span key={index} style={styles.deviceTag}>
                      {getDeviceName(device.deviceId)}
                    </span>
                  ))}
                </div>
              </div>
              <div style={styles.recommendationActionsBar}>
                {!recommendation.applied && (
                  <button
                    style={styles.deleteBtn}
                    onClick={() => deleteRecommendation(recommendation.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                    删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1000px',
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
  generateBtn: {
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
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px',
    color: '#6B7280'
  },
  emptyState: {
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
    color: '#6B7280',
    marginBottom: '16px'
  },
  emptyActionBtn: {
    padding: '10px 24px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer'
  },
  recommendationsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: '20px'
  },
  recommendationCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  recommendationHeader: {
    display: 'flex',
    alignItems: 'flex-start'
  },
  recommendationIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  recommendationInfo: {
    flex: 1,
    marginLeft: '16px'
  },
  recommendationName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1F2937',
    margin: 0
  },
  recommendationDesc: {
    fontSize: '13px',
    color: '#6B7280',
    marginTop: '4px',
    margin: 0
  },
  recommendationActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px'
  },
  confidenceBadge: {
    fontSize: '12px',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 500
  },
  appliedBadge: {
    fontSize: '12px',
    padding: '4px 8px',
    background: '#10B98120',
    color: '#10B981',
    borderRadius: '4px',
    fontWeight: 500
  },
  applyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    background: '#6366F1',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '13px',
    cursor: 'pointer'
  },
  recommendationDevices: {
    marginBottom: '16px'
  },
  devicesLabel: {
    fontSize: '13px',
    color: '#6B7280',
    display: 'block',
    marginBottom: '8px'
  },
  devicesList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  deviceTag: {
    fontSize: '12px',
    padding: '4px 8px',
    background: '#F3F4F6',
    color: '#374151',
    borderRadius: '4px'
  },
  recommendationActionsBar: {
    display: 'flex',
    justifyContent: 'flex-end'
  },
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    background: '#F3F4F6',
    border: 'none',
    borderRadius: '6px',
    color: '#EF4444',
    fontSize: '13px',
    cursor: 'pointer'
  }
};
