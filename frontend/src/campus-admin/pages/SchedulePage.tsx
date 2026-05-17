import type { CSSProperties } from 'react'
import { CalendarClock } from 'lucide-react'
import { T } from '../theme'

export default function SchedulePage() {
  return (
    <>
      <main style={s.main}>
        <div style={s.empty}>
          <CalendarClock size={48} color={T.textMuted} style={{ marginBottom: 16 }} />
          <h2 style={{ color: T.textPrimary, marginBottom: 8 }}>Scheduled Rides</h2>
          <p style={{ color: T.textSecondary, fontSize: 14 }}>Calendar view of upcoming and repeated rides coming soon.</p>
        </div>
      </main>
    </>
  )
}

const s: Record<string, CSSProperties> = {
  main: { padding: 24, maxWidth: 1200, margin: '0 auto' },
  empty: { height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${T.border}`, borderRadius: 16, background: T.bgPanel },
}
