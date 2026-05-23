import { useState, type CSSProperties, type FormEvent } from 'react'
import {
  Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle,
  Shield, KeyRound, Loader2,
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
    <section style={s.section}>
      <div style={s.sectionHeader}>
        <div style={s.iconCircle}><Mail size={20} color={T.accent} /></div>
        <div>
          <h3 style={s.sectionTitle}>Email Address</h3>
          <p style={s.sectionSub}>
            Current: <strong style={{ color: T.textPrimary }}>{user?.email || 'Not set'}</strong>
          </p>
        </div>
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
    </section>
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
        window.location.href = '/campus-admin/login'
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
    <section style={s.section}>
      <div style={s.sectionHeader}>
        <div style={s.iconCircle}><KeyRound size={20} color={T.accent} /></div>
        <div>
          <h3 style={s.sectionTitle}>Change Password</h3>
          <p style={s.sectionSub}>
            Requires email OTP verification for security.
            {emailHint && <> Code sent to <strong style={{ color: T.textPrimary }}>{emailHint}</strong></>}
          </p>
        </div>
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
    </section>
  )
}

/* ──────────────────────── Main Settings Page ──────────────────── */

export default function SettingsPage() {
  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
      <main style={s.main}>
        <div style={s.header}>
          <h1 style={s.title}>Account Settings</h1>
          <p style={s.subtitle}>Manage your email address and password securely.</p>
        </div>

        <EmailChangeSection />
        <PasswordChangeSection />

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
  main: { padding: 24, maxWidth: 680, margin: '0 auto' },
  header: { marginBottom: 32 },
  title: { color: T.textPrimary, fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { color: T.textSecondary, fontSize: 14, marginTop: 6 },

  section: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 12,
    background: T.accentBg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: { color: T.textPrimary, fontSize: 16, fontWeight: 600, margin: 0 },
  sectionSub: { color: T.textSecondary, fontSize: 13, margin: '4px 0 0' },

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

  btn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: T.accent, color: '#fff', border: 'none',
    borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', transition: 'opacity 0.2s',
  },
  btnSecondary: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', color: T.textSecondary,
    border: `1px solid ${T.border}`,
    borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 500,
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
    marginTop: 8,
  },
}
