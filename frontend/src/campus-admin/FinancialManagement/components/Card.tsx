import React, { memo, type CSSProperties } from 'react'
import { T } from '../../theme'

export const Card = memo(({ children, className = '', glow = '', style }: {
  children: React.ReactNode
  className?: string
  glow?: string
  style?: CSSProperties
}) => {
  const accent = glow || T.accent
  return (
    <div
      className={`fh-card relative overflow-hidden ${className}`}
      style={{
        background: T.bgPanel,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow: glow
          ? `0 0 0 1px ${accent}22, 0 4px 24px ${accent}11`
          : '0 4px 20px rgba(0,0,0,0.05)',
        ...style,
      }}
    >
      {glow && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }}
        />
      )}
      {children}
    </div>
  )
})
Card.displayName = 'Card'
