import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { SpeedInsights } from '@vercel/speed-insights/react'
import ErrorBoundary from './core/components/ErrorBoundary'
import './index.css'
import AppRouter from './core/AppRouter'
import { useCampusThemeStore } from './campus-admin/theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

const desktopOnlyBlocked = (window as Window & { __DESKTOP_ONLY_BLOCKED__?: boolean })
  .__DESKTOP_ONLY_BLOCKED__ === true

const rootElement = document.getElementById('root')

function ThemedToaster() {
  const { mode } = useCampusThemeStore()
  const isDark = mode === 'dark'

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: '10px',
          fontSize: '14px',
          background: isDark ? '#111827' : '#ffffff',
          color: isDark ? '#f8fafc' : '#0f172a',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          boxShadow: isDark
            ? '0 12px 30px rgba(0, 0, 0, 0.35)'
            : '0 12px 30px rgba(15, 23, 42, 0.12)',
        },
        success: {
          style: {
            background: isDark ? '#0f2e25' : '#ecfdf5',
            color: isDark ? '#d1fae5' : '#065f46',
            border: `1px solid ${isDark ? '#14532d' : '#a7f3d0'}`,
          },
        },
        error: {
          style: {
            background: isDark ? '#2a1416' : '#fef2f2',
            color: isDark ? '#fecaca' : '#991b1b',
            border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`,
          },
        },
      }}
    />
  )
}

if (rootElement && !desktopOnlyBlocked) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AppRouter />
            <SpeedInsights />
            <ThemedToaster />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  )
}