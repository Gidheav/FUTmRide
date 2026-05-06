import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
    // TODO: Send to Sentry in production
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          padding: 'var(--space-8)',
          textAlign: 'center',
          gap: 'var(--space-4)',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-error-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
          }}>
            ⚠️
          </div>
          <h2 style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            Something went wrong
          </h2>
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            maxWidth: 400,
          }}>
            An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
          </p>
          {this.state.error && (
            <pre style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-error)',
              background: 'var(--color-error-bg)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              maxWidth: '100%',
              overflow: 'auto',
              textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleRetry}
            style={{
              padding: 'var(--space-3) var(--space-6)',
              background: 'var(--green-primary)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background var(--transition-fast)',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'var(--green-dark)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'var(--green-primary)')}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
