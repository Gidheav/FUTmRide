import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle,
  Shield, KeyRound, Loader2, Sparkles, ArrowRight, ShieldCheck, CircleAlert,
} from 'lucide-react'
import { T } from '../theme'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'

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

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
  accent = false,
}: {
  icon: any
  title: string
  subtitle: string
  children: ReactNode
  accent?: boolean
}) {
  return (
    <section style={{ ...s.section, ...(accent ? s.sectionAccent : {}) }}>
      <div style={s.sectionHeader}>
        <div style={{ ...s.iconCircle, ...(accent ? s.iconCircleAccent : {}) }}>
          <Icon size={20} color={accent ? '#fff' : T.accent} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 style={s.sectionTitle}>{title}</h3>
          <p style={s.sectionSub}>{subtitle}</p>
        </div>
      </div>

      {children}
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

function InputField({
  label, type = 'text', value, onChange, placeholder, icon: Icon, disabled,
  showToggle, onToggle, visible,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void
  placeholder?: string; icon?: any; disabled?: boolean
  showToggle?: boolean; onToggle?: () => void; visible?: boolean
}) {
  return (
    <div style={s.fieldWrap}>
      <label style={s.label}>{label}</label>
      <div style={s.inputWrap}>
        {Icon && <Icon size={16} color={T.textMuted} style={{ marginRight: 10 }} />}
        <input
          type={showToggle ? (visible ? 'text' : 'password') : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={s.input}
          autoComplete="off"
        />
        {showToggle && (
          <button type="button" onClick={onToggle} style={s.toggleBtn}>
            {visible ? <EyeOff size={16} color={T.textMuted} /> : <Eye size={16} color={T.textMuted} />}
          </button>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────── Email Change Section ──────────────────── */

function EmailChangeSection() {
  const { user, setAuth } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus(null)
    if (!currentPassword || !newEmail) {
      setStatus({ msg: 'All fields are required.', type: 'error' })
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/settings/change-email/', {
        current_password: currentPassword,
        new_email: newEmail,
      })
      setStatus({ msg: res.data.message || 'Email updated successfully.', type: 'success' })
      setCurrentPassword('')
      setNewEmail('')
      // Update local auth store with new email
      if (user) {
        const access = localStorage.getItem('access_token') || ''
        const refresh = localStorage.getItem('refresh_token') || ''
        setAuth({ ...user, email: res.data.email }, access, refresh)
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.error?.details?.current_password?.[0]
        || err.response?.data?.error?.details?.new_email?.[0]
        || 'Failed to update email.'
      setStatus({ msg, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard
      icon={Mail}
      title="Email Address"
      subtitle={`Current: ${user?.email || 'Not set'}`}
    >
      <div style={s.sectionMetaRow}>
        <InfoPill icon={ShieldCheck} label="Protected with current password" />
        <InfoPill icon={Sparkles} label="Updates your live auth profile" />
      </div>

      {status && <StatusBanner msg={status.msg} type={status.type} />}

      <form onSubmit={handleSubmit} style={s.form}>
        <InputField
          label="Current Password"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Enter your current password"
          icon={Lock}
          showToggle
          visible={showPw}
          onToggle={() => setShowPw(p => !p)}
        />
        <InputField
          label="New Email Address"
          type="email"
          value={newEmail}
          onChange={setNewEmail}
          placeholder="your-new-email@example.com"
          icon={Mail}
        />
        <button type="submit" disabled={loading} style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}>
          {loading ? <Loader2 size={16} className="spin" /> : <CheckCircle size={16} />}
          <span style={{ marginLeft: 8 }}>{loading ? 'Updating…' : 'Update Email'}</span>
        </button>
      </form>
    </SectionCard>
  )
}

/* ──────────────────── Password Change Section ─────────────────── */

type PwStep = 'request' | 'confirm'

function PasswordChangeSection() {
  const [step, setStep] = useState<PwStep>('request')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [emailHint, setEmailHint] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const { clearAuth } = useAuthStore()

  const handleRequestOTP = async (e: FormEvent) => {
    e.preventDefault()
    setStatus(null)
    if (!currentPassword) {
      setStatus({ msg: 'Current password is required.', type: 'error' })
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/settings/password-change/request-otp/', {
        current_password: currentPassword,
      })
      setEmailHint(res.data.email_hint || '')
      setStep('confirm')
      setStatus({ msg: res.data.message || 'OTP sent to your email.', type: 'success' })
    } catch (err: any) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.error?.details?.current_password?.[0]
        || 'Failed to request OTP.'
      setStatus({ msg, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault()
    setStatus(null)
    if (!otpCode || !newPassword || !confirmPassword) {
      setStatus({ msg: 'All fields are required.', type: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      setStatus({ msg: 'Passwords do not match.', type: 'error' })
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/settings/password-change/confirm/', {
        otp_code: otpCode,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setStatus({ msg: 'Password changed successfully. Redirecting to login…', type: 'success' })
      setTimeout(() => {
        clearAuth()
        window.location.href = '/login'
      }, 2000)
    } catch (err: any) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.error?.details?.otp_code?.[0]
        || err.response?.data?.error?.details?.new_password?.[0]
        || 'Failed to change password.'
      setStatus({ msg, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard
      icon={KeyRound}
      title="Change Password"
      subtitle={`Requires email OTP verification for security.${emailHint ? ` Code sent to ${emailHint}` : ''}`}
      accent
    >
      <div style={s.sectionMetaRow}>
        <InfoPill icon={ShieldCheck} label={step === 'request' ? 'Step 1: Request code' : 'Step 2: Confirm change'} />
        <InfoPill icon={CircleAlert} label="You will be signed out after a successful change" />
      </div>

      {status && <StatusBanner msg={status.msg} type={status.type} />}

      {step === 'request' ? (
        <form onSubmit={handleRequestOTP} style={s.form}>
          <InputField
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="Enter your current password"
            icon={Lock}
            showToggle
            visible={showPw}
            onToggle={() => setShowPw(p => !p)}
          />
          <p style={s.hint}>
            <Shield size={14} color={T.textMuted} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            A 6-digit verification code will be sent to your email.
          </p>
          <button type="submit" disabled={loading} style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}>
            {loading ? <Loader2 size={16} className="spin" /> : <Mail size={16} />}
            <span style={{ marginLeft: 8 }}>{loading ? 'Sending…' : 'Send Verification Code'}</span>
          </button>
        </form>
      ) : (
        <form onSubmit={handleConfirm} style={s.form}>
          <InputField
            label="Verification Code"
            value={otpCode}
            onChange={setOtpCode}
            placeholder="Enter 6-digit code from email"
            icon={Shield}
          />
          <InputField
            label="New Password"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Enter new password (min 8 chars)"
            icon={Lock}
            showToggle
            visible={showNew}
            onToggle={() => setShowNew(p => !p)}
          />
          <InputField
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Re-enter new password"
            icon={Lock}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => { setStep('request'); setStatus(null); setOtpCode(''); setNewPassword(''); setConfirmPassword('') }}
              style={s.btnSecondary}
            >
              ← Back
            </button>
            <button type="submit" disabled={loading} style={{ ...s.btn, flex: 1, opacity: loading ? 0.7 : 1 }}>
              {loading ? <Loader2 size={16} className="spin" /> : <CheckCircle size={16} />}
              <span style={{ marginLeft: 8 }}>{loading ? 'Changing…' : 'Change Password'}</span>
            </button>
          </div>
        </form>
      )}
    </SectionCard>
  )
}

/* ──────────────────────── Main Settings Page ──────────────────── */

export default function SettingsPage() {
  const { user } = useAuthStore()

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .spin { animation: spin 1s linear infinite; }

        @media (max-width: 1080px) {
          .settings-grid {
            grid-template-columns: 1fr !important;
          }

          .settings-sidebar {
            order: 2;
          }
        }

        @media (max-width: 720px) {
          .settings-shell {
            padding: 18px 4px !important;
          }

          .settings-header {
            padding: 20px !important;
          }

          .settings-hero {
            grid-template-columns: 1fr !important;
          }

          .settings-chipRow {
            flex-wrap: wrap;
          }

          .settings-actions {
            flex-direction: column !important;
          }
        }
      `}</style>
      <main style={s.main} className="settings-shell">
        <div style={s.bgGlowA} />
        <div style={s.bgGlowB} />

        <div style={s.header} className="settings-header">
          <div style={s.heroGrid} className="settings-hero">
            <div>
              <div style={s.kicker}>
                <Sparkles size={12} color={T.accent} />
                <span>Campus admin security</span>
              </div>
              <h1 style={s.title}>Account Settings</h1>
              <p style={s.subtitle}>Manage your email address and password from a single, structured security workspace.</p>

              <div style={s.chipRow} className="settings-chipRow">
                <InfoPill icon={Mail} label="Email updates" />
                <InfoPill icon={Lock} label="Password reset via OTP" />
                <InfoPill icon={Shield} label="Authenticated actions only" />
              </div>
            </div>

            <div style={s.heroCard}>
              <div style={s.heroCardTop}>
                <div style={s.heroIcon}>
                  <ShieldCheck size={18} color={T.accent} />
                </div>
                <div>
                  <div style={s.heroCardTitle}>Security summary</div>
                  <div style={s.heroCardText}>Your settings changes are protected by password confirmation and email OTP verification.</div>
                </div>
              </div>

              <div style={s.heroCardStats}>
                <div style={s.statBlock}>
                  <span style={s.statLabel}>Current email</span>
                  <span style={s.statValue}>{user?.email || 'Not set'}</span>
                </div>
                <div style={s.statDivider} />
                <div style={s.statBlock}>
                  <span style={s.statLabel}>Password flow</span>
                  <span style={s.statValue}>Request code → confirm</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={s.contentGrid} className="settings-grid">
          <div style={s.contentCol}>
            <EmailChangeSection />
            <PasswordChangeSection />
          </div>

          <aside style={s.sidebarCard} className="settings-sidebar">
            <div style={s.sidebarHeader}>
              <div style={s.sidebarIcon}>
                <ShieldCheck size={18} color={T.accent} />
              </div>
              <div>
                <div style={s.sidebarTitle}>What to expect</div>
                <div style={s.sidebarText}>The page is reorganized for clarity, but the underlying flows remain the same.</div>
              </div>
            </div>

            <div style={s.checklist}>
              <SecurityChecklistItem
                icon={Mail}
                title="Email changes"
                text="Enter your current password, submit the new email, and your local auth snapshot updates immediately on success."
              />
              <SecurityChecklistItem
                icon={KeyRound}
                title="Password changes"
                text="Request a verification code first, then confirm the new password with the OTP sent to your inbox."
              />
              <SecurityChecklistItem
                icon={Shield}
                title="Session handling"
                text="Successful password changes still clear the session and redirect to login, just like before."
              />
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
            All changes are logged for security. Password changes require email OTP verification.
          </span>
        </div>
      </main>
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

  sectionMetaRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 },

  section: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 20,
    padding: 22,
    boxShadow: '0 10px 30px rgba(0,0,0,0.10)',
  },
  sectionAccent: {
    background: `linear-gradient(180deg, ${T.bgPanel} 0%, ${T.bgCard} 100%)`,
  },
  sectionHeader: { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 14,
    background: T.accentBg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  iconCircleAccent: {
    background: T.accent,
    boxShadow: `0 10px 22px ${T.accentBg}`,
  },
  sectionTitle: { color: T.textPrimary, fontSize: 16, fontWeight: 600, margin: 0 },
  sectionSub: { color: T.textSecondary, fontSize: 13, margin: '4px 0 0', lineHeight: 1.5 },

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

  footer: {
    display: 'flex', alignItems: 'center',
    padding: '16px 0', borderTop: `1px solid ${T.border}`,
    marginTop: 12,
    position: 'relative',
    zIndex: 1,
  },
}
