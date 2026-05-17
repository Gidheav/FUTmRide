import type { CSSProperties } from 'react'
import { Bell } from 'lucide-react'
import { T } from '../theme'

export default function NotificationsPage() {
  return (
    <>
      <main style={s.main}>
        <div style={s.empty}>
          <Bell size={48} color={T.textMuted} style={{ marginBottom: 16 }} />
          <h2 style={{ color: T.textPrimary, marginBottom: 8 }}>Notifications</h2>
          <p style={{ color: T.textSecondary, fontSize: 14 }}>Real-time system alerts and emergency broadcasts coming soon.</p>
        </div>
      </main>
    </>
  )
}

const s: Record<string, CSSProperties> = {
  main: { padding: 24, maxWidth: 1200, margin: '0 auto' },
  empty: { height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${T.border}`, borderRadius: 16, background: T.bgPanel },
}
