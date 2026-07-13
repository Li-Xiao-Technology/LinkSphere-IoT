import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 900);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    const success = await login(username, password);
    
    if (success) {
      navigate('/devices');
    } else {
      setError('用户名或密码错误');
    }
    
    setIsLoading(false);
  };

  return (
    <div style={{ ...styles.container, ...(isMobile ? styles.containerMobile : {}) }}>
      {!isMobile && (
        <div style={styles.leftPanel}>
          <div style={styles.leftContent}>
            <div style={styles.brandRow}>
              <div style={styles.brandLogo} className="brand-logo-pulse">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="url(#brandGrad)" />
                  <path d="M15 12l-3-3-3 3 3 3 3-3z" fill="white" />
                  <defs>
                    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span style={styles.brandName}>LinkSphere</span>
            </div>
            
            <div style={styles.heroContent}>
              <h1 style={styles.heroTitle}>
                智能设备<br />
                <span style={styles.heroTitleAccent}>互联管理</span>
                <span style={styles.heroTitleDot}>.</span>
              </h1>
              <p style={styles.heroDesc}>
                统一接入多品牌智能设备，集中管理、智能控制、能耗优化，
                让您的设备协同工作，构建真正的智能生态。
              </p>
            </div>
            
            <div style={styles.featureList}>
              <div style={{ ...styles.featureItem, animationDelay: '0s' }} className="feature-item-animate">
                <div style={{ ...styles.featureIcon, ...styles.featureIconPurple }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <span style={styles.featureText}>实时控制</span>
              </div>
              <div style={{ ...styles.featureItem, animationDelay: '0.1s' }} className="feature-item-animate">
                <div style={{ ...styles.featureIcon, ...styles.featureIconBlue }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <span style={styles.featureText}>定时自动化</span>
              </div>
              <div style={{ ...styles.featureItem, animationDelay: '0.2s' }} className="feature-item-animate">
                <div style={{ ...styles.featureIcon, ...styles.featureIconGreen }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18" />
                    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                  </svg>
                </div>
                <span style={styles.featureText}>能耗分析</span>
              </div>
              <div style={{ ...styles.featureItem, animationDelay: '0.3s' }} className="feature-item-animate">
                <div style={{ ...styles.featureIcon, ...styles.featureIconOrange }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span style={styles.featureText}>多协议接入</span>
              </div>
            </div>

            <div style={styles.decoArea}>
              <div style={styles.decoOrb1} className="floating-orb-1" />
              <div style={styles.decoOrb2} className="floating-orb-2" />
              <div style={styles.decoOrb3} className="floating-orb-3" />
              <div style={styles.decoRing} className="rotating-ring" />
              <div style={styles.decoDot1} className="pulsing-dot" />
              <div style={styles.decoDot2} className="pulsing-dot-delay" />
              <div style={styles.decoDot3} className="pulsing-dot-slow" />
            </div>
          </div>
        </div>
      )}

      <div style={{ ...styles.rightPanel, ...(isMobile ? styles.rightPanelMobile : {}) }}>
        <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
          {isMobile && (
            <div style={styles.mobileLogo}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="url(#mLogo)" />
                <path d="M15 12l-3-3-3 3 3 3 3-3z" fill="white" />
                <defs>
                  <linearGradient id="mLogo" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          )}
          
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>欢迎登录</h2>
            <p style={styles.cardSubtitle}>登录您的 LinkSphere 账户</p>
          </div>
          
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.inputWrapper}>
              <label style={styles.inputLabel}>用户名 / 邮箱</label>
              <div style={styles.inputBox} className="login-input-box">
                <span style={styles.inputPrefix} className="login-input-prefix">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={styles.input}
                  placeholder="请输入用户名或邮箱"
                  autoFocus
                />
              </div>
            </div>
            
            <div style={styles.inputWrapper}>
              <label style={styles.inputLabel}>密码</label>
              <div style={styles.inputBox} className="login-input-box">
                <span style={styles.inputPrefix} className="login-input-prefix">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                  placeholder="请输入密码"
                />
              </div>
            </div>
            
            {error && (
              <div style={styles.errorBox}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ marginLeft: '6px' }}>{error}</span>
              </div>
            )}
            
            <button type="submit" style={styles.loginBtn} disabled={isLoading}>
              {isLoading ? (
                <span style={styles.loadingRow}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.9s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span style={{ marginLeft: '8px' }}>登录中...</span>
                </span>
              ) : (
                '登 录'
              )}
            </button>

            <div style={styles.registerRow}>
              <span style={styles.registerText}>还没有账户？</span>
              <button
                type="button"
                style={styles.registerLink}
                onClick={() => navigate('/register')}
              >
                立即注册
              </button>
            </div>
          </form>
          
          <div style={styles.cardFooter}>
            <span style={styles.copyright}>© 2026 LinkSphere</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: '#FFFFFF',
  },
  containerMobile: {
    background: '#F7F7FA',
  },

  /* 左侧品牌面板 */
  leftPanel: {
    width: '50%',
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #F0F1FF 0%, #F5F3FF 40%, #FAF5FF 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  leftContent: {
    padding: '48px 56px',
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    zIndex: 2,
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  brandLogo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'white',
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.15)',
  },
  brandName: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1F2937',
    letterSpacing: '-0.3px',
  },

  heroContent: {
    marginTop: '72px',
    flex: 1,
  },
  heroTitle: {
    fontSize: '42px',
    fontWeight: 700,
    color: '#1F2937',
    lineHeight: 1.25,
    margin: 0,
    letterSpacing: '-1px',
  },
  heroTitleAccent: {
    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroTitleDot: {
    color: '#6366F1',
  },
  heroDesc: {
    fontSize: '15px',
    lineHeight: 1.7,
    color: '#6B7280',
    marginTop: '20px',
    maxWidth: '420px',
  },

  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginTop: '40px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  featureIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    flexShrink: 0,
  },
  featureIconPurple: { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' },
  featureIconBlue: { background: 'linear-gradient(135deg, #3B82F6, #60A5FA)' },
  featureIconGreen: { background: 'linear-gradient(135deg, #10B981, #34D399)' },
  featureIconOrange: { background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' },
  featureText: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
  },

  decoArea: {
    position: 'absolute',
    right: '-40px',
    bottom: '-40px',
    width: '320px',
    height: '320px',
    pointerEvents: 'none',
  },
  decoOrb1: {
    position: 'absolute',
    top: '40px',
    right: '40px',
    width: '80px',
    height: '80px',
    background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
    borderRadius: '50%',
  },
  decoOrb2: {
    position: 'absolute',
    bottom: '60px',
    left: '30px',
    width: '100px',
    height: '100px',
    background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)',
    borderRadius: '50%',
  },
  decoOrb3: {
    position: 'absolute',
    top: '80px',
    left: '60px',
    width: '60px',
    height: '60px',
    background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)',
    borderRadius: '50%',
  },
  decoRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '200px',
    height: '200px',
    transform: 'translate(-50%, -50%)',
    border: '2px solid rgba(99,102,241,0.15)',
    borderRadius: '50%',
  },
  decoDot1: {
    position: 'absolute',
    top: '20px',
    left: '50%',
    width: '12px',
    height: '12px',
    background: 'rgba(99,102,241,0.6)',
    borderRadius: '50%',
    transform: 'translateX(-50%)',
  },
  decoDot2: {
    position: 'absolute',
    bottom: '30px',
    right: '50px',
    width: '10px',
    height: '10px',
    background: 'rgba(139,92,246,0.5)',
    borderRadius: '50%',
  },
  decoDot3: {
    position: 'absolute',
    top: '100px',
    right: '20px',
    width: '8px',
    height: '8px',
    background: 'rgba(99,102,241,0.4)',
    borderRadius: '50%',
  },

  /* 右侧登录面板 */
  rightPanel: {
    width: '50%',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#FFFFFF',
    padding: '40px',
    boxSizing: 'border-box',
  },
  rightPanelMobile: {
    width: '100%',
    minHeight: 'auto',
    padding: '40px 20px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '0',
    animation: 'fadeInUp 0.5s ease-out',
  },
  cardMobile: {
    maxWidth: '100%',
  },
  mobileLogo: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  cardHeader: {
    marginBottom: '32px',
  },
  cardTitle: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1F2937',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  cardSubtitle: {
    fontSize: '14px',
    color: '#9CA3AF',
    marginTop: '6px',
    margin: 0,
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inputLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#4B5563',
  },
  inputBox: {
    display: 'flex',
    alignItems: 'center',
    background: '#FFFFFF',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    padding: '0 12px',
    height: '44px',
    transition: 'all 0.15s ease',
  },
  inputPrefix: {
    color: '#9CA3AF',
    display: 'flex',
    alignItems: 'center',
    marginRight: '8px',
    transition: 'color 0.15s ease',
  },
  input: {
    flex: 1,
    padding: '0',
    border: 'none',
    background: 'transparent',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
    fontWeight: 400,
  },

  errorBox: {
    display: 'flex',
    alignItems: 'center',
    color: '#DC2626',
    fontSize: '13px',
    padding: '10px 14px',
    background: '#FEF2F2',
    borderRadius: '8px',
    border: '1px solid #FECACA',
  },

  loginBtn: {
    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
    letterSpacing: '2px',
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  registerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '4px',
  },
  registerText: {
    fontSize: '14px',
    color: '#6B7280',
  },
  registerLink: {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '14px',
    fontWeight: 500,
    color: '#6366F1',
    cursor: 'pointer',
  },

  cardFooter: {
    marginTop: '36px',
    paddingTop: '20px',
    borderTop: '1px solid #F3F4F6',
    textAlign: 'center',
  },
  copyright: {
    fontSize: '12px',
    color: '#D1D5DB',
  },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes float1 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(10px, -15px); }
  }
  @keyframes float2 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-12px, 10px); }
  }
  @keyframes float3 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(8px, 12px); }
  }
  @keyframes rotateRing {
    from { transform: translate(-50%, -50%) rotate(0deg); }
    to { transform: translate(-50%, -50%) rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.3); opacity: 0.3; }
  }
  @keyframes pulseSlow {
    0%, 100% { transform: scale(1); opacity: 0.4; }
    50% { transform: scale(1.5); opacity: 0.2; }
  }
  @keyframes logoPulse {
    0%, 100% { box-shadow: 0 4px 14px rgba(99, 102, 241, 0.15); }
    50% { box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3); }
  }
  input::placeholder {
    color: #9CA3AF;
  }
  .login-input-box:hover {
    border-color: #9CA3AF;
  }
  .login-input-box:focus-within {
    border-color: #6366F1;
  }
  .login-input-box:focus-within .login-input-prefix {
    color: #6366F1;
  }
  .login-input-box input:focus {
    outline: none;
  }
  .login-input-box input:-webkit-autofill,
  .login-input-box input:-webkit-autofill:hover,
  .login-input-box input:-webkit-autofill:focus,
  .login-input-box input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 30px white inset !important;
    -webkit-text-fill-color: #111827 !important;
    transition: background-color 5000s ease-in-out 0s;
  }
  .brand-logo-pulse {
    animation: logoPulse 2s ease-in-out infinite;
  }
  .feature-item-animate {
    opacity: 0;
    animation: slideInLeft 0.5s ease-out forwards;
  }
  .floating-orb-1 {
    animation: float1 4s ease-in-out infinite;
  }
  .floating-orb-2 {
    animation: float2 5s ease-in-out infinite;
  }
  .floating-orb-3 {
    animation: float3 6s ease-in-out infinite;
  }
  .rotating-ring {
    animation: rotateRing 20s linear infinite;
  }
  .pulsing-dot {
    animation: pulse 2s ease-in-out infinite;
  }
  .pulsing-dot-delay {
    animation: pulse 2.5s ease-in-out infinite 0.3s;
  }
  .pulsing-dot-slow {
    animation: pulseSlow 3s ease-in-out infinite;
  }
  button[disabled] {
    opacity: 0.7;
    cursor: not-allowed;
  }
  button:not([disabled]):hover {
    transform: translateY(-1px);
  }
`;
document.head.appendChild(styleSheet);