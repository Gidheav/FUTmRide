import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle, RefreshCw,
  Shield, KeyRound, Loader2, Sparkles, ArrowRight, ShieldCheck, CircleAlert,
  Monitor, Bell, Sliders, Settings, AtSign, BookOpen, MailCheck, LogOut, Key, Info, ArrowLeft,
  Globe, Undo, Save, Layers, Route, MapPin, X, Plus, Car, Coffee, Bus,
  Wallet, Activity, Copy, Cloud, Clock, BarChart2, Database, Map,
  TrendingUp, Ticket, Star, Medal, Target, AlertTriangle, GraduationCap, IdCard, Ban, UserCheck, History,
  Headphones, MessageSquare, Timer, Zap, ToggleLeft, Palette, Smartphone, Signal, Mail as MailIcon,
  Lock as LockIcon, Globe as GlobeIcon, Table
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

type SystemHealthStatus = 'operational' | 'degraded' | 'down' | 'unavailable' | 'unconfigured' | 'paused' | 'pending' | string

type SystemHealthItem = {
  id?: string | number | null
  name?: string
  status?: SystemHealthStatus
  status_label?: string
  uptime_ratio_24h?: number | null
  average_response_ms?: number | null
  last_duration_ms?: number | null
  last_execution?: number | null
  next_execution?: number | null
}

type SystemHealthProvider = {
  provider: string
  configured: boolean
  status: SystemHealthStatus
  summary?: string
  checked_at?: string
  items?: SystemHealthItem[]
  monitors_total?: number
  monitors_up?: number
  monitors_down?: number
  uptime_ratio_24h?: number | null
  average_response_ms?: number | null
  jobs_total?: number
  jobs_ok?: number
  jobs_failed?: number
  jobs_disabled?: number
  jobs_unknown?: number
  average_duration_ms?: number | null
  last_execution?: number | null
  next_execution?: number | null
}

type SystemHealthReport = {
  generated_at?: string
  cache_ttl_seconds?: number
  overall?: {
    status?: SystemHealthStatus
    summary?: string
    checked_at?: string
  }
  uptime_robot?: SystemHealthProvider
  cron_job_org?: SystemHealthProvider
}

function statusLabel(status?: SystemHealthStatus) {
  const labels: Record<string, string> = {
    operational: 'Operational',
    degraded: 'Degraded',
    down: 'Down',
    unavailable: 'Unavailable',
    unconfigured: 'Needs Key',
    paused: 'Paused',
    pending: 'Pending',
  }
  return labels[String(status || 'pending')] || 'Unknown'
}

function statusTone(status?: SystemHealthStatus) {
  const key = String(status || 'pending')
  if (key === 'operational') {
    return { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' }
  }
  if (key === 'down' || key === 'unavailable') {
    return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' }
  }
  if (key === 'degraded') {
    return { color: T.warn, bg: T.warnBg, border: 'rgba(245,158,11,0.35)' }
  }
  if (key === 'unconfigured') {
    return { color: T.blue, bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)' }
  }
  return { color: T.textMuted, bg: T.bgCard, border: T.borderLight }
}

function HealthStatusPill({ status, label }: { status?: SystemHealthStatus; label?: string }) {
  const tone = statusTone(status)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: tone.bg, border: `1px solid ${tone.border}`, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone.color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: tone.color }}>{label || statusLabel(status)}</span>
    </div>
  )
}

function formatHealthPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
  return `${Number(value).toFixed(2)}%`
}

function formatHealthMs(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
  const numeric = Number(value)
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(1)}s`
  return `${Math.round(numeric)}ms`
}

function formatHealthDate(value?: string | number | null) {
  if (!value) return 'Not available'
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  })
}

function HealthProviderCard({
  title,
  provider,
  kind,
  icon: Icon,
}: {
  title: string
  provider?: SystemHealthProvider
  kind: 'uptime' | 'cron'
  icon: any
}) {
  const tone = statusTone(provider?.status)
  const metrics = kind === 'uptime'
    ? [
        { label: 'Monitors Up', value: provider?.configured ? `${provider?.monitors_up ?? 0}/${provider?.monitors_total ?? 0}` : 'N/A' },
        { label: '24h Uptime', value: provider?.configured ? formatHealthPercent(provider?.uptime_ratio_24h) : 'N/A' },
        { label: 'Avg Response', value: provider?.configured ? formatHealthMs(provider?.average_response_ms) : 'N/A' },
      ]
    : [
        { label: 'Jobs OK', value: provider?.configured ? `${provider?.jobs_ok ?? 0}/${provider?.jobs_total ?? 0}` : 'N/A' },
        { label: 'Failed', value: provider?.configured ? String(provider?.jobs_failed ?? 0) : 'N/A' },
        { label: 'Avg Duration', value: provider?.configured ? formatHealthMs(provider?.average_duration_ms) : 'N/A' },
      ]
  const rows = provider?.items?.slice(0, 3) || []

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 0, padding: 16, minHeight: 250, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 0, background: tone.bg, border: `1px solid ${tone.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={18} color={tone.color} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h4 style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary, margin: 0 }}>{title}</h4>
            <p style={{ fontSize: 11, color: T.textMuted, margin: '3px 0 0' }}>{provider?.configured ? 'Live provider report' : 'Waiting for .env key'}</p>
          </div>
        </div>
        <HealthStatusPill status={provider?.status} />
      </div>

      <p style={{ fontSize: 12, lineHeight: 1.5, color: T.textSecondary, minHeight: 36, margin: 0 }}>
        {provider?.summary || 'No provider data loaded yet.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, borderTop: `1px solid ${T.borderLight}`, borderBottom: `1px solid ${T.borderLight}`, padding: '12px 0' }}>
        {metrics.map(metric => (
          <div key={metric.label} style={{ minWidth: 0 }}>
            <p style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{metric.label}</p>
            <p style={{ fontSize: 15, color: T.textPrimary, fontWeight: 800, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{metric.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
        {rows.length > 0 ? rows.map(row => (
          <div key={`${row.id}-${row.name}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, color: T.textPrimary, fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name || 'Monitor'}</p>
              <p style={{ fontSize: 10, color: T.textMuted, margin: '2px 0 0' }}>
                {kind === 'uptime'
                  ? formatHealthPercent(row.uptime_ratio_24h)
                  : `Next: ${formatHealthDate(row.next_execution)}`}
              </p>
            </div>
            <HealthStatusPill status={row.status} label={row.status_label || statusLabel(row.status)} />
          </div>
        )) : (
          <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>
            {provider?.configured ? 'No individual monitors or jobs returned.' : 'Add the provider API key to backend/.env.'}
          </p>
        )}
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

  const inputDarkStyle = {
    background: 'transparent',
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    outline: 'none',
    borderRadius: 0,
    width: '100%',
    maxWidth: 320,
    padding: '8px 12px 8px 32px',
    fontSize: 13
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
        const { getAccessToken, getRefreshToken } = await import('../../core/tokenStorage')
        setAuth({ ...user, email: res.data.email }, getAccessToken() || '', getRefreshToken() || '')
      }
    } catch (err: any) {
      setStatus({ msg: err.response?.data?.error?.message || 'Failed to update email.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={18} style={{ color: T.textMuted }} />
          Email Management
        </h2>
        <span style={{ padding: '2px 8px', background: `${T.accent}33`, color: T.accent, fontSize: 11, fontWeight: 700, borderRadius: 999, border: `1px solid ${T.accent}4d` }}>
          Verified
        </span>
      </div>

      <div style={{ background: T.bgPanel, padding: 12, borderRadius: 8, marginBottom: 24, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>Current Email</p>
          <p style={{ fontSize: 13, color: T.textPrimary, fontFamily: 'monospace' }}>{user?.email || 'Not set'}</p>
        </div>
        <CheckCircle size={18} color={T.accent} fill={`${T.accent}33`} />
      </div>

      {status && <StatusBanner msg={status.msg} type={status.type} />}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>New Email Address</label>
            <div style={{ position: 'relative', maxWidth: 320 }}>
              <AtSign size={16} style={{ color: T.textMuted, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={inputDarkStyle} placeholder="Enter new email" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Current Password <span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ position: 'relative', maxWidth: 320 }}>
              <Lock size={16} style={{ color: T.textMuted, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputDarkStyle} placeholder="Required for change" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
          <button type="submit" disabled={loading} style={{ background: T.accent, color: T.textWhite, padding: '8px 20px', borderRadius: 0, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading ? <Loader2 size={14} className="spin" /> : null}
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

  const inputDarkStyle = {
    background: 'transparent',
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    outline: 'none',
    borderRadius: 0,
    width: '100%',
    maxWidth: 320,
    padding: '8px 12px 8px 32px',
    fontSize: 13
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
    <section style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', right: -80, top: -80, width: 256, height: 256, borderRadius: '50%', background: `${T.accent}1a`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={18} style={{ color: T.textMuted }} />
            Change Password
          </h2>
          <p style={{ fontSize: 12, color: T.textMuted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShieldCheck size={14} /> Requires email OTP verification.
          </p>
        </div>
      </div>

      {status && <StatusBanner msg={status.msg} type={status.type} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Step 1 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Current Password</label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
              <Lock size={16} style={{ color: T.textMuted, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputDarkStyle} placeholder="Enter current password" />
            </div>
            <button type="button" onClick={handleRequestOTP} disabled={loading} style={{ width: '100%', maxWidth: 320, background: T.bgCardHover, color: T.textPrimary, padding: '8px 16px', borderRadius: 0, fontSize: 13, fontWeight: 700, border: `1px solid ${T.borderLight}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              {loading && step === 'request' ? <Loader2 size={14} className="spin" /> : null}
              Request Code
            </button>
          </div>
          <p style={{ fontSize: 11, color: T.textMuted }}>A 6-digit code will be sent to your inbox.</p>
        </div>

        {/* Step 2 */}
        <div style={{ opacity: step === 'request' ? 0.4 : 1, pointerEvents: step === 'request' ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 24, borderTop: `1px solid ${T.border}`, position: 'relative' }}>
          {step === 'request' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 12, borderRadius: 0 }}>
                <Lock size={24} color={T.textWhite} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Verification Code (OTP)</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input type="text" value={otpCode} onChange={e => setOtpCode(e.target.value)} maxLength={6} style={{ ...inputDarkStyle, maxWidth: 240, textAlign: 'center', fontSize: 16, fontFamily: 'monospace', letterSpacing: '0.3em', padding: '8px 0', paddingLeft: 0 }} placeholder="------" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>New Password</label>
              <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
                <Key size={16} style={{ color: T.textMuted, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputDarkStyle} placeholder="Must be at least 8 characters" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Confirm Password</label>
              <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
                <Key size={16} style={{ color: T.textMuted, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputDarkStyle} placeholder="Re-enter new password" />
              </div>
            </div>
          </div>

          <button type="button" onClick={handleConfirm} disabled={loading} style={{ width: '100%', maxWidth: 320, background: T.accent, color: T.textWhite, opacity: loading && step === 'confirm' ? 0.7 : 1, padding: '10px 16px', borderRadius: 0, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
            {loading && step === 'confirm' ? <Loader2 size={14} className="spin" /> : null}
            Confirm & Update Password
          </button>
        </div>
      </div>
    </section>
  )
}

function SettingsRightSidebarReplica() {
  const { mode } = useCampusThemeStore()

  return (
    <div style={{ position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOpen size={18} color={T.accent} />
        What to expect
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4, background: T.bgCard, border: `1px solid ${T.borderLight}` }}>
            <MailCheck size={14} style={{ color: T.textMuted }} />
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: T.textPrimary }}>Email Changes</h4>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: T.textMuted }}>Providing your current password alongside your new email results in an immediate update to your profile. No secondary confirmation required.</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4, background: `${T.accent}1a`, border: `1px solid ${T.accent}4d` }}>
            <ShieldCheck size={14} color={T.accent} />
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: T.textPrimary }}>Password Changes</h4>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: T.textMuted }}>You must first verify intent by requesting a 6-digit OTP code to your registered email before a new password can be set.</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4, background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)` }}>
            <LogOut size={14} color="#f87171" />
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: T.textPrimary }}>Session Handling</h4>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: T.textMuted }}>A successful password change will immediately invalidate all active sessions across all devices. You will be redirected to the login screen.</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${T.border}` }}>
        <a href="#" style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, color: '#4f90ff', textDecoration: 'none' }}>
          Read Security Policy <ArrowRight size={16} />
        </a>
      </div>
    </div>
  )
}

/* ──────────────────── Tab Placeholder Sections ─────────────────── */

function MapGisSettingsReplica() {
  const { mode } = useCampusThemeStore()
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/auth/settings/map/')
      setSettings(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleUpdate = (updates: any) => {
    setSettings((prev: any) => ({ ...prev, ...updates }))
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setActionMsg(null)
    try {
      await api.patch('/auth/settings/map/', settings)
      setActionMsg({ text: 'Map settings saved successfully.', ok: true })
    } catch (err: any) {
      setActionMsg({ text: err.response?.data?.error?.message || 'Failed to save settings.', ok: false })
    } finally {
      setSaving(false)
      setTimeout(() => setActionMsg(null), 3000)
    }
  }

  const handleAddPOI = () => {
    const name = window.prompt('Enter POI Name:')
    if (name && name.trim()) {
      handleUpdate({ pois: [...(settings.pois || []), name.trim()] })
    }
  }

  const handleRemovePOI = (index: number) => {
    const newPois = [...(settings.pois || [])]
    newPois.splice(index, 1)
    handleUpdate({ pois: newPois })
  }

  const panelStyle = {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 0,
    padding: 24,
    display: 'flex',
    flexDirection: 'column' as const,
  }

  const inputStyle = {
    background: 'transparent',
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    outline: 'none',
    borderRadius: 0,
    padding: '8px 12px',
    fontSize: 13,
  }

  if (loading || !settings) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 size={24} className="spin" color={T.accent} /></div>
  }

  const providerNames: Record<string, string> = {
    'google': 'Google Maps',
    'mapbox': 'Mapbox GL',
    'osrm': 'OSRM Self-Hosted'
  }

  return (
    <div style={{ width: '100%', margin: 0, display: 'flex', flexDirection: 'column', gap: 32 }}>

      {actionMsg && <StatusBanner msg={actionMsg.text} type={actionMsg.ok ? 'success' : 'error'} />}

      {/* Grid Layout */}
      <div className="gis-grid">
        
        {/* Map Provider Settings */}
        <section style={{ ...panelStyle, gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.border}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} style={{ color: T.textMuted }} />
              Map Provider Details
            </h3>
            <span style={{ background: `${T.accent}1a`, color: T.accent, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: `1px solid ${T.accent}4d` }}>
              Active: {providerNames[settings.active_provider] || settings.active_provider}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div 
              onClick={() => handleUpdate({ active_provider: 'google' })}
              style={{ border: settings.active_provider === 'google' ? `2px solid ${T.accent}` : `1px solid ${T.borderLight}`, background: settings.active_provider === 'google' ? `${T.accent}0d` : T.bgCard, borderRadius: 8, padding: 16, cursor: 'pointer', position: 'relative' }}
            >
              {settings.active_provider === 'google' && <CheckCircle size={18} color={T.accent} fill={`${T.accent}33`} style={{ position: 'absolute', top: 12, right: 12 }} />}
              <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Google Maps API</h4>
              <p style={{ fontSize: 12, color: T.textSecondary }}>High-fidelity campus roads, standard latency.</p>
            </div>
            <div 
              onClick={() => handleUpdate({ active_provider: 'mapbox' })}
              style={{ border: settings.active_provider === 'mapbox' ? `2px solid ${T.accent}` : `1px solid ${T.borderLight}`, background: settings.active_provider === 'mapbox' ? `${T.accent}0d` : T.bgCard, borderRadius: 8, padding: 16, cursor: 'pointer', position: 'relative' }}
            >
              {settings.active_provider === 'mapbox' && <CheckCircle size={18} color={T.accent} fill={`${T.accent}33`} style={{ position: 'absolute', top: 12, right: 12 }} />}
              <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Mapbox GL</h4>
              <p style={{ fontSize: 12, color: T.textSecondary }}>Custom vector tiles, high performance.</p>
            </div>
            <div 
              onClick={() => handleUpdate({ active_provider: 'osrm' })}
              style={{ border: settings.active_provider === 'osrm' ? `2px solid ${T.accent}` : `1px solid ${T.borderLight}`, background: settings.active_provider === 'osrm' ? `${T.accent}0d` : T.bgCard, borderRadius: 8, padding: 16, cursor: 'pointer', position: 'relative' }}
            >
              {settings.active_provider === 'osrm' && <CheckCircle size={18} color={T.accent} fill={`${T.accent}33`} style={{ position: 'absolute', top: 12, right: 12 }} />}
              <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>OSRM Self-Hosted</h4>
              <p style={{ fontSize: 12, color: T.textSecondary }}>Zero API costs, local routing focus.</p>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>Custom Style JSON (Day Theme)</label>
            <textarea 
              value={settings.custom_style_json}
              onChange={e => handleUpdate({ custom_style_json: e.target.value })}
              style={{ ...inputStyle, width: '100%', height: 120, fontFamily: 'monospace', fontSize: 12, resize: 'none' }} 
            />
          </div>
        </section>

        {/* Real-time Layers */}
        <section style={{ ...panelStyle, gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.border}` }}>
            <Sliders size={18} style={{ color: T.textMuted }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Real-time Layers</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Live Traffic Conditions</p>
                <p style={{ fontSize: 12, color: T.textSecondary }}>Overlay red/yellow congestion lines</p>
              </div>
              <input type="checkbox" checked={settings.live_traffic_enabled} onChange={e => handleUpdate({ live_traffic_enabled: e.target.checked })} style={{ width: 40, height: 20, cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Demand Heatmaps</p>
                <p style={{ fontSize: 12, color: T.textSecondary }}>Show rider request density</p>
              </div>
              <input type="checkbox" checked={settings.demand_heatmaps_enabled} onChange={e => handleUpdate({ demand_heatmaps_enabled: e.target.checked })} style={{ width: 40, height: 20, cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Driver Clustering</p>
                <p style={{ fontSize: 12, color: T.textSecondary }}>Group idle drivers on zoom out</p>
              </div>
              <input type="checkbox" checked={settings.driver_clustering_enabled} onChange={e => handleUpdate({ driver_clustering_enabled: e.target.checked })} style={{ width: 40, height: 20, cursor: 'pointer' }} />
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>Refresh Interval (Seconds)</label>
            <select 
              value={settings.refresh_interval_seconds}
              onChange={e => handleUpdate({ refresh_interval_seconds: parseInt(e.target.value) })}
              style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
            >
              <option value={5}>5s (High Battery Drain)</option>
              <option value={15}>15s (Balanced)</option>
              <option value={30}>30s (Eco Mode)</option>
              <option value={60}>60s (Static Map)</option>
            </select>
          </div>
        </section>

        {/* Routing Engine Weights */}
        <section style={{ ...panelStyle, gridColumn: 'span 6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.border}` }}>
            <Route size={18} style={{ color: T.textMuted }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Routing Engine Weights</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
                <span style={{ color: T.textPrimary }}>Prefer Main Campus Roads</span>
                <span style={{ color: T.accent }}>{settings.prefer_main_roads_weight}%</span>
              </div>
              <input 
                type="range" min="0" max="100" 
                value={settings.prefer_main_roads_weight} 
                onChange={e => handleUpdate({ prefer_main_roads_weight: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: T.accent, cursor: 'pointer' }} 
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
                <span style={{ color: T.textPrimary }}>Avoid Pedestrian Walkways</span>
                <span style={{ color: '#ef4444' }}>{settings.avoid_pedestrian_weight}%</span>
              </div>
              <input 
                type="range" min="0" max="100" 
                value={settings.avoid_pedestrian_weight} 
                onChange={e => handleUpdate({ avoid_pedestrian_weight: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: '#ef4444', cursor: 'pointer' }} 
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
                <span style={{ color: T.textPrimary }}>Speed Limit Enforcement</span>
                <span style={{ color: '#f59e0b' }}>{settings.speed_limit_enforcement_weight}%</span>
              </div>
              <input 
                type="range" min="0" max="100" 
                value={settings.speed_limit_enforcement_weight} 
                onChange={e => handleUpdate({ speed_limit_enforcement_weight: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }} 
              />
            </div>
          </div>

          <div style={{ marginTop: 24, padding: 16, background: mode === 'dark' ? '#111' : '#fff', border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 8 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={14} /> Buffer Zones
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: T.textSecondary }}>Geofence buffer for ride requests:</span>
              <input 
                type="number" 
                value={settings.geofence_buffer_meters}
                onChange={e => handleUpdate({ geofence_buffer_meters: parseInt(e.target.value) || 0 })}
                style={{ ...inputStyle, width: 80 }}
              />
              <span style={{ fontSize: 12, color: T.textSecondary }}>meters</span>
            </div>
          </div>
        </section>

        {/* POI & Visuals */}
        <section style={{ ...panelStyle, gridColumn: 'span 6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={18} style={{ color: T.textMuted }} />
              POI & Landmark Management
            </h3>
            <button style={{ background: 'none', border: 'none', color: T.accent, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Manage All</button>
          </div>

          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, marginBottom: 20, flexWrap: 'wrap' }} className="no-scrollbar">
            {(settings.pois || []).map((poi: string, i: number) => (
              <div key={i} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, background: mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', padding: '6px 12px', borderRadius: 999, border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                <MapPin size={14} color={T.accent} />
                <span style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>{poi}</span>
                <X size={12} color={T.textMuted} style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => handleRemovePOI(i)} />
              </div>
            ))}
            <button onClick={handleAddPOI} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, background: mode === 'dark' ? '#2f3131' : '#e2e2e2', padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer' }}>
              <Plus size={14} color={T.textPrimary} />
              <span style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>Add POI</span>
            </button>
          </div>

          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 12 }}>Visual Marker Customization</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>Idle Driver Icon</label>
                <select 
                  value={settings.idle_driver_icon}
                  onChange={e => handleUpdate({ idle_driver_icon: e.target.value })}
                  style={{ ...inputStyle, width: '100%', height: 44, cursor: 'pointer' }}
                >
                  <option value="Standard Car (Green)">Standard Car (Green)</option>
                  <option value="SUV (Blue)">SUV (Blue)</option>
                  <option value="Van (Orange)">Van (Orange)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>Cluster Threshold</label>
                <select 
                  value={settings.cluster_threshold_zoom}
                  onChange={e => handleUpdate({ cluster_threshold_zoom: parseInt(e.target.value) })}
                  style={{ ...inputStyle, width: '100%', height: 44, cursor: 'pointer' }}
                >
                  <option value={12}>Zoom Level 12</option>
                  <option value={14}>Zoom Level 14</option>
                  <option value={16}>Zoom Level 16</option>
                </select>
              </div>
            </div>
          </div>
        </section>

      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button 
          onClick={handleSave} 
          disabled={saving} 
          style={{ background: T.accent, color: T.textWhite, padding: '10px 24px', borderRadius: 0, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
          Save Configuration
        </button>
      </div>

    </div>
  )
}

function NotificationSettingsSection() {
  return (
    <SettingsCard title="Alerts & Notifications" subtitle="Managed via the Notifications tab.">
      <div style={s.emptyCard}>Navigate to the Notifications tab above.</div>
    </SettingsCard>
  )
}

function SystemRulesReplica() {
  const { mode } = useCampusThemeStore()

  const panelStyle = {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 0,
    padding: 24,
    display: 'flex',
    flexDirection: 'column' as const,
  }

  return (
    <div style={{ width: '100%', margin: 0, display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div className="gis-grid">
        {/* Ride Logic */}
        <section style={{ ...panelStyle, gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.accent }}>
              <Route size={18} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Ride Logic</h3>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, animation: 'pulse 2s infinite' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ background: T.bgCard, padding: 12, border: `1px solid ${T.borderLight}`, borderRadius: 0 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>Matching Radius</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" defaultValue={1.5} style={{ width: 80, background: 'transparent', color: T.textPrimary, border: 'none', borderRadius: 0, padding: '4px 8px', fontSize: 13, textAlign: 'right' }} />
                <span style={{ fontSize: 12, color: T.textSecondary }}>Kilometers</span>
              </div>
              <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>Maximum distance to ping drivers.</p>
            </div>
            <div style={{ background: T.bgCard, padding: 12, border: `1px solid ${T.borderLight}`, borderRadius: 0 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>Driver Cooldown</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" defaultValue={45} style={{ width: 80, background: 'transparent', color: T.textPrimary, border: 'none', borderRadius: 0, padding: '4px 8px', fontSize: 13, textAlign: 'right' }} />
                <span style={{ fontSize: 12, color: T.textSecondary }}>Seconds</span>
              </div>
              <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>Penalty duration after rejecting a ride.</p>
            </div>
            <div style={{ background: T.bgCard, padding: 16, border: `1px solid ${T.borderLight}`, borderRadius: 0, gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }}>Cancellation Window</label>
                <p style={{ fontSize: 12, color: T.textPrimary }}>Grace period before applying cancellation fees.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" defaultValue={120} style={{ width: 80, background: 'transparent', color: T.textPrimary, border: 'none', borderRadius: 0, padding: '8px 12px', fontSize: 16, textAlign: 'right' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: T.textSecondary }}>Sec</span>
              </div>
            </div>
          </div>
        </section>

        {/* Operation Hours */}
        <section style={{ ...panelStyle, gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FB9129', borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 16, marginBottom: 20 }}>
            <Clock size={18} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Operation & Peak</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: T.bgCard, borderRadius: 0 }}>
              <span style={{ fontSize: 13, color: T.textPrimary }}>Service Hours</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, background: 'transparent', padding: '2px 6px', borderRadius: 0, color: T.textPrimary }}>06:00</span>
                <span style={{ color: T.textSecondary }}>-</span>
                <span style={{ fontSize: 11, background: 'transparent', padding: '2px 6px', borderRadius: 0, color: T.textPrimary }}>23:00</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: T.bgCard, borderRadius: 0, borderLeft: '4px solid #ef4444' }}>
              <div>
                <span style={{ fontSize: 13, color: T.textPrimary, display: 'block' }}>Curfew Lockout</span>
                <span style={{ fontSize: 10, color: T.textSecondary }}>System auto-suspends requests</span>
              </div>
              <input type="checkbox" defaultChecked style={{ width: 40, height: 20 }} />
            </div>
            <div style={{ paddingTop: 8 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>Peak Surge Multiplier</label>
              <div style={{ width: '100%', height: 8, background: 'transparent', borderRadius: 0, marginBottom: 4 }}>
                <div style={{ width: '45%', height: '100%', background: '#FB9129', borderRadius: 0 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textSecondary }}>
                <span>1.0x (Base)</span>
                <span style={{ color: '#FB9129', fontWeight: 700 }}>1.45x (Current)</span>
                <span>3.0x (Max)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Student Eligibility */}
        <section style={{ ...panelStyle, gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 16, marginBottom: 16 }}>
            <GraduationCap size={18} color={T.textPrimary} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Student Eligibility</h3>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, background: T.bgCard, padding: 12, borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IdCard size={20} color={T.accent} />
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase' }}>ID Verification</p>
                  <p style={{ fontSize: 13, color: T.textPrimary }}>Strict Matching</p>
                </div>
              </div>
              <Settings size={16} color={T.textMuted} style={{ cursor: 'pointer' }} />
            </div>
            <div style={{ flex: 1, background: T.bgCard, padding: 12, borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(118,118,118,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ban size={20} color={T.textSecondary} />
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase' }}>Level Restrictions</p>
                  <p style={{ fontSize: 13, color: T.textPrimary }}>None</p>
                </div>
              </div>
              <Settings size={16} color={T.textMuted} style={{ cursor: 'pointer' }} />
            </div>
          </div>
        </section>

        {/* Safety Protocols */}
        <section style={{ ...panelStyle, gridColumn: 'span 4', gridRow: 'span 2', borderTop: '2px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 16, marginBottom: 20 }}>
            <AlertTriangle size={18} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Safety Protocols</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
            <div style={{ background: T.bgCard, padding: 12, borderRadius: 0, border: '1px solid rgba(239,68,68,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>SOS Triggers</span>
                <AlertTriangle size={16} color="#ef4444" />
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: T.textSecondary }}>
                  <CheckCircle size={14} color={T.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                  Deviation from route &gt; 500m
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: T.textSecondary }}>
                  <CheckCircle size={14} color={T.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                  Stationary &gt; 10 mins during active ride
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: T.textSecondary }}>
                  <CheckCircle size={14} color={T.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                  Manual panic button (Instant Security Dispatch)
                </li>
              </ul>
            </div>
            
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>Campus Speed Limit Alert</label>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <input type="number" defaultValue={45} style={{ width: '100%', background: 'transparent', color: '#ef4444', fontWeight: 800, fontSize: 24, border: 'none', borderRadius: 0, padding: '8px 12px', textAlign: 'center' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: T.textSecondary, marginBottom: 8 }}>km/h</span>
              </div>
              <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>Triggers warning to driver; 3 strikes = temp suspension.</p>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `1px solid ${T.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 13, color: T.textPrimary, display: 'block' }}>Night-Time Ride Sharing</span>
                <span style={{ fontSize: 10, color: T.textSecondary }}>Force pooling after 20:00</span>
              </div>
              <input type="checkbox" defaultChecked style={{ width: 40, height: 20 }} />
            </div>
          </div>
        </section>

        {/* Driver Compliance */}
        <section style={{ ...panelStyle, gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 16, marginBottom: 16 }}>
            <UserCheck size={18} color={T.textPrimary} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Driver Compliance & Queue</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ background: T.bgCard, padding: 12, borderRadius: 0 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>Min Rating</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Star size={20} color="#FFC107" fill="#FFC107" />
                <span style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary }}>4.2</span>
              </div>
              <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>Below this = Auto-suspension</p>
            </div>
            <div style={{ background: T.bgCard, padding: 12, borderRadius: 0 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>Doc Expiry Buffer</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary }}>14</span>
                <span style={{ fontSize: 12, color: T.textSecondary }}>Days</span>
              </div>
              <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>Warning period before lock.</p>
            </div>
            <div style={{ background: T.bgCard, padding: 12, borderRadius: 0, border: `1px solid ${T.borderLight}` }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>Queue Mode</label>
              <select style={{ width: '100%', background: 'transparent', color: T.textPrimary, border: 'none', borderRadius: 0, padding: 8, fontSize: 12 }}>
                <option>FIFO</option>
                <option selected>Proximity Priority</option>
                <option>Rating Weighted</option>
              </select>
              <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>Algorithm for hub dispatches.</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}

// Operational removed — no distinct settings domain to build here


function PromotionsReplica() {
  const { mode } = useCampusThemeStore()

  const panelStyle = {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 0,
    padding: 24,
    display: 'flex',
    flexDirection: 'column' as const,
  }

  return (
    <div style={{ width: '100%', margin: 0, display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div className="gis-grid">
        {/* Active ROI */}
        <section style={{ ...panelStyle, gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Active ROI</h3>
            <TrendingUp size={18} color={T.accent} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 12 }}>
              <span style={{ fontSize: 13, color: T.textSecondary }}>Coupon Conversion</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>24.8%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 12 }}>
              <span style={{ fontSize: 13, color: T.textSecondary }}>Referral Signups</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#FB9129' }}>1,240</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8 }}>
              <span style={{ fontSize: 13, color: T.textSecondary }}>Est. Revenue Lift</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>₦4.2M</span>
            </div>
          </div>
        </section>

        {/* Promo Code Generator */}
        <section style={{ ...panelStyle, gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Ticket size={18} color={T.textMuted} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Promo Code Generator</h3>
            </div>
            <button style={{ background: 'none', border: 'none', color: T.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View All</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Code Name</label>
              <input type="text" placeholder="e.g. WELCOME24" style={{ background: 'transparent', border: 'none', padding: '10px 12px', borderRadius: 0, color: T.textPrimary, fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Discount Value</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, fontSize: 13 }}>₦</span>
                <input type="number" placeholder="500" style={{ width: '100%', background: 'transparent', border: 'none', padding: '10px 12px 10px 28px', borderRadius: 0, color: T.textPrimary, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Usage Limit</label>
              <input type="number" placeholder="1000" style={{ background: 'transparent', border: 'none', padding: '10px 12px', borderRadius: 0, color: T.textPrimary, fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Expiry Date</label>
              <input type="date" style={{ background: 'transparent', border: 'none', padding: '10px 12px', borderRadius: 0, color: T.textPrimary, fontSize: 13, fontFamily: 'inherit' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={{ background: T.textPrimary, color: T.bg, border: 'none', padding: '10px 24px', borderRadius: 0, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Generate Code</button>
          </div>
        </section>

        {/* Loyalty Tiers */}
        <section style={{ ...panelStyle, gridColumn: 'span 6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Star size={18} color="#FB9129" />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Loyalty Tiers</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Bronze */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Medal size={20} color={T.textMuted} />
                </div>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Campus Explorer</h4>
                  <p style={{ fontSize: 12, color: T.textSecondary }}>0 - 500 XP</p>
                </div>
              </div>
              <span style={{ background: 'transparent', color: T.textPrimary, fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 999 }}>Base Rates</span>
            </div>
            {/* Silver */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 0, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: T.textMuted }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(118,118,118,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Medal size={20} color={T.textMuted} />
                </div>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Frequent Rider</h4>
                  <p style={{ fontSize: 12, color: T.textSecondary }}>501 - 2000 XP</p>
                </div>
              </div>
              <span style={{ background: 'rgba(118,118,118,0.1)', color: T.textPrimary, fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 999 }}>5% Off</span>
            </div>
            {/* Gold */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: T.bgCard, border: `1px solid ${T.accent}`, borderRadius: 0, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: T.accent }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Medal size={20} color={T.accent} />
                </div>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Campus Legend</h4>
                  <p style={{ fontSize: 12, color: T.textSecondary }}>2001+ XP</p>
                </div>
              </div>
              <span style={{ background: 'rgba(16,185,129,0.1)', color: T.accent, fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 999 }}>10% Off + Priority</span>
            </div>
          </div>
        </section>

        {/* Referral Rules */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 32, gridColumn: 'span 6' }}>
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Referral Rules</h3>
              <input type="checkbox" defaultChecked style={{ width: 40, height: 20 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: 'transparent', padding: 16, borderRadius: 0 }}>
                <p style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Referrer Gets</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>₦500</p>
              </div>
              <div style={{ background: 'transparent', padding: 16, borderRadius: 0 }}>
                <p style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>New User Gets</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>₦200 + First Ride Free</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, color: '#ef4444', fontSize: 12 }}>
              <Shield size={14} /> Fraud detection active (Device ID + IP check)
            </div>
          </div>

          <div style={panelStyle}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 16 }}>Active Targeted Campaigns</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderRadius: 0, cursor: 'pointer', background: T.bgCardHover }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent }} />
                  <span style={{ fontSize: 13, color: T.textPrimary }}>Exam Week Night Owls</span>
                </div>
                <span style={{ fontSize: 11, color: T.textMuted }}>Edit</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderRadius: 0, cursor: 'pointer', background: T.bgCardHover }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FB9129' }} />
                  <span style={{ fontSize: 13, color: T.textPrimary }}>Dorm A to Main Gate Morning</span>
                </div>
                <span style={{ fontSize: 11, color: T.textMuted }}>Edit</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderRadius: 0, cursor: 'pointer', background: T.bgCardHover }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.textSecondary }} />
                  <span style={{ fontSize: 13, color: T.textPrimary }}>Inactive Users (&gt;14 days)</span>
                </div>
                <span style={{ fontSize: 11, color: T.textMuted }}>Edit</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}

function IntegrationsReplica() {
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [statusData, setStatusData] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<any>(null)
  const [testing, setTesting] = useState(false)
  const [savingPrimary, setSavingPrimary] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [savingRouting, setSavingRouting] = useState(false)

  // Fetch live data on mount
  const loadData = async () => {
    setLoadingData(true)
    try {
      const [summaryRes, statusRes, configRes] = await Promise.all([
        api.get('/payments/gateways/summary/'),
        api.get('/auth/settings/integrations/status/'),
        api.get('/auth/settings/integrations/config/'),
      ])
      setSummary(summaryRes.data)
      setStatusData(statusRes.data)
      setConfig(configRes.data)
    } catch (err) {
      console.error('Failed to load integration data', err)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const primaryGateway = config?.payments_primary_gateway || 'paystack'

  const gwSummary = (gw: string) => summary?.gateways?.[gw] || {}
  const gwStatus = (gw: string) => statusData?.payments?.[gw] || {}

  const getGwColor = (gw: string) =>
    gw === 'paystack' ? '#0BA4DB' : gw === 'flutterwave' ? '#FB9129' : '#635BFF'

  const getGwLabel = (gw: string) =>
    gw === 'paystack' ? 'P' : gw === 'flutterwave' ? 'F' : 'S'

  const getGwStatus = (gw: string) => {
    if (gw === 'stripe') return 'Inactive'
    return primaryGateway === gw ? 'Active' : 'Standby'
  }

  const formatRevenue = (val: string | undefined) => {
    if (!val) return '₦0'
    const n = parseFloat(val)
    return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const handleTestConnection = async () => {
    if (!selectedGateway || selectedGateway === 'stripe') return
    setTesting(true)
    setTestResult(null)
    setActionMsg(null)
    try {
      const res = await api.post('/payments/gateways/test/', { gateway: selectedGateway })
      setTestResult(res.data)
    } catch (err: any) {
      const errorObj = err.response?.data?.error;
      const errorMsg = typeof errorObj === 'string' ? errorObj : errorObj?.message || 'Test failed.';
      setTestResult({ success: false, error: errorMsg })
    } finally {
      setTesting(false)
    }
  }

  const handleSetPrimary = async () => {
    if (!selectedGateway || selectedGateway === 'stripe') return
    setSavingPrimary(true)
    setActionMsg(null)
    const newPrimary = primaryGateway === selectedGateway ? 'flutterwave' : selectedGateway
    try {
      await api.patch('/auth/settings/integrations/config/', {
        payments_primary_gateway: newPrimary,
      })
      await loadData()
      setActionMsg({ text: `${newPrimary.charAt(0).toUpperCase() + newPrimary.slice(1)} is now the primary gateway.`, ok: true })
    } catch (err: any) {
      setActionMsg({ text: err.response?.data?.error?.message || 'Failed to update gateway.', ok: false })
    } finally {
      setSavingPrimary(false)
    }
  }

  const handleSetRoutingProvider = async (provider: string) => {
    if (savingRouting) return
    setSavingRouting(true)
    try {
      await api.patch('/auth/settings/integrations/config/', {
        routing_provider: provider,
      })
      await loadData()
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update routing provider.')
    } finally {
      setSavingRouting(false)
    }
  }

  const panelStyle = {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 0,
    padding: 24,
    display: 'flex',
    flexDirection: 'column' as const,
  }

  const gateways = ['paystack', 'flutterwave', 'stripe']

  // Drawer: show selected gateway details
  const drawerGw = selectedGateway
  const drawerStatus = drawerGw ? gwStatus(drawerGw) : {}
  const drawerSummary = drawerGw ? gwSummary(drawerGw) : {}
  const isPrimary = drawerGw === primaryGateway
  const isConfigured = drawerStatus.configured ?? false
  const publicKey = drawerStatus.public_key || '—'
  const secretKey = drawerStatus.secret_key || '—'
  const revealKey = `${drawerGw}-secret`
  const publicRevealKey = `${drawerGw}-public`

  return (
    <div style={{ width: '100%', margin: 0, display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div className="gis-grid">
        {/* Payment Gateways */}
        <section style={{ ...panelStyle, gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.border}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wallet size={18} style={{ color: T.textMuted }} />
              Payment Gateways
            </h3>
            <span style={{ background: `${T.accent}1a`, color: T.accent, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: `1px solid ${T.accent}4d`, textTransform: 'capitalize' }}>
              {loadingData ? 'Loading…' : `Active: ${primaryGateway}`}
            </span>
          </div>

          {loadingData ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.textMuted, fontSize: 13 }}>
              <Loader2 size={16} className="spin" /> Loading live data…
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {gateways.map(gw => {
                const gwS = gwSummary(gw)
                const gwSt = gwStatus(gw)
                const color = getGwColor(gw)
                const label = getGwLabel(gw)
                const gwStatusLabel = getGwStatus(gw)
                const isActive = gwStatusLabel === 'Active'
                const isInactive = gwStatusLabel === 'Inactive'
                const dotColor = isActive ? T.accent : isInactive ? T.textMuted : T.textSecondary
                const dotLabel = isActive ? 'Active' : isInactive ? 'Inactive' : 'Standby'
                const configured = gwSt.configured ?? false
                return (
                  <div
                    key={gw}
                    onClick={() => setSelectedGateway(gw)}
                    style={{
                      border: isActive ? `2px solid ${T.accent}` : `1px solid ${T.borderLight}`,
                      background: isActive ? `${T.accent}0d` : T.bgCard,
                      borderRadius: 0, padding: 16, cursor: 'pointer', position: 'relative',
                      opacity: isInactive ? 0.6 : 1, transition: 'box-shadow 0.15s',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />
                      <span style={{ fontSize: 10, color: dotColor, fontWeight: 700, textTransform: 'uppercase' }}>{dotLabel}</span>
                    </div>
                    <div style={{ width: 32, height: 32, borderRadius: 0, background: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{label}</div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 4, textTransform: 'capitalize' }}>{gw}</h4>
                    <p style={{ fontSize: 12, color: T.textSecondary }}>
                      {configured ? (gw === 'paystack' ? 'Primary NGN Processor.' : gw === 'flutterwave' ? 'Failover Processor.' : 'International Cards.') : 'Keys not configured.'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: `1px solid ${T.borderLight}`, paddingTop: 12, marginTop: 12 }}>
                      <div>
                        {isInactive ? (
                          <><p style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Status</p><p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>Needs Setup</p></>
                        ) : (
                          <><p style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Success Rate</p><p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{gwS.success_rate !== undefined ? `${gwS.success_rate}%` : '—'}</p></>
                        )}
                      </div>
                      <ArrowRight size={16} color={T.textMuted} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Side Drawer */}
          {selectedGateway && (
            <div
              style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}
              onClick={() => { setSelectedGateway(null); setTestResult(null); setActionMsg(null) }}
            >
              <div
                style={{ width: 420, height: '100%', backgroundColor: T.bgPanel, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.25)', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Drawer Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: `1px solid ${T.borderLight}`, position: 'sticky', top: 0, background: T.bgPanel, zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 0, background: `${getGwColor(selectedGateway)}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: getGwColor(selectedGateway), fontWeight: 800, fontSize: 16 }}>
                      {getGwLabel(selectedGateway)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, textTransform: 'capitalize' }}>{selectedGateway}</h2>
                        {isConfigured ? (
                          <span style={{ fontSize: 10, background: `${T.accent}1a`, color: T.accent, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Ready</span>
                        ) : (
                          <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Not Configured</span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: isPrimary ? T.accent : T.textMuted, marginTop: 2 }}>{isPrimary ? '● Primary Gateway' : '○ Standby'}</p>
                    </div>
                  </div>
                  <X size={22} color={T.textMuted} style={{ cursor: 'pointer' }} onClick={() => { setSelectedGateway(null); setTestResult(null); setActionMsg(null) }} />
                </div>

                <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

                  {/* API Keys */}
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>API Keys</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Public Key */}
                      <div>
                        <label style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Public Key</label>
                        <div style={{ background: T.bgCard, padding: '10px 12px', border: `1px solid ${T.borderLight}`, marginTop: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: T.textPrimary, fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>
                            {revealedKeys[publicRevealKey] ? publicKey : publicKey.replace(/(?<=.{6}).(?=.{4})/g, '*')}
                          </span>
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <button
                              onClick={() => setRevealedKeys(prev => ({ ...prev, [publicRevealKey]: !prev[publicRevealKey] }))}
                              style={{ background: 'none', border: 'none', color: T.accent, fontSize: 11, cursor: 'pointer', fontWeight: 600, padding: '2px 4px' }}
                            >{revealedKeys[publicRevealKey] ? 'Hide' : 'Reveal'}</button>
                            <button
                              onClick={() => handleCopy(publicKey, publicRevealKey)}
                              style={{ background: 'none', border: 'none', color: copied === publicRevealKey ? T.accent : T.textMuted, cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                              title="Copy to clipboard"
                            >
                              {copied === publicRevealKey ? <CheckCircle size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* Secret Key — masked by API; never shown or copied in UI */}
                      <div>
                        <label style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Secret Key</label>
                        <div style={{ background: T.bgCard, padding: '10px 12px', border: `1px solid ${T.borderLight}`, marginTop: 5 }}>
                          <span style={{ fontSize: 12, color: T.textSecondary, fontFamily: 'monospace' }}>
                            {secretKey && secretKey !== '—' ? secretKey : 'Not configured — set in server environment'}
                          </span>
                          <p style={{ fontSize: 11, color: T.textMuted, margin: '8px 0 0' }}>
                            Full secrets are managed in Render/env only, not in the admin panel.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Performance Metrics (Today)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: T.bgCard, padding: 14, border: `1px solid ${T.borderLight}` }}>
                        <span style={{ fontSize: 11, color: T.textMuted, display: 'block', marginBottom: 6 }}>Success Rate</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary }}>
                          {drawerSummary.success_rate !== undefined ? `${drawerSummary.success_rate}%` : '—'}
                        </span>
                      </div>
                      <div style={{ background: T.bgCard, padding: 14, border: `1px solid ${T.borderLight}` }}>
                        <span style={{ fontSize: 11, color: T.textMuted, display: 'block', marginBottom: 6 }}>Transactions</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary }}>
                          {drawerSummary.attempts !== undefined ? drawerSummary.attempts : '—'}
                        </span>
                      </div>
                      <div style={{ background: T.bgCard, padding: 14, border: `1px solid ${T.borderLight}` }}>
                        <span style={{ fontSize: 11, color: T.textMuted, display: 'block', marginBottom: 6 }}>Successful</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: T.accent }}>
                          {drawerSummary.success !== undefined ? drawerSummary.success : '—'}
                        </span>
                      </div>
                      <div style={{ background: T.bgCard, padding: 14, border: `1px solid ${T.borderLight}` }}>
                        <span style={{ fontSize: 11, color: T.textMuted, display: 'block', marginBottom: 6 }}>Failed</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: drawerSummary.failed > 0 ? '#ef4444' : T.textPrimary }}>
                          {drawerSummary.failed !== undefined ? drawerSummary.failed : '—'}
                        </span>
                      </div>
                      <div style={{ background: T.bgCard, padding: 14, border: `1px solid ${T.borderLight}`, gridColumn: 'span 2' }}>
                        <span style={{ fontSize: 11, color: T.textMuted, display: 'block', marginBottom: 6 }}>Revenue Today</span>
                        <span style={{ fontSize: 22, fontWeight: 800, color: T.textPrimary }}>
                          {drawerSummary.revenue_today !== undefined ? formatRevenue(drawerSummary.revenue_today) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Test Connection Result */}
                  {testResult && (
                    <div style={{ padding: 14, background: testResult.success ? `${T.accent}0d` : 'rgba(239,68,68,0.07)', border: `1px solid ${testResult.success ? T.accent + '44' : 'rgba(239,68,68,0.3)'}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {testResult.success ? <CheckCircle size={16} color={T.accent} /> : <AlertCircle size={16} color="#ef4444" />}
                        <span style={{ fontSize: 13, fontWeight: 700, color: testResult.success ? T.accent : '#ef4444' }}>
                          {testResult.success ? testResult.message : testResult.error}
                        </span>
                      </div>
                      {testResult.latency_ms !== undefined && (
                        <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 24 }}>Latency: {testResult.latency_ms}ms · HTTP {testResult.http_status}</span>
                      )}
                    </div>
                  )}

                  {/* Action Message */}
                  {actionMsg && (
                    <div style={{ padding: 12, background: actionMsg.ok ? `${T.accent}0d` : 'rgba(239,68,68,0.07)', border: `1px solid ${actionMsg.ok ? T.accent + '33' : 'rgba(239,68,68,0.3)'}`, fontSize: 13, color: actionMsg.ok ? T.accent : '#ef4444' }}>
                      {actionMsg.text}
                    </div>
                  )}

                  {/* Actions */}
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Test Connection */}
                      {selectedGateway !== 'stripe' && (
                        <button
                          onClick={handleTestConnection}
                          disabled={testing}
                          style={{ padding: '12px 16px', background: `${T.accent}1a`, color: T.accent, border: `1px solid ${T.accent}33`, fontWeight: 700, fontSize: 13, cursor: testing ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, opacity: testing ? 0.7 : 1 }}
                        >
                          {testing ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
                          {testing ? 'Testing…' : 'Test Connection'}
                        </button>
                      )}
                      {/* Make Primary / Standby */}
                      {selectedGateway !== 'stripe' && (
                        <button
                          onClick={handleSetPrimary}
                          disabled={savingPrimary}
                          style={{ padding: '12px 16px', background: T.bgCard, color: T.textPrimary, border: `1px solid ${T.borderLight}`, fontWeight: 700, fontSize: 13, cursor: savingPrimary ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, opacity: savingPrimary ? 0.7 : 1 }}
                        >
                          {savingPrimary ? <Loader2 size={14} className="spin" /> : <Signal size={14} />}
                          {savingPrimary ? 'Saving…' : isPrimary ? 'Set Flutterwave as Primary' : 'Make Primary Gateway'}
                        </button>
                      )}
                      {selectedGateway === 'stripe' && (
                        <div style={{ padding: 14, background: T.bgCard, border: `1px solid ${T.borderLight}`, fontSize: 12, color: T.textMuted, textAlign: 'center' }}>
                          Stripe configuration requires server-side environment variables. Contact your DevOps team.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </section>

        {/* Wallet API */}
        <section style={{ ...panelStyle, gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.border}` }}>
            <Activity size={18} style={{ color: T.textMuted }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Wallet API</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bgCard, padding: 12, border: `1px solid ${T.borderLight}`, borderRadius: 0 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Ledger Reconciliation</p>
                <p style={{ fontSize: 12, color: T.textSecondary }}>Auto-sync daily at 00:00</p>
              </div>
              <input type="checkbox" defaultChecked style={{ width: 40, height: 20 }} />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bgCard, padding: 12, border: `1px solid ${T.borderLight}`, borderRadius: 0 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Webhook Endpoints</p>
                <p style={{ fontSize: 12, color: T.textSecondary }}>
                  {loadingData ? '…' : `${statusData?.payments?.paystack?.configured ? 1 : 0} + ${statusData?.payments?.flutterwave?.configured ? 1 : 0} Active Listeners`}
                </p>
              </div>
              <button style={{ background: 'none', border: 'none', color: T.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Manage</button>
            </div>
          </div>

          <button style={{ marginTop: 24, width: '100%', padding: '10px', background: T.bgCardHover, border: `1px solid ${T.borderLight}`, color: T.textPrimary, fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 0 }}>
            View API Keys
          </button>
        </section>

        {/* Maps & Environment */}
        <section style={{ ...panelStyle, gridColumn: 'span 4', gridRow: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.border}` }}>
            <Map size={18} style={{ color: T.textMuted }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Maps & Environment</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Google Maps API */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color="#4285F4" /> Google Maps Platform
                </h4>
                {config?.routing_provider === 'google' ? (
                  <span style={{ fontSize: 10, padding: '2px 6px', background: `${T.accent}1a`, color: T.accent, borderRadius: 4, fontWeight: 700 }}>Active</span>
                ) : (
                  <span style={{ fontSize: 10, padding: '2px 6px', background: 'transparent', color: T.textSecondary, borderRadius: 0 }}>
                    {loadingData ? '…' : statusData?.routing?.providers?.google?.available ? 'Configured' : 'Not Configured'}
                  </span>
                )}
              </div>
              <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, padding: 12, borderRadius: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: T.textSecondary }}>API Key</span>
                  {statusData?.routing?.providers?.google?.available && (
                    <Copy size={12} color={T.textMuted} style={{ cursor: 'pointer' }} onClick={() => handleCopy(statusData.routing.providers.google.api_key, 'google_maps')} />
                  )}
                </div>
                <div style={{ background: 'transparent', padding: '4px 8px', fontSize: 11, fontFamily: 'monospace', color: T.textPrimary, marginBottom: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {loadingData ? '…' : statusData?.routing?.providers?.google?.available ? (copied === 'google_maps' ? 'Copied!' : statusData.routing.providers.google.api_key) : 'Not set'}
                </div>
                {!loadingData && statusData?.routing?.providers?.google?.available && config?.routing_provider !== 'google' && (
                  <button 
                    onClick={() => handleSetRoutingProvider('google')}
                    disabled={savingRouting}
                    style={{ width: '100%', padding: '6px 12px', background: 'transparent', border: `1px solid ${T.border}`, color: T.textPrimary, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {savingRouting ? 'Saving...' : 'Set as Active'}
                  </button>
                )}
              </div>
            </div>

            {/* OSRM */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Route size={14} color="#EB6E4B" /> OSRM (Open Routing)
                </h4>
                {config?.routing_provider === 'osrm' ? (
                  <span style={{ fontSize: 10, padding: '2px 6px', background: `${T.accent}1a`, color: T.accent, borderRadius: 4, fontWeight: 700 }}>Active</span>
                ) : (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: loadingData ? T.textMuted : statusData?.routing?.providers?.osrm?.available ? T.accent : T.textMuted }} />
                )}
              </div>
              <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, padding: 12, borderRadius: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: T.textSecondary }}>Base URL</span>
                  {statusData?.routing?.providers?.osrm?.available && (
                    <Copy size={12} color={T.textMuted} style={{ cursor: 'pointer' }} onClick={() => handleCopy(statusData.routing.providers.osrm.base_url, 'osrm')} />
                  )}
                </div>
                <div style={{ background: 'transparent', padding: '4px 8px', fontSize: 11, fontFamily: 'monospace', color: T.textPrimary, marginBottom: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {loadingData ? '…' : statusData?.routing?.providers?.osrm?.available ? (copied === 'osrm' ? 'Copied!' : statusData.routing.providers.osrm.base_url) : 'Not configured'}
                </div>
                {!loadingData && statusData?.routing?.providers?.osrm?.available && config?.routing_provider !== 'osrm' && (
                  <button 
                    onClick={() => handleSetRoutingProvider('osrm')}
                    disabled={savingRouting}
                    style={{ width: '100%', padding: '6px 12px', background: 'transparent', border: `1px solid ${T.border}`, color: T.textPrimary, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {savingRouting ? 'Saving...' : 'Set as Active'}
                  </button>
                )}
              </div>
            </div>

            {/* Haversine Fallback */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Globe size={14} color={T.textMuted} /> Haversine Fallback
                </h4>
                {config?.routing_provider === 'haversine' && (
                  <span style={{ fontSize: 10, padding: '2px 6px', background: `${T.accent}1a`, color: T.accent, borderRadius: 4, fontWeight: 700 }}>Active</span>
                )}
              </div>
              <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, padding: 12, borderRadius: 0 }}>
                <p style={{ fontSize: 11, color: T.textSecondary, marginBottom: config?.routing_provider !== 'haversine' ? 12 : 0 }}>
                  Basic straight-line distance calculation. Requires no API keys.
                </p>
                {!loadingData && config?.routing_provider !== 'haversine' && (
                  <button 
                    onClick={() => handleSetRoutingProvider('haversine')}
                    disabled={savingRouting}
                    style={{ width: '100%', padding: '6px 12px', background: 'transparent', border: `1px solid ${T.border}`, color: T.textPrimary, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {savingRouting ? 'Saving...' : 'Set as Active'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Analytics */}
        <section style={{ ...panelStyle, gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.border}` }}>
            <BarChart2 size={18} style={{ color: T.textMuted }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Analytics</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Segment CDP', color: '#49B882', l: 'S' },
              { label: 'Mixpanel', color: '#7856FF', l: 'M' },
              { label: 'Amplitude', color: '#205CBA', l: 'A', paused: true },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 0, cursor: 'pointer', opacity: item.paused ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 24, height: 24, background: `${item.color}1a`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, borderRadius: 0 }}>{item.l}</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{item.label}</span>
                </div>
                {item.paused ? <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: T.textMuted }}>Paused</span> : <Settings size={16} color={T.textMuted} />}
              </div>
            ))}
          </div>
        </section>

        {/* Cloud & SSO Container */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 32, gridColumn: 'span 4' }}>
          
          <div style={panelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Key size={16} color={T.accent} /> Auth Providers
              </h3>
              <Plus size={16} color={T.accent} style={{ cursor: 'pointer' }} />
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { l: 'G', label: 'Google', key: 'auth_google_enabled' },
                { l: 'M', label: 'Microsoft', key: null },
                { l: 'O', label: 'Other', key: null, disabled: true },
              ].map(auth => (
                <div key={auth.l} style={{ flex: 1, background: T.bgCard, border: `1px solid ${(auth.key && config?.[auth.key]) ? T.accent : T.borderLight}`, padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', borderRadius: 0, opacity: auth.disabled ? 0.4 : 1, gap: 4 }}>
                  <span style={{ fontWeight: 800, color: (auth.key && config?.[auth.key]) ? T.accent : T.textPrimary, fontSize: 14 }}>{auth.l}</span>
                  <span style={{ fontSize: 9, color: T.textMuted }}>{(auth.key && config?.[auth.key]) ? 'On' : 'Off'}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={panelStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Database size={16} color={T.accent} /> Cloud Archive
            </h3>
            
            <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, padding: 12, borderRadius: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: T.textPrimary }}>AWS S3 (eu-west-1)</span>
                <span style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>Connected</span>
              </div>
              <p style={{ fontSize: 11, color: T.textSecondary, fontFamily: 'monospace' }}>bucket: cr-doc-archive-prod</p>
            </div>
          </div>

        </section>

      </div>
    </div>
  )
}


function FeatureFlagsReplica() {
  const panelStyle = {
    background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 0,
    padding: 24, display: 'flex', flexDirection: 'column' as const,
  }
  const flagRow = (label: string, desc: string, on: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16,
      background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 0 }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 11, color: T.textSecondary }}>{desc}</p>
      </div>
      <input type="checkbox" defaultChecked={on} style={{ width: 40, height: 20 }} />
    </div>
  )
  return (
    <div style={{ width: '100%', margin: 0 }}>
      <div className="gis-grid">
        {/* Feature Flags */}
        <section style={{ ...panelStyle, gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <ToggleLeft size={18} color={T.accent} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Feature Flag Management</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {flagRow('Surge Pricing Beta', 'Enable dynamic pricing algorithms.', true)}
            {flagRow('Pool Ride V2', 'New matching logic for shared rides.', false)}
            {flagRow('In-App Chat', 'Direct messaging between driver/student.', true)}
            {flagRow('ETA Predictor', 'ML-powered arrival time estimates.', false)}
            {flagRow('Driver Earnings Dashboard', 'Weekly earnings breakdown for drivers.', true)}
            {flagRow('Campus Zone Heatmap', 'Real-time demand visualisation overlay.', false)}
          </div>
        </section>

        {/* Theme Overrides */}
        <section style={{ ...panelStyle, gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <Palette size={18} color={T.accent} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Theme Overrides</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary }}>Primary Brand Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" defaultValue="#0FA958"
                  style={{ width: 40, height: 40, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
                <input type="text" defaultValue="#0FA958"
                  style={{ flex: 1, background: 'transparent', border: 'none', padding: '10px 12px', borderRadius: 0, color: T.textPrimary, fontSize: 13 }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary }}>App Logo Override URL</label>
              <input type="url" placeholder="https://..." style={{ background: 'transparent', border: 'none', padding: '10px 12px', borderRadius: 0, color: T.textPrimary, fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary }}>Mobile App Version</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, background: T.bgCard, border: `1px solid ${T.borderLight}`, padding: 12, borderRadius: 0 }}>
                  <p style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>iOS</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>v2.4.1</p>
                </div>
                <div style={{ flex: 1, background: T.bgCard, border: `1px solid ${T.borderLight}`, padding: 12, borderRadius: 0 }}>
                  <p style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>Android</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>v2.4.0</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function SupportReplica() {
  const panelStyle = {
    background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 0,
    padding: 24, display: 'flex', flexDirection: 'column' as const,
  }
  return (
    <div style={{ width: '100%', margin: 0 }}>
      <div className="gis-grid">
        {/* Help Desk Integration */}
        <section style={{ ...panelStyle, gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <Headphones size={18} color={T.accent} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Help Desk Integration</h3>
          </div>
          <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 20 }}>Connect your preferred ticketing system to sync data and streamline support operations.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16,
              border: `2px solid ${T.accent}`, background: `${T.accent}0d`, borderRadius: 0, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 40, height: 40, background: 'transparent', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Headphones size={20} color={T.accent} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Zendesk</p>
                  <p style={{ fontSize: 11, color: T.accent }}>Active integration</p>
                </div>
              </div>
              <input type="radio" name="helpdesk" defaultChecked style={{ width: 18, height: 18 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16,
              border: `1px solid ${T.borderLight}`, background: T.bgCard, borderRadius: 0, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 40, height: 40, background: 'transparent', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={20} color={T.textMuted} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Freshdesk</p>
                  <p style={{ fontSize: 11, color: T.textSecondary }}>Not configured</p>
                </div>
              </div>
              <input type="radio" name="helpdesk" style={{ width: 18, height: 18 }} />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={{ background: 'none', border: 'none', color: T.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Manage API Keys</button>
          </div>
        </section>

        {/* System Health */}
        <section style={{ ...panelStyle, gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <Zap size={18} color={T.accent} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>System Health</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: T.textSecondary }}>Avg Response Time</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>12m</span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'transparent', borderRadius: 0 }}>
                <div style={{ width: '25%', height: '100%', background: T.accent, borderRadius: 0 }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: T.textSecondary }}>CSAT Score</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>4.8 / 5</span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'transparent', borderRadius: 0 }}>
                <div style={{ width: '92%', height: '100%', background: T.accent, borderRadius: 0 }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{ width: '100%', padding: '10px', background: T.bgCard, border: `1px solid ${T.borderLight}`, color: T.textPrimary, fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 0, textAlign: 'left' }}>
                📄 Knowledge Base Editor
              </button>
              <button style={{ width: '100%', padding: '10px', background: T.bgCard, border: `1px solid ${T.borderLight}`, color: T.textPrimary, fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 0, textAlign: 'left' }}>
                📊 Manage Surveys
              </button>
            </div>
          </div>
        </section>

        {/* Live Chat Config */}
        <section style={{ ...panelStyle, gridColumn: 'span 6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <MessageSquare size={18} color={T.textMuted} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Live Chat Configuration</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Operating Hours</label>
              <select style={{ background: 'transparent', border: 'none', padding: '10px 12px', borderRadius: 0, color: T.textPrimary, fontSize: 13 }}>
                <option>24/7 Support</option>
                <option>Business Hours (9AM - 5PM)</option>
                <option>Custom Schedule</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Routing Strategy</label>
              <select style={{ background: 'transparent', border: 'none', padding: '10px 12px', borderRadius: 0, color: T.textPrimary, fontSize: 13 }}>
                <option>Round Robin</option>
                <option>Skill-based Routing</option>
                <option>Load Balanced</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Auto-Responder Message (Offline)</label>
            <textarea rows={3} placeholder="Enter message..."
              style={{ background: 'transparent', border: 'none', padding: '10px 12px', borderRadius: 0, color: T.textPrimary, fontSize: 13, resize: 'none' }} />
          </div>
        </section>

        {/* SLA Management */}
        <section style={{ ...panelStyle, gridColumn: 'span 6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Timer size={18} color={T.textMuted} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>SLA Management</h3>
            </div>
            <button style={{ background: 'transparent', border: `1px solid ${T.borderLight}`, color: T.textPrimary, padding: '4px 12px', borderRadius: 0, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Add Rule</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: `1px solid ${T.borderLight}` }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>High Priority Tickets</p>
                <p style={{ fontSize: 11, color: T.textSecondary }}>Response time &lt; 15 mins</p>
              </div>
              <AlertTriangle size={16} color="#ef4444" style={{ cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Standard Queries</p>
                <p style={{ fontSize: 11, color: T.textSecondary }}>Response time &lt; 4 hours</p>
              </div>
              <AlertTriangle size={16} color={T.textMuted} style={{ cursor: 'pointer' }} />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function NotificationsReplica() {
  const [gatewayStatus, setGatewayStatus] = useState<any>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealthReport | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(true)
  const [healthError, setHealthError] = useState<string | null>(null)

  const panelStyle = {
    background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 0,
    padding: 24, display: 'flex', flexDirection: 'column' as const,
  }

  const loadHealth = async (refresh = false) => {
    setLoadingHealth(true)
    setHealthError(null)
    try {
      const [gatewayRes, systemRes] = await Promise.all([
        api.get('/auth/settings/integrations/status/'),
        api.get(`/auth/settings/system-health/${refresh ? '?refresh=1' : ''}`),
      ])
      setGatewayStatus(gatewayRes.data)
      setSystemHealth(systemRes.data)
    } catch (err: any) {
      setHealthError(err.response?.data?.error?.message || 'Unable to load health reports.')
    } finally {
      setLoadingHealth(false)
    }
  }

  useEffect(() => { loadHealth() }, [])

  const notificationStatus = gatewayStatus?.notifications || {}
  const gatewayItems = [
    {
      icon: Smartphone,
      label: 'SMS',
      provider: notificationStatus.sms?.provider || 'termii',
      configured: Boolean(notificationStatus.sms?.configured),
      value: notificationStatus.sms?.configured ? 'Ready' : 'No key',
      desc: 'TERMII_API_KEY from backend .env',
    },
    {
      icon: MailIcon,
      label: 'Email',
      provider: notificationStatus.email?.provider || 'console',
      configured: Boolean(notificationStatus.email?.configured),
      value: notificationStatus.email?.configured ? 'Ready' : 'Console',
      desc: 'Brevo or SMTP delivery route',
    },
    {
      icon: Bell,
      label: 'Push',
      provider: 'FCM / Expo',
      configured: Boolean(notificationStatus.fcm?.configured || notificationStatus.expo?.configured),
      value: notificationStatus.fcm?.configured ? 'FCM' : (notificationStatus.expo?.configured ? 'Expo' : 'No key'),
      desc: 'Mobile push notification provider',
    },
  ]
  const configuredGatewayCount = gatewayItems.filter(item => item.configured).length
  const gatewayHealthStatus: SystemHealthStatus = healthError && !gatewayStatus
    ? 'unavailable'
    : configuredGatewayCount === gatewayItems.length
      ? 'operational'
      : configuredGatewayCount > 0
        ? 'degraded'
        : 'unconfigured'
  const overallStatus: SystemHealthStatus = loadingHealth
    ? 'pending'
    : (systemHealth?.overall?.status || (healthError ? 'unavailable' : 'unconfigured'))

  return (
    <div style={{ width: '100%', margin: 0 }}>
      {healthError && <StatusBanner msg={healthError} type="error" />}

      <div className="gis-grid">
        {/* Gateway Health */}
        <section style={{ ...panelStyle, gridColumn: 'span 6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Signal size={18} color={T.accent} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Gateway Health</h3>
            </div>
            {loadingHealth && !gatewayStatus ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textMuted, fontSize: 12 }}>
                <Loader2 size={14} className="spin" /> Checking
              </div>
            ) : (
              <HealthStatusPill status={gatewayHealthStatus} label={gatewayHealthStatus === 'operational' ? 'All Channels Ready' : undefined} />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
            {gatewayItems.map(item => {
              const Icon = item.icon
              const tone = statusTone(item.configured ? 'operational' : 'unconfigured')
              return (
                <div key={item.label} style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, padding: 16, borderRadius: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <Icon size={22} color={tone.color} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: tone.color, textTransform: 'uppercase', textAlign: 'right' }}>{item.configured ? 'Configured' : 'Needs Setup'}</span>
                  </div>
                  <p style={{ fontSize: 23, fontWeight: 800, color: T.textPrimary, marginBottom: 4 }}>{item.value}</p>
                  <p style={{ fontSize: 11, color: T.textSecondary, textTransform: 'capitalize', marginBottom: 8 }}>{item.label} via {item.provider}</p>
                  <p style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.4 }}>{item.desc}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* System Health */}
        <section style={{ ...panelStyle, gridColumn: 'span 6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Activity size={18} color={T.accent} />
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, margin: 0 }}>System Health</h3>
                    <span style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>
                      {systemHealth?.generated_at ? `Last checked ${formatHealthDate(systemHealth.generated_at)}` : 'UptimeRobot and cron-job.org reports'}
                    </span>
                  </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <HealthStatusPill status={overallStatus} label={loadingHealth ? 'Checking' : undefined} />
              <button
                type="button"
                onClick={() => loadHealth(true)}
                disabled={loadingHealth}
                title="Refresh health report"
                style={{ width: 30, height: 30, borderRadius: 0, border: `1px solid ${T.borderLight}`, background: T.bgCard, color: T.textPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loadingHealth ? 'wait' : 'pointer', opacity: loadingHealth ? 0.65 : 1 }}
              >
                {loadingHealth ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
              </button>
            </div>
          </div>

          {systemHealth?.overall?.status !== 'unconfigured' && systemHealth?.overall?.summary && systemHealth.overall.summary !== 'All monitored systems are operational.' ? (
            <p style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5, margin: '0 0 16px' }}>
              {systemHealth.overall.summary}
            </p>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <HealthProviderCard title="UptimeRobot" provider={systemHealth?.uptime_robot} kind="uptime" icon={Cloud} />
            <HealthProviderCard title="cron-job.org" provider={systemHealth?.cron_job_org} kind="cron" icon={Timer} />
          </div>
        </section>

        {/* Global Rules */}
        <section style={{ ...panelStyle, gridColumn: 'span 12' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <Settings size={18} color={T.textMuted} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Global Rules</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: 12, background: T.bgCard, borderRadius: 0 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Quiet Hours</p>
                <p style={{ fontSize: 11, color: T.textSecondary }}>Suppress non-critical alerts (10PM-6AM)</p>
              </div>
              <input type="checkbox" defaultChecked style={{ width: 40, height: 20 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: 12, background: T.bgCard, borderRadius: 0 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Failover Routing</p>
                <p style={{ fontSize: 11, color: T.textSecondary }}>SMS fallback on Push failure</p>
              </div>
              <input type="checkbox" defaultChecked style={{ width: 40, height: 20 }} />
            </div>
            <div style={{ padding: 12, background: T.bgCard, borderRadius: 0 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 8, display: 'block' }}>Broadcast Throttling Rate</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${T.borderLight}`, padding: 8, borderRadius: 0, maxWidth: 180 }}>
                <input type="number" defaultValue={1000}
                  style={{ background: 'transparent', border: 'none', color: T.textPrimary, fontSize: 14, width: 80, textAlign: 'center' }} />
                <span style={{ fontSize: 12, color: T.textSecondary }}>msg/min</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function AccessReplica() {
  const panelStyle = {
    background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 0,
    padding: 24, display: 'flex', flexDirection: 'column' as const,
  }
  return (
    <div style={{ width: '100%', margin: 0 }}>
      <div className="gis-grid">
        {/* Profile Rules */}
        <section style={{ ...panelStyle, gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <UserCheck size={18} color={T.accent} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Profile Rules</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 0 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Enforce Multi-Factor Authentication (MFA)</p>
                <p style={{ fontSize: 11, color: T.textSecondary }}>Require all admin accounts to use MFA via authenticator app.</p>
              </div>
              <input type="checkbox" defaultChecked style={{ width: 44, height: 22, accentColor: T.accent }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: T.bgCard, padding: 14, border: `1px solid ${T.borderLight}`, borderRadius: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, display: 'block', marginBottom: 8 }}>Session Timeout (Minutes)</label>
                <input type="number" defaultValue={15} style={{ width: '100%', background: 'transparent', border: 'none', color: T.textPrimary, fontSize: 14, fontWeight: 700, padding: '8px 0', borderRadius: 0, outline: 'none' }} />
              </div>
              <div style={{ background: T.bgCard, padding: 14, border: `1px solid ${T.borderLight}`, borderRadius: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, display: 'block', marginBottom: 8 }}>Default Admin Role</label>
                <select style={{ width: '100%', background: 'transparent', border: 'none', color: T.textPrimary, fontSize: 13, padding: '8px 0', borderRadius: 0, outline: 'none' }}>
                  <option>Viewer</option>
                  <option>Operator</option>
                  <option selected>Super Admin</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Password Policy */}
        <section style={{ ...panelStyle, gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <LockIcon size={18} color={T.textMuted} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Password Policy</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1 }}>
            {[['Min. Length', '12 Chars'], ['Require Special Chars', '✓'], ['Rotation Cycle', '90 Days'], ['History Lock', 'Last 5']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${T.borderLight}` }}>
                <span style={{ fontSize: 13, color: T.textPrimary }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>{v}</span>
              </div>
            ))}
          </div>
          <button style={{ marginTop: 20, width: '100%', background: 'transparent', border: `1px solid ${T.borderLight}`, color: T.textPrimary, padding: '10px', borderRadius: 0, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Edit Policy</button>
        </section>

        {/* Audit Log */}
        <section style={{ ...panelStyle, gridColumn: 'span 8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={18} color={T.textMuted} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Real-Time Audit Log</h3>
            </div>
            <button style={{ background: 'none', border: 'none', color: T.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View Full Log</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {['Timestamp', 'Admin User', 'Action Event', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: T.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { time: '10:42 AM', user: 'B. Okeke', action: 'Modified Pricing Engine (Zone B)', ok: true },
                  { time: '09:15 AM', user: 'SYSTEM', action: 'Automated Backup Initiated', ok: true },
                  { time: '08:03 AM', user: 'Unknown IP', action: 'Failed Login Attempt (MFA)', ok: false },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                    <td style={{ padding: '12px', color: T.textSecondary }}>{row.time}</td>
                    <td style={{ padding: '12px', color: T.textPrimary, fontWeight: 700 }}>{row.user}</td>
                    <td style={{ padding: '12px', color: T.textPrimary }}>{row.action}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: row.ok ? `${T.accent}1a` : 'rgba(239,68,68,0.1)', color: row.ok ? T.accent : '#ef4444', border: `1px solid ${row.ok ? T.accent + '4d' : 'rgba(239,68,68,0.3)'}`, padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                        {row.ok ? 'Success' : 'Blocked'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Access Geofencing */}
        <section style={{ ...panelStyle, gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
            <GlobeIcon size={18} color={T.textMuted} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Access Geofencing</h3>
          </div>
          <div style={{ background: T.bgCard, height: 120, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', border: `1px solid ${T.borderLight}`, borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: T.accent, opacity: 0.08 }} />
            <GlobeIcon size={48} color={T.accent} />
            <div style={{ position: 'absolute', bottom: 8, left: 8, background: T.bgPanel, padding: '2px 8px', borderRadius: 0, fontSize: 10, fontWeight: 700, color: T.accent }}>Lagos, NG Only</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: T.textPrimary }}>Strict IP Binding</span>
            <input type="checkbox" style={{ width: 40, height: 20, accentColor: T.accent }} />
          </div>
          <p style={{ fontSize: 11, color: T.textSecondary, fontStyle: 'italic' }}>Only 3 whitelisted IPs active.</p>
        </section>
      </div>
    </div>
  )
}

function AccountReplica() {
  return (
    <div style={{ width: '100%', margin: 0, height: '100%' }}>
      <div className="gis-grid" style={{ height: '100%' }}>
        <section className="scroll-col" style={{ gridColumn: 'span 4', minWidth: 0, overflowX: 'hidden', background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 0, padding: 24, paddingRight: 24 }}>
          <EmailChangeSectionReplica />
        </section>
        <section className="scroll-col" style={{ gridColumn: 'span 4', minWidth: 0, overflowX: 'hidden', background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 0, padding: 24, paddingRight: 24 }}>
          <PasswordChangeSectionReplica />
        </section>
        <section className="scroll-col" style={{ gridColumn: 'span 4', minWidth: 0, overflowX: 'hidden', background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 0, padding: 24, paddingRight: 24 }}>
          <SettingsRightSidebarReplica />
        </section>
      </div>
    </div>
  )
}

/* ──────────────────────── Main Settings Page ──────────────────── */

export default function SettingsPage() {
  const { activeTab } = useSettingsStore()
  const { mode } = useCampusThemeStore()

  const titles: Record<string, string> = {
    display: 'Map & GIS Preferences',
    notifications: 'Alert Rules',
    system: 'Global Configuration',
    operational: 'Operational Parameters',
    promotion: 'Promotion Management',
    integration: 'External Integrations',
    feature_flag: 'Feature Flags',
    support: 'Support Configurations'
  }
  const subtitles: Record<string, string> = {
    display: 'Customize the visual behavior and map defaults across the application.',
    notifications: 'Configure push, email, and sound alerts for critical campus operations.',
    system: 'Adjust operational boundaries, matchmaking rules, and system-wide constraints.',
    operational: 'Define core business logic, active hours, and driver constraints.',
    promotion: 'Create and manage discount campaigns, referral codes, and rider incentives.',
    integration: 'Connect third-party analytics, payment gateways, and external webhooks.',
    feature_flag: 'Safely test and deploy new application features to specific user segments.',
    support: 'Configure helpdesk ticketing flows, automated responses, and contact methods.'
  }

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .spin { animation: spin 1s linear infinite; }

        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
            transition: background-color 5000s ease-in-out 0s !important;
            -webkit-text-fill-color: var(--theme-textPrimary) !important;
        }

        .settings-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .settings-replica-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 340px;
          gap: 40px;
          height: 100%;
          min-height: 0;
        }

        .scroll-col {
          height: 100%;
          overflow-y: auto;
          min-height: 0;
          padding-right: 12px;
        }
        .scroll-col::-webkit-scrollbar {
          display: none;
        }
        .scroll-col {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .account-main {
          flex: 1;
          width: 100%;
          padding: 4px;
          box-sizing: border-box;
          height: 100%;
          overflow-y: hidden;
        }

        /* If element has both classes, allow vertical scrolling but keep scrollbar hidden */
        .account-main.scroll-col {
          overflow-y: auto;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .account-main.scroll-col::-webkit-scrollbar { display: none; }
        .gis-grid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 2px;
        }

        .gis-grid > section {
          min-width: 0;
          overflow-x: hidden;
        }

        @media (max-width: 1080px) {
          .gis-grid > section {
            grid-column: span 12 !important;
          }
        }

        @media (max-width: 1400px) {
          .settings-replica-grid {
            grid-template-columns: 1fr 1fr;
            height: auto;
          }
          .scroll-col {
            height: auto;
            overflow-y: visible;
            padding-right: 0;
          }
          .account-main {
            overflow-y: auto;
          }
          .settings-right-sidebar {
            grid-column: 1 / -1;
          }
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

          .settings-form-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {activeTab === 'account' ? (
        <main className="account-main" style={{ background: T.bg }}>
          <AccountReplica />
        </main>
      ) : activeTab === 'display' ? (
        <main className="account-main scroll-col" style={{ background: T.bg }}>
          <MapGisSettingsReplica />
        </main>
      ) : activeTab === 'integration' ? (
        <main className="account-main scroll-col" style={{ background: T.bg }}>
          <IntegrationsReplica />
        </main>
      ) : activeTab === 'system' ? (
        <main className="account-main scroll-col" style={{ background: T.bg }}>
          <SystemRulesReplica />
        </main>
      ) : activeTab === 'promotion' ? (
        <main className="account-main scroll-col" style={{ background: T.bg }}>
          <PromotionsReplica />
        </main>
      ) : activeTab === 'feature_flag' ? (
        <main className="account-main scroll-col" style={{ background: T.bg }}>
          <FeatureFlagsReplica />
        </main>
      ) : activeTab === 'support' ? (
        <main className="account-main scroll-col" style={{ background: T.bg }}>
          <SupportReplica />
        </main>
      ) : activeTab === 'notifications' ? (
        <main className="account-main scroll-col" style={{ background: T.bg }}>
          <NotificationsReplica />
        </main>
      ) : activeTab === 'access' ? (
        <main className="account-main scroll-col" style={{ background: T.bg }}>
          <AccessReplica />
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
      {activeTab === 'operational' && <span />}
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
                {activeTab === 'notifications' ? (
                  <SecurityChecklistItem
                    icon={Bell}
                    title="Actionable Alerts"
                    text="Customize which operational events trigger sound notifications or dashboard popups."
                  />
                ) : activeTab === 'system' ? (
                  <SecurityChecklistItem
                    icon={Sliders}
                    title="Global Constraints"
                    text="System rules affect all active operations and can only be modified by root administrators."
                  />
                ) : (
                  <SecurityChecklistItem
                    icon={Settings}
                    title="Section Overview"
                    text="These settings manage specific operational domains of the campus ride platform."
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
    background: 'transparent',
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
    background: 'transparent',
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

  banner: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', borderRadius: 10,
    border: '1px solid', marginBottom: 16,
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
