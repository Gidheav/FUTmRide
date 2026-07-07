import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { SpeedInsights } from '@vercel/speed-insights/react'
import ErrorBoundary from './core/components/ErrorBoundary'
import './index.css'
import AppRouter from './core/AppRouter'

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

if (rootElement && !desktopOnlyBlocked) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AppRouter />
            <SpeedInsights />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  borderRadius: '8px',
                  fontSize: '14px',
                },
              }}
            />
            <SpeedInsights />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  )
}