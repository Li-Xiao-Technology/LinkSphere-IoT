import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { getUserProfile, updateUserProfile, uploadAvatar, getAvatarUrl, deleteAvatar, UserProfile } from '../api';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

export function Profile({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { setAvatarUrl, setUser } = useAuthStore();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', email: '' });
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [avatarUrlState, setAvatarUrlState] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('avatar.jpg');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<any>(null);
  const cropperInstance = useRef<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showCropper && cropperRef.current && !cropperInstance.current) {
      // @ts-ignore
      import('cropperjs').then((CropperModule) => {
        const CropperClass = (CropperModule.default || CropperModule) as any;
        if (cropperRef.current && !cropperInstance.current) {
          cropperInstance.current = new CropperClass(cropperRef.current, {
            aspectRatio: 1,
            viewMode: 1,
            guides: true,
            background: false,
            scalable: true,
            zoomable: true,
            minCropBoxWidth: 64,
            minCropBoxHeight: 64,
          });
        }
      });
    }

    return () => {
      if (cropperInstance.current) {
        cropperInstance.current.destroy();
        cropperInstance.current = null;
      }
    };
  }, [showCropper]);

  async function loadData() {
    setLoading(true);
    try {
      const [p, avatarRes] = await Promise.all([
        getUserProfile(),
        getAvatarUrl(),
      ]);
      setProfile(p);
      const avatarUrl = avatarRes?.avatarUrl;
      setAvatarUrlState(avatarUrl ? avatarUrl + '?t=' + Date.now() : null);
      setAvatarUrl(avatarUrl ? avatarUrl + '?t=' + Date.now() : null);
      if (p) {
        setProfileForm({ username: p.username, email: p.email || '' });
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('只允许上传 JPEG、PNG、GIF 或 WebP 格式的图片');
      return;
    }

    setError('');
    setCropFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const handleCropConfirm = useCallback(async () => {
    const cropper = cropperInstance.current;
    if (!cropper) return;

    setAvatarUploading(true);
    setError('');

    try {
      const canvas = cropper.getCroppedCanvas({
        width: 256,
        height: 256,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });

      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          setError('裁切失败，请重试');
          setAvatarUploading(false);
          return;
        }

        const file = new File([blob], cropFileName, { type: 'image/jpeg' });

        try {
          const result = await uploadAvatar(file);
          if (result.success && result.data?.avatarUrl) {
            if (cropperInstance.current) {
              cropperInstance.current.destroy();
              cropperInstance.current = null;
            }
            const urlWithTimestamp = result.data.avatarUrl + '?t=' + Date.now();
            setAvatarUrlState(urlWithTimestamp);
            setAvatarUrl(urlWithTimestamp);
            setSuccess('头像上传成功');
            setShowCropper(false);
            setCropImageSrc(null);
            setTimeout(() => setSuccess(''), 2000);
          } else {
            setError(result.message || '上传失败');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : '上传失败');
        } finally {
          setAvatarUploading(false);
        }
      }, 'image/jpeg', 0.92);
    } catch (err) {
      setError(err instanceof Error ? err.message : '裁切失败');
      setAvatarUploading(false);
    }
  }, [cropFileName, setAvatarUrl]);

  function handleCropCancel() {
    if (cropperInstance.current) {
      cropperInstance.current.destroy();
      cropperInstance.current = null;
    }
    setShowCropper(false);
    setCropImageSrc(null);
    setAvatarUploading(false);
  }

  async function handleDeleteAvatar() {
    if (!avatarUrlState) return;

    try {
      const result = await deleteAvatar();
      if (result.success) {
        setAvatarUrlState(null);
        setAvatarUrl(null);
        setSuccess(result.message);
        setTimeout(() => setSuccess(''), 2000);
      } else {
        setError(result.message || '删除失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  function handleStartEdit() {
    if (profile) {
      setProfileForm({ username: profile.username, email: profile.email || '' });
    }
    setIsEditing(true);
    setError('');
    setSuccess('');
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setError('');
    setSuccess('');
  }

  async function handleSaveProfile() {
    setError('');
    setSuccess('');
    if (!profileForm.username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (profileForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setProfileSubmitting(true);
    try {
      const result = await updateUserProfile({
        username: profileForm.username,
        email: profileForm.email || undefined,
      });
      setProfile(result);
      setUser({
        id: result.id,
        username: result.username,
        email: result.email,
        role: result.role as 'admin' | 'member' | 'viewer',
        createdAt: result.createdAt,
      });
      setSuccess('资料更新成功');
      setIsEditing(false);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setProfileSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.loadingState}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <div style={styles.loadingText}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, ...(isMobile ? styles.containerMobile : {}) }}>
      <div style={{ ...styles.header, ...(isMobile ? styles.headerMobile : {}) }}>
        <div>
          <h2 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>个人资料</h2>
          <p style={{ ...styles.subtitle, ...(isMobile ? styles.subtitleMobile : {}) }}>查看和管理您的个人信息</p>
        </div>
        {!isEditing ? (
          <button style={styles.editButton} onClick={handleStartEdit}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            编辑资料
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={styles.cancelButton} onClick={handleCancelEdit}>
              取消
            </button>
            <button
              style={styles.saveButton}
              onClick={handleSaveProfile}
              disabled={profileSubmitting}
            >
              {profileSubmitting && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              保存
            </button>
          </div>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.profileCard}>
        <div style={styles.profileHeader}>
          <div style={styles.avatarSection}>
            <div style={styles.avatarWrapper} className="avatar-wrapper">
              {avatarUrlState ? (
                <img src={avatarUrlState} alt="用户头像" style={styles.avatarImage} />
              ) : (
                <div style={styles.avatarPlaceholder}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
              <div style={styles.avatarOverlay} className="avatar-overlay">
                <button
                  style={styles.avatarActionButton}
                  className="avatar-action-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
                {avatarUrlState && (
                  <button
                    style={{ ...styles.avatarActionButton, ...styles.avatarDeleteButton }}
                    className="avatar-action-button delete"
                    onClick={handleDeleteAvatar}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            />
          </div>

          <div style={styles.userInfoSection}>
            <div style={styles.username}>{profile?.username}</div>
            <div style={styles.userRole}>
              <span style={styles.roleBadge}>
                {profile?.role === 'admin' ? '管理员' : profile?.role === 'member' ? '成员' : '查看者'}
              </span>
            </div>
            <div style={styles.userEmail}>
              {profile?.email || '未设置邮箱'}
            </div>
          </div>
        </div>

        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <div style={styles.infoIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div style={styles.infoContent}>
              <div style={styles.infoLabel}>用户名</div>
              {isEditing ? (
                <input
                  type="text"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, username: e.target.value }))}
                  style={styles.infoInput}
                  placeholder="输入用户名"
                />
              ) : (
                <div style={styles.infoValue}>{profile?.username}</div>
              )}
            </div>
          </div>

          <div style={styles.infoItem}>
            <div style={styles.infoIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div style={styles.infoContent}>
              <div style={styles.infoLabel}>电子邮箱</div>
              {isEditing ? (
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                  style={styles.infoInput}
                  placeholder="输入邮箱（可选）"
                />
              ) : (
                <div style={styles.infoValue}>{profile?.email || '未设置'}</div>
              )}
            </div>
          </div>

          <div style={styles.infoItem}>
            <div style={styles.infoIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div style={styles.infoContent}>
              <div style={styles.infoLabel}>账户角色</div>
              <div style={styles.infoValue}>
                <span style={styles.roleBadgeInline}>
                  {profile?.role === 'admin' ? '管理员' : profile?.role === 'member' ? '成员' : '查看者'}
                </span>
              </div>
            </div>
          </div>

          <div style={styles.infoItem}>
            <div style={styles.infoIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div style={styles.infoContent}>
              <div style={styles.infoLabel}>创建时间</div>
              <div style={styles.infoValue}>
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleString('zh-CN') : '-'}
              </div>
            </div>
          </div>

          <div style={styles.infoItem}>
            <div style={styles.infoIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div style={styles.infoContent}>
              <div style={styles.infoLabel}>加入的家庭</div>
              <div style={styles.householdList}>
                {profile?.households.map((h) => (
                  <div key={h.id} style={styles.householdItem}>
                    <span style={styles.householdName}>{h.name}</span>
                    <span style={styles.householdRoleBadge}>
                      {h.role === 'owner' ? '所有者' : h.role === 'admin' ? '管理员' : h.role === 'member' ? '成员' : '查看者'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.quickActions}>
        <h3 style={styles.sectionTitle}>快捷操作</h3>
        <div style={styles.actionGrid}>
          <button style={styles.actionCard} onClick={() => onNavigate?.('settings')}>
            <div style={{ ...styles.actionIcon, background: 'rgba(0, 95, 184, 0.08)', color: '#005FB8' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div style={styles.actionInfo}>
              <div style={styles.actionTitle}>系统设置</div>
              <div style={styles.actionDesc}>密码、通知、外观等</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.actionArrow}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {showCropper && cropImageSrc && (
        <div style={styles.cropperOverlay} className="anim-fade-in">
          <div style={styles.cropperDialog}>
            <div style={styles.cropperHeader}>
              <h3 style={styles.cropperTitle}>裁切头像</h3>
              <button style={styles.cropperClose} onClick={handleCropCancel}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.cropperBody}>
              <div style={{ height: 360, width: '100%', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                <img ref={cropperRef} src={cropImageSrc} alt="裁切预览" style={{ maxWidth: '100%', display: 'block' }} />
              </div>
              <p style={styles.cropperHint}>拖动选框调整裁切区域，滚轮缩放图片</p>
            </div>
            <div style={styles.cropperFooter}>
              <button style={styles.cropperCancelBtn} onClick={handleCropCancel}>
                取消
              </button>
              <button
                style={styles.cropperConfirmBtn}
                onClick={handleCropConfirm}
                disabled={avatarUploading}
              >
                {avatarUploading ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    上传中...
                  </>
                ) : (
                  '确认上传'
                )}
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
    background: 'var(--w11-bg-app)',
  },
  containerMobile: {
    padding: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  headerMobile: {
    flexDirection: 'column',
    gap: '16px',
  },
  title: {
    fontSize: '26px',
    fontWeight: 700,
    color: 'var(--w11-text-primary)',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  titleMobile: {
    fontSize: '22px',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--w11-text-secondary)',
    marginTop: '4px',
    margin: 0,
  },
  subtitleMobile: {},
  editButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    background: 'var(--w11-accent)',
    border: 'none',
    color: '#FFFFFF',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
    transition: 'all 0.15s ease',
  },
  cancelButton: {
    padding: '9px 16px',
    background: 'var(--w11-bg-layer-alt)',
    border: '1px solid var(--w11-stroke)',
    color: 'var(--w11-text-secondary)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  saveButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    background: 'var(--w11-accent)',
    border: 'none',
    color: '#FFFFFF',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
  },
  error: {
    padding: '10px 14px',
    background: 'rgba(196, 43, 28, 0.08)',
    border: '1px solid rgba(196, 43, 28, 0.2)',
    color: '#C42B1C',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  success: {
    padding: '10px 14px',
    background: 'rgba(16, 124, 16, 0.08)',
    border: '1px solid rgba(16, 124, 16, 0.2)',
    color: '#107C10',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  loadingState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  },
  loadingText: {
    fontSize: '14px',
    color: 'var(--w11-text-secondary)',
  },
  profileCard: {
    background: 'var(--w11-bg-card)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid var(--w11-stroke)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: 'var(--w11-shadow-2)',
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    marginBottom: '24px',
    paddingBottom: '24px',
    borderBottom: '1px solid var(--w11-stroke-divider)',
  },
  avatarSection: {
    flexShrink: 0,
  },
  avatarWrapper: {
    position: 'relative',
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    overflow: 'hidden',
    border: '4px solid var(--w11-accent-light)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--w11-bg-layer-alt)',
    color: 'var(--w11-text-tertiary)',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px',
    background: 'linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent)',
    opacity: 0,
    transition: 'opacity 0.2s',
  },
  avatarActionButton: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.95)',
    border: 'none',
    borderRadius: '50%',
    color: '#1A1A1A',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  avatarDeleteButton: {
    background: 'rgba(196, 43, 28, 0.9)',
    color: '#FFFFFF',
  },
  userInfoSection: {
    flex: 1,
  },
  username: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--w11-text-primary)',
    marginBottom: '8px',
    letterSpacing: '-0.02em',
  },
  userRole: {
    marginBottom: '8px',
  },
  roleBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    background: 'var(--w11-accent-light)',
    color: 'var(--w11-accent)',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
  },
  userEmail: {
    fontSize: '14px',
    color: 'var(--w11-text-secondary)',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  infoItem: {
    display: 'flex',
    gap: '14px',
    padding: '16px',
    background: 'var(--w11-bg-layer-alt)',
    borderRadius: '10px',
    border: '1px solid var(--w11-stroke-divider)',
  },
  infoIcon: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--w11-accent-light)',
    color: 'var(--w11-accent)',
    borderRadius: '10px',
    flexShrink: 0,
  },
  infoContent: {
    flex: 1,
    minWidth: 0,
  },
  infoLabel: {
    fontSize: '12px',
    color: 'var(--w11-text-tertiary)',
    fontWeight: 500,
    marginBottom: '4px',
  },
  infoValue: {
    fontSize: '14px',
    color: 'var(--w11-text-primary)',
    fontWeight: 500,
  },
  infoInput: {
    width: '100%',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid var(--w11-stroke)',
    fontSize: '14px',
    color: 'var(--w11-text-primary)',
    background: 'var(--w11-bg-card)',
    outline: 'none',
    fontWeight: 500,
  },
  roleBadgeInline: {
    display: 'inline-block',
    padding: '3px 10px',
    background: 'var(--w11-accent-light)',
    color: 'var(--w11-accent)',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  },
  householdList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  householdItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  householdName: {
    fontSize: '14px',
    color: 'var(--w11-text-primary)',
    fontWeight: 500,
  },
  householdRoleBadge: {
    fontSize: '11px',
    color: 'var(--w11-accent)',
    background: 'var(--w11-accent-light)',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 600,
  },
  quickActions: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--w11-text-primary)',
    margin: 0,
    marginBottom: '16px',
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
  },
  actionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px',
    background: 'var(--w11-bg-card)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid var(--w11-stroke)',
    borderRadius: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
    boxShadow: 'var(--w11-shadow-2)',
  },
  actionIcon: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    flexShrink: 0,
  },
  actionInfo: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--w11-text-primary)',
    marginBottom: '2px',
  },
  actionDesc: {
    fontSize: '12px',
    color: 'var(--w11-text-tertiary)',
  },
  actionArrow: {
    color: 'var(--w11-text-tertiary)',
    flexShrink: 0,
  },
  cropperOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  cropperDialog: {
    background: 'var(--w11-bg-card)',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  cropperHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--w11-stroke)',
  },
  cropperTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--w11-text-primary)',
    margin: 0,
  },
  cropperClose: {
    background: 'transparent',
    border: 'none',
    color: 'var(--w11-text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropperBody: {
    padding: '20px',
  },
  cropperHint: {
    fontSize: '12px',
    color: 'var(--w11-text-tertiary)',
    textAlign: 'center',
    marginTop: '12px',
    marginBottom: 0,
  },
  cropperFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '16px 20px',
    borderTop: '1px solid var(--w11-stroke)',
  },
  cropperCancelBtn: {
    padding: '8px 16px',
    background: 'var(--w11-bg-layer-alt)',
    border: '1px solid var(--w11-stroke)',
    color: 'var(--w11-text-secondary)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  cropperConfirmBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 20px',
    background: 'var(--w11-accent)',
    border: 'none',
    color: '#FFFFFF',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
};
