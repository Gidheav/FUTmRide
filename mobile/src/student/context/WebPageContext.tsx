/**
 * WebPageContext
 *
 * A global context that lets ANY component in the student app open a URL
 * inside the in-app browser (GenericWebPage) without prop drilling.
 *
 * Usage anywhere in the app:
 *   const { openWebPage } = useWebPage()
 *   openWebPage('https://example.com', 'Optional Title')
 */
import { createContext, useContext, useState, type ReactNode } from 'react'

type WebPageState = { url: string; title?: string } | null

type WebPageContextType = {
  openWebPage: (url: string, title?: string) => void
  closeWebPage: () => void
  closWebPage: () => void
  webPage: WebPageState
}

const WebPageContext = createContext<WebPageContextType | null>(null)

export function WebPageProvider({ children }: { children: ReactNode }) {
  const [webPage, setWebPage] = useState<WebPageState>(null)

  const openWebPage = (url: string, title?: string) => {
    const normalizedUrl = normalizeWebUrl(url)
    if (!normalizedUrl) return
    setWebPage({ url: normalizedUrl, title })
  }

  const closeWebPage = () => setWebPage(null)

  return (
    <WebPageContext.Provider value={{ openWebPage, closeWebPage, closWebPage: closeWebPage, webPage }}>
      {children}
    </WebPageContext.Provider>
  )
}

export function useWebPage() {
  const ctx = useContext(WebPageContext)
  if (!ctx) throw new Error('useWebPage must be used inside <WebPageProvider>')
  return ctx
}

export function normalizeWebUrl(url?: string | null) {
  const trimmed = String(url || '').trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
  } catch {
    return null
  }

  return null
}
