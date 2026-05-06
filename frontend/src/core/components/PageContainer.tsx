import type { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  maxWidth?: number
  padding?: boolean
}

export default function PageContainer({
  children,
  maxWidth = 1200,
  padding = true,
}: PageContainerProps) {
  return (
    <div style={{
      width: '100%',
      maxWidth,
      marginLeft: 'auto',
      marginRight: 'auto',
      padding: padding ? 'var(--space-6)' : 0,
    }}>
      {children}
    </div>
  )
}
