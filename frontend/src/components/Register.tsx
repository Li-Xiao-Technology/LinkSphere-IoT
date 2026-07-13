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

export function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agreeAgreements, setAgreeAgreements] = useState(false);
  const [showAgreement, setShowAgreement] = useState<'user' | 'privacy' | 'terms' | null>(null);
  const isMobile = useIsMobile();
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !email || !password || !confirmPassword) {
      setError('请填写所有字段');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少为6位');
      return;
    }

    if (!agreeAgreements) {
      setError('请阅读并同意所有协议');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, agreeAgreements: true })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || '注册失败');
        setIsLoading(false);
        return;
      }

      const loginSuccess = await login(username, password);
      if (loginSuccess) {
        navigate('/system');
      }
      setIsLoading(false);
    } catch {
      setError('注册失败，请稍后重试');
      setIsLoading(false);
    }
  };

  const agreementContent = () => {
    if (showAgreement === 'user') {
      return (
        <>
          <h2 style={styles.agreementH2}>LinkSphere 用户协议</h2>
          <p style={styles.agreementP}>欢迎使用 LinkSphere 平台。本协议是您与平台运营方之间关于使用本平台服务的法律协议。请仔细阅读本协议。</p>
          
          <h3 style={styles.agreementH3}>一、协议的接受</h3>
          <p style={styles.agreementP}>通过注册或使用本平台，您即表示同意接受本协议的全部条款。如您不同意本协议，请勿使用本平台。</p>
          
          <h3 style={styles.agreementH3}>二、账号管理</h3>
          <ul style={styles.agreementUl}>
            <li>您应妥善保管账号和密码，不得转让、出借或授权他人使用</li>
            <li>因账号泄露或不当使用造成的损失，由您自行承担</li>
            <li>您应确保注册信息真实、准确、完整</li>
          </ul>
          
          <h3 style={styles.agreementH3}>三、服务内容</h3>
          <p style={styles.agreementP}>本平台提供智能设备管理、场景自动化、能耗分析等服务。您可通过本平台接入和控制兼容的智能设备。</p>
          
          <h3 style={styles.agreementH3}>四、用户行为规范</h3>
          <h4 style={styles.agreementH4}>4.1 禁止行为</h4>
          <ul style={styles.agreementUl}>
            <li>违反国家法律法规的任何行为</li>
            <li>未经授权访问、攻击、干扰本平台系统</li>
            <li>利用本平台传播病毒、恶意代码或破坏性程序</li>
            <li>侵害他人合法权益或知识产权</li>
            <li>伪造信息、冒充他人或虚构交易</li>
            <li>其他可能损害本平台或第三方利益的行为</li>
          </ul>
          
          <h4 style={styles.agreementH4}>4.2 设备使用</h4>
          <ul style={styles.agreementUl}>
            <li>您应确保所接入的设备来源合法，不存在任何权属争议</li>
            <li>设备的安装、使用和维护应遵守相关安全规范</li>
            <li>因设备本身质量问题或使用不当造成的损失，由用户自行承担</li>
          </ul>
          
          <h3 style={styles.agreementH3}>五、服务的变更、中断与终止</h3>
          <ul style={styles.agreementUl}>
            <li>本平台有权根据需要随时调整、中断或终止部分或全部服务</li>
            <li>如您违反本协议，本平台有权暂停或终止提供服务</li>
            <li>服务终止后，您的数据可能无法恢复，请提前备份</li>
          </ul>
          
          <h3 style={styles.agreementH3}>六、免责声明</h3>
          <ul style={styles.agreementUl}>
            <li>因不可抗力导致服务中断的，本平台不承担责任</li>
            <li>因网络服务提供商故障、黑客攻击等非本平台原因造成服务中断的，本平台不承担责任</li>
            <li>用户因使用本平台服务而产生的间接损失，本平台不承担责任</li>
            <li>本平台不对第三方设备的质量、性能及安全性提供担保</li>
          </ul>
          
          <h3 style={styles.agreementH3}>七、知识产权</h3>
          <p style={styles.agreementP}>本平台的所有内容，包括但不限于文字、图片、图标、软件、技术方案等，其知识产权均归本平台所有。未经授权，任何人不得擅自复制、传播、修改或用于商业用途。</p>
          
          <h3 style={styles.agreementH3}>八、协议的修改</h3>
          <p style={styles.agreementP}>本平台有权根据需要随时修改本协议。修改后的协议将在本平台公布，继续使用服务即视为同意修改后的协议。</p>
          
          <h3 style={styles.agreementH3}>九、争议解决</h3>
          <p style={styles.agreementP}>因本协议引起的争议，双方应友好协商解决；协商不成的，任何一方均可向本平台所在地有管辖权的人民法院提起诉讼。</p>
          
          <h3 style={styles.agreementH3}>十、联系我们</h3>
          <p style={styles.agreementP}>如您对本协议有任何疑问，可通过平台内反馈渠道与我们联系。</p>
        </>
      );
    }
    
    if (showAgreement === 'privacy') {
      return (
        <>
          <h2 style={styles.agreementH2}>LinkSphere 隐私政策</h2>
          <p style={styles.agreementP}>本隐私政策旨在说明我们如何收集、使用、存储和保护您的个人信息。</p>
          
          <h3 style={styles.agreementH3}>一、信息收集</h3>
          <ul style={styles.agreementUl}>
            <li>注册信息：用户名、邮箱、密码等</li>
            <li>设备信息：设备类型、型号、状态等</li>
            <li>使用信息：操作日志、访问记录等</li>
          </ul>
          
          <h3 style={styles.agreementH3}>二、Cookie 使用</h3>
          <p style={styles.agreementP}>本平台使用 Cookie 来识别您的身份和偏好，优化您的使用体验。您可以在浏览器设置中管理 Cookie。</p>
          
          <h3 style={styles.agreementH3}>三、信息共享</h3>
          <p style={styles.agreementP}>我们不会向第三方出售或出租您的个人信息。仅在以下情况下可能共享：</p>
          <ul style={styles.agreementUl}>
            <li>获得您的明确同意</li>
            <li>遵守法律法规或法院命令</li>
            <li>保护本平台或第三方的合法权益</li>
          </ul>
          
          <h3 style={styles.agreementH3}>四、信息保护</h3>
          <p style={styles.agreementP}>我们采用行业标准的安全措施保护您的信息，但无法保证绝对安全。请妥善保管您的账号密码。</p>
          
          <h3 style={styles.agreementH3}>五、用户权利</h3>
          <ul style={styles.agreementUl}>
            <li>访问和更正您的个人信息</li>
            <li>请求删除您的账户和数据</li>
            <li>限制或拒绝某些数据收集</li>
          </ul>
          
          <h3 style={styles.agreementH3}>六、未成年人保护</h3>
          <p style={styles.agreementP}>本平台不适用于未成年人。如发现未成年人使用本平台，我们将采取措施保护其隐私。</p>
          
          <h3 style={styles.agreementH3}>七、政策更新</h3>
          <p style={styles.agreementP}>本政策可能随时更新，更新后将在本平台公布。继续使用服务即视为同意更新后的政策。</p>
        </>
      );
    }
    
    if (showAgreement === 'terms') {
      return (
        <>
          <h2 style={styles.agreementH2}>LinkSphere 产品服务协议</h2>
          <p style={styles.agreementP}>本协议规定了您使用 LinkSphere 产品和服务的权利和义务。</p>
          
          <h3 style={styles.agreementH3}>一、服务概述</h3>
          <p style={styles.agreementP}>LinkSphere 提供智能设备接入、管理和控制服务，支持多种协议和品牌的设备。</p>
          
          <h3 style={styles.agreementH3}>二、服务等级</h3>
          <ul style={styles.agreementUl}>
            <li>社区版：免费使用，基础功能</li>
            <li>商业版：付费订阅，高级功能和技术支持</li>
          </ul>
          
          <h3 style={styles.agreementH3}>三、服务可用性</h3>
          <p style={styles.agreementP}>我们努力保证服务的稳定性，但不提供 100% 可用性承诺。可能因维护或其他原因中断服务。</p>
          
          <h3 style={styles.agreementH3}>四、设备兼容性</h3>
          <p style={styles.agreementP}>本平台支持多种协议（Modbus、MQTT、Yeelight、西门子 S7 等），具体兼容性请参考官方文档。</p>
          
          <h3 style={styles.agreementH3}>五、用户责任</h3>
          <ul style={styles.agreementUl}>
            <li>确保网络环境安全稳定</li>
            <li>遵守设备厂商的使用规范</li>
            <li>对通过本平台进行的操作负责</li>
          </ul>
          
          <h3 style={styles.agreementH3}>六、费用</h3>
          <p style={styles.agreementP}>社区版免费使用。商业版需支付订阅费用，具体价格以官方公布为准。</p>
          
          <h3 style={styles.agreementH3}>七、知识产权</h3>
          <p style={styles.agreementP}>平台软件、文档、图标等知识产权归运营方所有，用户仅获得使用权。</p>
          
          <h3 style={styles.agreementH3}>八、服务终止</h3>
          <p style={styles.agreementP}>用户可随时注销账户。运营方可因违反协议或其他原因终止服务。</p>
        </>
      );
    }
    
    return null;
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
                开启您的<br />
                <span style={styles.heroTitleAccent}>智能之旅</span>
                <span style={styles.heroTitleDot}>.</span>
              </h1>
              <p style={styles.heroDesc}>
                注册 LinkSphere 账户，立即体验统一设备管理、智能场景联动、
                能耗数据分析等强大功能，打造专属智能生态。
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
            <h2 style={styles.cardTitle}>创建账户</h2>
            <p style={styles.cardSubtitle}>注册您的 LinkSphere 账户</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.inputWrapper}>
              <label style={styles.inputLabel}>用户名</label>
              <div style={styles.inputBox} className="register-input-box">
                <span style={styles.inputPrefix} className="register-input-prefix">
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
                  placeholder="请输入用户名"
                  autoFocus
                />
              </div>
            </div>

            <div style={styles.inputWrapper}>
              <label style={styles.inputLabel}>邮箱</label>
              <div style={styles.inputBox} className="register-input-box">
                <span style={styles.inputPrefix} className="register-input-prefix">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                  placeholder="请输入邮箱地址"
                />
              </div>
            </div>

            <div style={styles.inputWrapper}>
              <label style={styles.inputLabel}>密码</label>
              <div style={styles.inputBox} className="register-input-box">
                <span style={styles.inputPrefix} className="register-input-prefix">
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
                  placeholder="请输入密码（至少6位）"
                />
              </div>
            </div>

            <div style={styles.inputWrapper}>
              <label style={styles.inputLabel}>确认密码</label>
              <div style={styles.inputBox} className="register-input-box">
                <span style={styles.inputPrefix} className="register-input-prefix">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    <path d="M9 16l2 2 4-4" />
                  </svg>
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  placeholder="请再次输入密码"
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

            <div style={styles.agreementSection}>
              <label style={styles.checkboxLabel}>
                <div style={styles.checkboxWrapper} onClick={() => setAgreeAgreements(!agreeAgreements)}>
                  <input
                    type="checkbox"
                    checked={agreeAgreements}
                    onChange={(e) => setAgreeAgreements(e.target.checked)}
                    style={styles.checkboxInput}
                  />
                  <div style={{
                    ...styles.checkboxCustom,
                    ...(agreeAgreements ? styles.checkboxChecked : {})
                  }}>
                    {agreeAgreements && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
                <span style={styles.agreementText}>
                  我已阅读并同意
                  <button
                    type="button"
                    style={styles.agreementLink}
                    onClick={(e) => { e.preventDefault(); setShowAgreement('user'); }}
                  >
                    《用户协议》
                  </button>
                  <span>、</span>
                  <button
                    type="button"
                    style={styles.agreementLink}
                    onClick={(e) => { e.preventDefault(); setShowAgreement('privacy'); }}
                  >
                    《隐私政策》
                  </button>
                  <span>及</span>
                  <button
                    type="button"
                    style={styles.agreementLink}
                    onClick={(e) => { e.preventDefault(); setShowAgreement('terms'); }}
                  >
                    《产品服务协议》
                  </button>
                </span>
              </label>
            </div>

            <button type="submit" style={styles.registerBtn} disabled={isLoading}>
              {isLoading ? (
                <span style={styles.loadingRow}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.9s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span style={{ marginLeft: '8px' }}>注册中...</span>
                </span>
              ) : (
                '注 册 账 户'
              )}
            </button>

            <div style={styles.loginRow}>
              <span style={styles.loginText}>已有账户？</span>
              <button
                type="button"
                style={styles.loginLink}
                onClick={() => navigate('/login')}
              >
                立即登录
              </button>
            </div>
          </form>

          <div style={styles.cardFooter}>
            <span style={styles.copyright}>© 2026 LinkSphere</span>
          </div>
        </div>
      </div>

      {showAgreement && (
        <div style={styles.modalOverlay} onClick={() => setShowAgreement(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()} className="modal-enter">
            <div style={styles.modalHeader}>
              <button
                type="button"
                style={styles.modalCloseBtn}
                onClick={() => setShowAgreement(null)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <h3 style={styles.modalTitle}>
                {showAgreement === 'user' && '用户协议'}
                {showAgreement === 'privacy' && '隐私政策'}
                {showAgreement === 'terms' && '产品服务协议'}
              </h3>
              <div style={{ width: '32px' }} />
            </div>
            <div style={styles.modalBody}>
              {agreementContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  containerMobile: {
    flexDirection: 'column',
  },
  leftPanel: {
    width: '50%',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftContent: {
    width: '100%',
    maxWidth: '480px',
    padding: '60px 50px',
    color: 'white',
    position: 'relative',
    zIndex: 2,
    boxSizing: 'border-box',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '60px',
  },
  brandLogo: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
  },
  brandName: {
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  heroContent: {
    marginBottom: '48px',
  },
  heroTitle: {
    fontSize: '42px',
    fontWeight: 700,
    lineHeight: 1.2,
    margin: 0,
    marginBottom: '16px',
  },
  heroTitleAccent: {
    background: 'linear-gradient(90deg, #E0E7FF, #C4B5FD)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroTitleDot: {
    color: '#A78BFA',
  },
  heroDesc: {
    fontSize: '15px',
    lineHeight: 1.8,
    color: 'rgba(255,255,255,0.75)',
    margin: 0,
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  featureIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconPurple: {
    background: 'rgba(196, 181, 253, 0.25)',
    color: '#C4B5FD',
  },
  featureIconBlue: {
    background: 'rgba(147, 197, 253, 0.25)',
    color: '#93C5FD',
  },
  featureIconGreen: {
    background: 'rgba(134, 239, 172, 0.25)',
    color: '#86EFAC',
  },
  featureIconOrange: {
    background: 'rgba(253, 186, 116, 0.25)',
    color: '#FDBA74',
  },
  featureText: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.9)',
  },
  decoArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
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

  agreementSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '4px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  checkboxWrapper: {
    position: 'relative',
    width: '16px',
    height: '16px',
    flexShrink: 0,
    marginTop: '2px',
    cursor: 'pointer',
  },
  checkboxInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    cursor: 'pointer',
  },
  checkboxCustom: {
    width: '16px',
    height: '16px',
    border: '1.5px solid #D1D5DB',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
    background: 'white',
    boxSizing: 'border-box',
  },
  checkboxChecked: {
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    borderColor: 'transparent',
  },
  agreementText: {
    fontSize: '12px',
    color: '#6B7280',
    lineHeight: 1.6,
  },
  agreementLink: {
    color: '#6366F1',
    textDecoration: 'none',
    fontSize: '12px',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontWeight: 500,
  },

  registerBtn: {
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

  loginRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '4px',
  },
  loginText: {
    fontSize: '14px',
    color: '#6B7280',
  },
  loginLink: {
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
    backdropFilter: 'blur(2px)',
  },
  modalCard: {
    width: '90%',
    maxWidth: '560px',
    maxHeight: '80vh',
    background: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #F3F4F6',
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1F2937',
    margin: 0,
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
    cursor: 'pointer',
    color: '#6B7280',
    transition: 'all 0.15s ease',
  },
  modalBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },

  agreementH2: {
    color: '#1F2937',
    fontSize: '20px',
    fontWeight: 600,
    marginTop: 0,
    marginBottom: '16px',
  },
  agreementH3: {
    color: '#374151',
    fontSize: '16px',
    fontWeight: 600,
    marginTop: '24px',
    marginBottom: '8px',
  },
  agreementH4: {
    color: '#4B5563',
    fontSize: '15px',
    fontWeight: 500,
    marginTop: '16px',
    marginBottom: '8px',
  },
  agreementP: {
    color: '#6B7280',
    fontSize: '14px',
    lineHeight: 1.7,
    margin: '8px 0',
  },
  agreementUl: {
    paddingLeft: '20px',
    margin: '8px 0',
    color: '#6B7280',
    fontSize: '14px',
    lineHeight: 1.7,
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
  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
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
  .register-input-box:hover {
    border-color: #9CA3AF;
  }
  .register-input-box:focus-within {
    border-color: #6366F1;
  }
  .register-input-box:focus-within .register-input-prefix {
    color: #6366F1;
  }
  .register-input-box input:focus {
    outline: none;
  }
  .register-input-box input:-webkit-autofill,
  .register-input-box input:-webkit-autofill:hover,
  .register-input-box input:-webkit-autofill:focus,
  .register-input-box input:-webkit-autofill:active {
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
  .modal-enter {
    animation: modalIn 0.2s ease-out;
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
