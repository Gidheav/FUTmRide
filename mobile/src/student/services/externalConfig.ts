import { useState, useEffect } from 'react'
import api, { API_BASE_URL } from '../../core/api'

export type ExternalWebViewConfig = {
  news_url: string
  events_url: string
  activities_url: string
  safety_guide_url: string
}

const WEBVIEW_TOKEN = process.env.EXPO_PUBLIC_WEBVIEW_TOKEN || 'LzR_Secure_App_2026'

function buildDefaultWebViewUrl(page: string) {
  try {
    const origin = new URL(API_BASE_URL).origin
    return `${origin}/webview/${page}/?token=${WEBVIEW_TOKEN}`
  } catch {
    return `https://lrride-server.onrender.com/webview/${page}/?token=${WEBVIEW_TOKEN}`
  }
}

// Fallback default URLs in case the backend request fails
const DEFAULT_CONFIG: ExternalWebViewConfig = {
  news_url: buildDefaultWebViewUrl('news'),
  events_url: buildDefaultWebViewUrl('events'),
  activities_url: buildDefaultWebViewUrl('activities'),
  safety_guide_url: buildDefaultWebViewUrl('safety'),
}

// Global cache to prevent re-fetching on every screen navigation
let cachedConfig: Partial<ExternalWebViewConfig> | null = null

export function useExternalWebViewUrl(key: keyof ExternalWebViewConfig) {
  const [url, setUrl] = useState<string>(cachedConfig?.[key] || DEFAULT_CONFIG[key])
  
  useEffect(() => {
    // If already cached, no need to re-fetch
    if (cachedConfig && cachedConfig[key]) return;

    // Fetch dynamic config from the backend
    api.get('app-config/')
      .then((res) => {
        const data = res.data
        if (data) {
          cachedConfig = { ...cachedConfig, ...data }
          if (data[key]) {
            setUrl(data[key])
          }
        }
      })
      .catch(() => {
        // Silently fallback to default on error
      })
  }, [key])

  return url
}
