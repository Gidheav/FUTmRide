import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle,
  Shield, KeyRound, Loader2, Sparkles, ArrowRight, ShieldCheck, CircleAlert,
  Monitor, Bell, Sliders, Settings, AtSign, BookOpen, MailCheck, LogOut, Key, Info, ArrowLeft
} from 'lucide-react'
import { T, useCampusThemeStore } from '../theme'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'
import { useSettingsStore } from '../settingsStore'

/* ──────────────────────────── helpers ──────────────────────────── */

function StatusBanner({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  const bg = type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'
  const fg = type === 'success' ? '#10b981' : '#ef4444'
  const Icon = type === 'success' ? CheckCircle : AlertCircle
  return (
    <div style={{ ...s.banner, background: bg, borderColor: fg }}>
      <Icon size={16} color={fg} style={{ flexShrink: 0 }} />
      <span style={{ color: fg, fontSize: 13, lineHeight: '1.4' }}>{msg}</span>
    </div>
  )
}

function SettingsCard({
  title, subtitle, children, footer, danger
}: {
  title: string; subtitle: string; children: ReactNode; footer?: ReactNode; danger?: boolean
}) {
  return (
    <section style={{ ...s.settingsCard, ...(danger ? s.settingsCardDanger : {}) }}>
      <div style={s.settingsCardBody}>
        <div style={s.settingsCardHeader}>
          <h3 style={s.settingsCardTitle}>{title}</h3>
          <p style={s.settingsCardSub}>{subtitle}</p>
        </div>
        {children}
      </div>
      {footer && (
        <div style={{ ...s.settingsCardFooter, ...(danger ? s.settingsCardFooterDanger : {}) }}>
          {footer}
        </div>
      )}
    </section>
  )
}

function InfoPill({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div style={s.infoPill}>
      <Icon size={13} color={T.textMuted} />
      <span style={s.infoPillText}>{label}</span>
    </div>
  )
}

function SecurityChecklistItem({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div style={s.checkItem}>
      <div style={s.checkIconWrap}>
        <Icon size={15} color={T.accent} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={s.checkTitle}>{title}</div>
        <div style={s.checkText}>{text}</div>
      </div>
    </div>
  )
}

/* ──────────────────────── Replica Section ──────────────────── */

function EmailChangeSectionReplica() {
  const { user, setAuth } = useAuthStore()
  const { mode } = useCampusThemeStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const glassPanelStyle = {
    background: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
  }
  const inputDarkStyle = {
    background: mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    color: T.textPrimary,
    outline: 'none',
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus(null)
    if (!currentPassword || !newEmail) return setStatus({ msg: 'All fields are required.', type: 'error' })
    setLoading(true)
    try {
      const res = await api.post('/auth/settings/change-email/', { current_password: currentPassword, new_email: newEmail })
      setStatus({ msg: res.data.message || 'Email updated successfully.', type: 'success' })
      setCurrentPassword(''); setNewEmail('')
      if (user) {
        setAuth({ ...user, email: res.data.email }, localStorage.getItem('access_token') || '', localStorage.getItem('refresh_token') || '')
      }
    } catch (err: any) {
      setStatus({ msg: err.response?.data?.error?.message || 'Failed to update email.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={{ ...glassPanelStyle, borderRadius: 16, padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={24} style={{ color: T.textMuted }} />
          Email Management
        </h2>
        <span style={{ padding: '4px 12px', background: `${T.accent}33`, color: T.accent, fontSize: 12, fontWeight: 700, borderRadius: 999, border: `1px solid ${T.accent}4d` }}>
          Verified
        </span>
      </div>

      <div style={{ background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', padding: 16, borderRadius: 8, marginBottom: 32, border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>Current Email</p>
          <p style={{ fontSize: 16, color: T.textPrimary, fontFamily: 'monospace' }}>{user?.email || 'Not set'}</p>
        </div>
        <CheckCircle size={24} color={T.accent} fill={`${T.accent}33`} />
      </div>

      {status && <StatusBanner msg={status.msg} type={status.type} />}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="settings-form-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>New Email Address</label>
            <div style={{ position: 'relative' }}>
              <AtSign size={18} style={{ color: T.textMuted, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ ...inputDarkStyle, width: '100%', borderRadius: 8, padding: '12px 16px 12px 40px', fontSize: 14 }} placeholder="Enter new email" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>Current Password <span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ color: T.textMuted, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{ ...inputDarkStyle, width: '100%', borderRadius: 8, padding: '12px 16px 12px 40px', fontSize: 14 }} placeholder="Required for change" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
          <p style={{ fontSize: 12, color: T.textMuted, maxWidth: 300, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Info size={16} color="#4f90ff" style={{ flexShrink: 0 }} />
            <span>Enter your current password, submit the new email, and your local auth snapshot updates immediately on success.</span>
          </p>
          <button type="submit" disabled={loading} style={{ background: T.accent, color: '#fff', padding: '12px 32px', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: `0 10px 15px -3px ${T.accent}33`, opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading ? <Loader2 size={16} className="spin" /> : null}
            Save Changes
          </button>
        </div>
      </form>
    </section>
  )
}

function PasswordChangeSectionReplica() {
  const { mode } = useCampusThemeStore()
  const { clearAuth } = useAuthStore()
  const [step, setStep] = useState<'request' | 'confirm'>('request')
  const [currentPassword, setCurrentPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const glassPanelStyle = {
    background: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
  }
  const inputDarkStyle = {
    background: mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    color: T.textPrimary,
    outline: 'none',
  }

  const handleRequestOTP = async () => {
    setStatus(null)
    if (!currentPassword) return setStatus({ msg: 'Current password is required.', type: 'error' })
    setLoading(true)
    try {
      const res = await api.post('/auth/settings/password-change/request-otp/', { current_password: currentPassword })
      setStep('confirm')
      setStatus({ msg: res.data.message || 'OTP sent to your email.', type: 'success' })
    } catch (err: any) {
      setStatus({ msg: err.response?.data?.error?.message || 'Failed to request OTP.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    setStatus(null)
    if (!otpCode || !newPassword || !confirmPassword) return setStatus({ msg: 'All fields are required.', type: 'error' })
    if (newPassword !== confirmPassword) return setStatus({ msg: 'Passwords do not match.', type: 'error' })
    setLoading(true)
    try {
      await api.post('/auth/settings/password-change/confirm/', {
        otp_code: otpCode, new_password: newPassword, confirm_password: confirmPassword,
      })
      setStatus({ msg: 'Password changed successfully. Redirecting to login…', type: 'success' })
      setTimeout(() => {
        clearAuth()
        window.location.href = '/login'
      }, 2000)
    } catch (err: any) {
      setStatus({ msg: err.response?.data?.error?.message || 'Failed to change password.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={{ ...glassPanelStyle, borderRadius: 16, padding: '32px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -80, top: -80, width: 256, height: 256, borderRadius: '50%', background: `${T.accent}1a`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={24} style={{ color: T.textMuted }} />
            Change Password
          </h2>
          <p style={{ fontSize: 14, color: T.textMuted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShieldCheck size={16} /> Requires email OTP verification.
          </p>
        </div>
      </div>

      {status && <StatusBanner msg={status.msg} type={status.type} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Step 1 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>Current Password</label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
              <Lock size={18} style={{ color: T.textMuted, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{ ...inputDarkStyle, width: '100%', borderRadius: 8, padding: '12px 16px 12px 40px', fontSize: 14 }} placeholder="Enter current password" />
            </div>
            <button type="button" onClick={handleRequestOTP} disabled={loading} style={{ background: mode === 'dark' ? '#2f3131' : '#e2e2e2', color: T.textPrimary, padding: '12px 24px', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              {loading && step === 'request' ? <Loader2 size={16} className="spin" /> : null}
              Request Code
            </button>
          </div>
          <p style={{ fontSize: 12, color: T.textMuted }}>A 6-digit code will be sent to your inbox.</p>
        </div>

        {/* Step 2 */}
        <div style={{ opacity: step === 'request' ? 0.4 : 1, pointerEvents: step === 'request' ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 24, borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, position: 'relative' }}>
          {step === 'request' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 12, borderRadius: '50%' }}>
                <Lock size={24} color="#fff" />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>Verification Code (OTP)</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input type="text" value={otpCode} onChange={e => setOtpCode(e.target.value)} maxLength={6} style={{ ...inputDarkStyle, width: '100%', maxWidth: 240, textAlign: 'center', fontSize: 20, fontFamily: 'monospace', letterSpacing: '0.5em', padding: '12px 0', borderRadius: 8 }} placeholder="------" />
            </div>
          </div>

          <div className="settings-form-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <Key size={18} style={{ color: T.textMuted, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ ...inputDarkStyle, width: '100%', borderRadius: 8, padding: '12px 16px 12px 40px', fontSize: 14 }} placeholder="Must be at least 8 characters" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Key size={18} style={{ color: T.textMuted, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ ...inputDarkStyle, width: '100%', borderRadius: 8, padding: '12px 16px 12px 40px', fontSize: 14 }} placeholder="Re-enter new password" />
              </div>
            </div>
          </div>

          <button type="button" onClick={handleConfirm} disabled={loading} style={{ width: '100%', background: T.accent, color: '#fff', opacity: loading && step === 'confirm' ? 0.7 : 1, padding: 16, borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
            {loading && step === 'confirm' ? <Loader2 size={16} className="spin" /> : null}
            Confirm & Update Password
          </button>
        </div>
      </div>
    </section>
  )
}

function SettingsRightSidebarReplica() {
  const { mode } = useCampusThemeStore()

  const glassPanelStyle = {
    background: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
  }

  return (
    <div style={{ ...glassPanelStyle, borderRadius: 16, padding: '32px 24px', position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOpen size={24} color={T.accent} />
        What to expect
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4, background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
            <MailCheck size={18} style={{ color: T.textMuted }} />
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: T.textPrimary }}>Email Changes</h4>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: T.textMuted }}>Providing your current password alongside your new email results in an immediate update to your profile. No secondary confirmation required.</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4, background: `${T.accent}1a`, border: `1px solid ${T.accent}4d` }}>
            <ShieldCheck size={18} color={T.accent} />
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: T.textPrimary }}>Password Changes</h4>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: T.textMuted }}>You must first verify intent by requesting a 6-digit OTP code to your registered email before a new password can be set.</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4, background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)` }}>
            <LogOut size={18} color="#f87171" />
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: T.textPrimary }}>Session Handling</h4>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: T.textMuted }}>A successful password change will immediately invalidate all active sessions across all devices. You will be redirected to the login screen.</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
        <a href="#" style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, color: '#4f90ff', textDecoration: 'none' }}>
          Read Security Policy <ArrowRight size={16} />
        </a>
      </div>
    </div>
  )
}

/* ──────────────────── Tab Placeholder Sections ─────────────────── */

function DisplaySettingsSection() {
  return (
    <SettingsCard title="Map & Display Preferences" subtitle="Customize how the dashboard looks.">
      <div style={s.emptyCard}>Display settings will be available in a future update.</div>
    </SettingsCard>
  )
}

function NotificationSettingsSection() {
  return (
    <SettingsCard title="Alerts & Notifications" subtitle="Manage sound and popup rules.">
      <div style={s.emptyCard}>Notification settings will be available in a future update.</div>
    </SettingsCard>
  )
}

function SystemSettingsSection() {
  return (
    <SettingsCard title="System Configuration" subtitle="Global variables and operational rules.">
      <div style={s.emptyCard}>System configuration is currently managed via the Engine section.</div>
    </SettingsCard>
  )
}

/* ──────────────────────── Main Settings Page ──────────────────── */

export default function SettingsPage() {
  const { activeTab } = useSettingsStore()
  const { mode } = useCampusThemeStore()

  const titles = {
    display: 'Display Preferences',
    notifications: 'Alert Rules',
    system: 'Global Configuration'
  }
  const subtitles = {
    display: 'Customize the visual behavior and map defaults across the application.',
    notifications: 'Configure push, email, and sound alerts for critical campus operations.',
    system: 'Adjust operational boundaries, matchmaking rules, and system-wide constraints.'
  }

  const glassPanelStyle = {
    background: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
  }

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .spin { animation: spin 1s linear infinite; }

        .settings-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .settings-replica-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 32px;
        }

        @media (max-width: 1080px) {
          .settings-grid {
            grid-template-columns: 1fr !important;
          }

          .settings-sidebar {
            order: 2;
          }

          .settings-replica-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 720px) {
          .settings-shell {
            padding: 18px 4px !important;
          }


          .settings-chipRow {
            flex-wrap: wrap;
          }

          .settings-form-grid {
            grid-template-columns: 1fr !important;
          }

          .settings-actions {
            flex-direction: column !important;
          }
        }
      `}</style>

      {activeTab === 'account' ? (
        <main style={{ flex: 1, overflowY: 'auto', width: '100%', padding: '32px 24px', background: mode === 'dark' ? '#1a1c1c' : '#f9f9f9' }}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* Security Grid */}
            <div className="settings-replica-grid">

              {/* Left Column (Main Forms) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                <EmailChangeSectionReplica />
                <PasswordChangeSectionReplica />
              </div>

              {/* Right Column (Info) */}
              <div>
                <SettingsRightSidebarReplica />
              </div>

            </div>
          </div>
        </main>
      ) : (
        <main style={s.main} className="settings-shell">
          <div style={s.bgGlowA} />
          <div style={s.bgGlowB} />

          <div style={s.header} className="settings-header">
            <div style={s.heroGrid} className="settings-hero">
              <div>
                <div style={s.kicker}>
                  <Settings size={12} color={T.accent} />
                  <span>System Configuration</span>
                </div>
                {/* @ts-ignore */}
                <h1 style={s.title}>{titles[activeTab]}</h1>
                {/* @ts-ignore */}
                <p style={s.subtitle}>{subtitles[activeTab]}</p>
              </div>

              <div style={s.heroCard}>
                <div style={s.heroCardTop}>
                  <div style={s.heroIcon}>
                    <ShieldCheck size={18} color={T.accent} />
                  </div>
                  <div>
                    <div style={s.heroCardTitle}>Configuration summary</div>
                    <div style={s.heroCardText}>These settings manage the global variables and UI preferences for your local browser environment.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={s.contentGrid} className="settings-grid">
            <div style={s.contentCol}>
              {activeTab === 'display' && <DisplaySettingsSection />}
              {activeTab === 'notifications' && <NotificationSettingsSection />}
              {activeTab === 'system' && <SystemSettingsSection />}
            </div>

            <aside style={s.sidebarCard} className="settings-sidebar">
              <div style={s.sidebarHeader}>
                <div style={s.sidebarIcon}>
                  <ShieldCheck size={18} color={T.accent} />
                </div>
                <div>
                  <div style={s.sidebarTitle}>What to expect</div>
                  <div style={s.sidebarText}>The settings interface is categorized into distinct domains.</div>
                </div>
              </div>

              <div style={s.checklist}>
                {activeTab === 'display' ? (
                  <SecurityChecklistItem
                    icon={Monitor}
                    title="UI Customization"
                    text="Display settings are saved to your browser's local storage and persist across sessions."
                  />
                ) : activeTab === 'notifications' ? (
                  <SecurityChecklistItem
                    icon={Bell}
                    title="Actionable Alerts"
                    text="Customize which operational events trigger sound notifications or dashboard popups."
                  />
                ) : (
                  <SecurityChecklistItem
                    icon={Sliders}
                    title="Global Constraints"
                    text="System rules affect all active operations and can only be modified by root administrators."
                  />
                )}
              </div>

              <div style={s.sidebarFooter}>
                <ArrowRight size={14} color={T.textMuted} />
                <span style={s.sidebarFooterText}>No changes were made to request payloads or endpoints.</span>
              </div>
            </aside>
          </div>

          <div style={s.footer}>
            <Shield size={14} color={T.textMuted} />
            <span style={{ color: T.textMuted, fontSize: 12, marginLeft: 6 }}>
              All changes are logged for security.
            </span>
          </div>
        </main>
      )}
    </>
  )
}

/* ──────────────────────────── styles ──────────────────────────── */

const s: Record<string, CSSProperties> = {
  main: {
    position: 'relative',
    flex: 1,
    overflowY: 'auto',
    padding: '24px 0',
    boxSizing: 'border-box',
    width: '100%',
  },
  bgGlowA: {
    position: 'absolute',
    top: -64,
    right: -96,
    width: 260,
    height: 260,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, rgba(168,85,247,0) 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  bgGlowB: {
    position: 'absolute',
    bottom: 120,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0) 68%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  header: { marginBottom: 24, position: 'relative', zIndex: 1 },
  kicker: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 999,
    background: T.accentBg,
    color: T.textPrimary,
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 14,
  },
  title: { color: T.textPrimary, fontSize: 30, fontWeight: 800, lineHeight: 1.1, margin: 0 },
  subtitle: { color: T.textSecondary, fontSize: 14, marginTop: 10, maxWidth: 680, lineHeight: 1.6 },
  chipRow: { display: 'flex', gap: 10, marginTop: 18 },

  heroGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: 18, alignItems: 'stretch' },
  heroCard: {
    background: `linear-gradient(180deg, ${T.bgPanel} 0%, ${T.bgCard} 100%)`,
    border: `1px solid ${T.border}`,
    borderRadius: 20,
    padding: 20,
    boxShadow: '0 12px 34px rgba(0,0,0,0.14)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  heroCardTop: { display: 'flex', gap: 14, alignItems: 'flex-start' },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    background: T.accentBg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroCardTitle: { color: T.textPrimary, fontSize: 15, fontWeight: 700 },
  heroCardText: { color: T.textSecondary, fontSize: 13, lineHeight: 1.55, marginTop: 4 },
  heroCardStats: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: 16,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    background: T.bgInput,
    border: `1px solid ${T.border}`,
  },
  statBlock: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  statLabel: { color: T.textMuted, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontWeight: 700 },
  statValue: { color: T.textPrimary, fontSize: 13, fontWeight: 600, lineHeight: 1.4 },
  statDivider: { width: 1, height: 36, background: T.border },

  contentGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, position: 'relative', zIndex: 1 },
  contentCol: { display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 },

  sidebarCard: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 20,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    alignSelf: 'start',
  },
  sidebarHeader: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  sidebarIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: T.accentBg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sidebarTitle: { color: T.textPrimary, fontSize: 15, fontWeight: 700 },
  sidebarText: { color: T.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 1.5 },
  checklist: { display: 'flex', flexDirection: 'column', gap: 14 },
  checkItem: {
    display: 'flex',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    background: T.bgInput,
    border: `1px solid ${T.border}`,
  },
  checkIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: T.accentBg,
    flexShrink: 0,
  },
  checkTitle: { color: T.textPrimary, fontSize: 13, fontWeight: 700, marginBottom: 4 },
  checkText: { color: T.textSecondary, fontSize: 12, lineHeight: 1.5 },
  sidebarFooter: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 10,
    borderTop: `1px solid ${T.border}`,
  },
  sidebarFooterText: { color: T.textMuted, fontSize: 12, lineHeight: 1.5 },

  settingsCard: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  },
  settingsCardDanger: {
    borderColor: 'rgba(239,68,68,0.3)',
  },
  settingsCardBody: {
    padding: '24px 28px',
  },
  settingsCardHeader: {
    marginBottom: 20,
  },
  settingsCardTitle: { color: T.textPrimary, fontSize: 16, fontWeight: 700, margin: 0 },
  settingsCardSub: { color: T.textSecondary, fontSize: 13, margin: '4px 0 0', lineHeight: 1.5 },
  settingsCardFooter: {
    background: T.bgInput,
    borderTop: `1px solid ${T.border}`,
    padding: '14px 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  settingsCardFooterDanger: {
    background: 'rgba(239,68,68,0.02)',
    borderTopColor: 'rgba(239,68,68,0.1)',
  },

  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: T.textSecondary, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  inputWrap: {
    display: 'flex', alignItems: 'center',
    background: T.bgInput, border: `1px solid ${T.border}`,
    borderRadius: 10, padding: '0 14px', height: 44,
    transition: 'border-color 0.2s',
  },
  input: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: T.textPrimary, fontSize: 14, height: '100%',
  },
  toggleBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
    display: 'flex', alignItems: 'center',
  },
  infoPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
    borderRadius: 999,
    border: `1px solid ${T.border}`,
    background: T.bgInput,
    color: T.textSecondary,
    fontSize: 12,
    fontWeight: 600,
  },
  infoPillText: { whiteSpace: 'nowrap' },

  btn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: T.accent, color: '#fff', border: 'none',
    borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', transition: 'opacity 0.2s',
  },
  btnSecondary: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', color: T.textSecondary,
    border: `1px solid ${T.border}`,
    borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 500,
    cursor: 'pointer',
  },

  banner: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', borderRadius: 10,
    border: '1px solid', marginBottom: 16,
  },

  hint: {
    color: T.textMuted, fontSize: 12, margin: 0,
    display: 'flex', alignItems: 'center',
  },

  emptyCard: { padding: 16, fontSize: 13, color: T.textMuted, border: `1px dashed ${T.border}`, borderRadius: 10, textAlign: 'center' },

  footer: {
    display: 'flex', alignItems: 'center',
    padding: '16px 0', borderTop: `1px solid ${T.border}`,
    marginTop: 12,
    position: 'relative',
    zIndex: 1,
  },
}
