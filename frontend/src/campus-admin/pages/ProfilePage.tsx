import type { CSSProperties } from 'react'
import { User as UserIcon } from 'lucide-react'
import { useAuthStore } from '../../core/authStore'
import { T } from '../theme'

export default function ProfilePage() {
  const { user } = useAuthStore()

  return (
    <div style={s.main}>
      <div style={s.profileCard}>
        <div style={s.avatarLarge}>
          <UserIcon size={40} color={T.accent} />
        </div>
        <h2 style={{ fontSize: 24, marginBottom: 4 }}>{user?.first_name} {user?.last_name}</h2>
        <p style={{ color: T.textSecondary, marginBottom: 20 }}>Campus Administrator</p>
        
        <div style={s.statsRow}>
          <div style={s.stat}>
            <span style={s.statLabel}>Email</span>
            <span style={s.statVal}>{user?.email || 'N/A'}</span>
          </div>
          <div style={s.stat}>
            <span style={s.statLabel}>Phone</span>
            <span style={s.statVal}>{user?.phone_number || 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, CSSProperties> = {
  main: { padding: 24, maxWidth: 800, margin: '0 auto' },
  profileCard: { background: T.bgPanel, borderRadius: 16, border: `1px solid ${T.border}`, padding: 32, alignItems: 'center', display: 'flex', flexDirection: 'column' },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, border: `1px solid ${T.accent}` },
  statsRow: { display: 'flex', gap: 40, width: '100%', marginTop: 24, borderTop: `1px solid ${T.border}`, paddingTop: 24 },
  stat: { display: 'flex', flexDirection: 'column', flex: 1 },
  statLabel: { fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 },
  statVal: { fontSize: 14, color: T.textSecondary },
}
