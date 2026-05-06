import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-12) var(--space-6)',
      textAlign: 'center',
      gap: 'var(--space-3)',
    }}>
      {icon && (
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-full)',
          background: 'var(--green-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          color: 'var(--green-primary)',
          marginBottom: 'var(--space-2)',
        }}>
          {icon}
        </div>
      )}
      <h3 style={{
        fontSize: 'var(--text-lg)',
        fontWeight: 600,
        color: 'var(--text-primary)',
      }}>
        {title}
      </h3>
      {description && (
        <p style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          maxWidth: 360,
          lineHeight: 1.5,
        }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 'var(--space-2)' }}>{action}</div>}
    </div>
  )
}
