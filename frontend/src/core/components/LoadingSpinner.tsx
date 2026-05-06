import type { CSSProperties } from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: string
  label?: string
  fullPage?: boolean
}

const sizeMap: Record<string, number> = {
  sm: 20,
  md: 32,
  lg: 48,
  xl: 64,
}

export default function LoadingSpinner({
  size = 'md',
  color = 'var(--green-primary)',
  label,
  fullPage = false,
}: LoadingSpinnerProps) {
  const px = sizeMap[size]

  const spinnerStyle: CSSProperties = {
    width: px,
    height: px,
    border: `${Math.max(2, px / 10)}px solid var(--border)`,
    borderTopColor: color,
    borderRadius: '50%',
    animation: 'lr-spin 0.7s linear infinite',
  }

  const wrapperStyle: CSSProperties = fullPage
    ? {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 'var(--space-3)',
      }
    : {
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }

  return (
    <>
      <style>{`@keyframes lr-spin { to { transform: rotate(360deg) } }`}</style>
      <div style={wrapperStyle} role="status" aria-label={label || 'Loading'}>
        <div style={spinnerStyle} />
        {label && (
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            {label}
          </span>
        )}
      </div>
    </>
  )
}
