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
  closWebPage: () => void
  webPage: WebPageState
}

const WebPageContext = createContext<WebPageContextType | null>(null)

export function WebPageProvider({ children }: { children: ReactNode }) {
  const [webPage, setWebPage] = useState<WebPageState>(null)

  const openWebPage = (url: string, title?: string) => {
    if (!url) return
    setWebPage({ url, title })
  }

  const closWebPage = () => setWebPage(null)

  return (
    <WebPageContext.Provider value={{ openWebPage, closWebPage, webPage }}>
      {children}
    </WebPageContext.Provider>
  )
}

export function useWebPage() {
  const ctx = useContext(WebPageContext)
  if (!ctx) throw new Error('useWebPage must be used inside <WebPageProvider>')
  return ctx
}
