import { useState, useEffect } from 'react'
import api from '../../core/api'

export type ExternalWebViewConfig = {
  news_url: string
  events_url: string
  activities_url: string
  safety_guide_url: string
}

// Fallback default URLs in case the backend request fails
const DEFAULT_CONFIG: ExternalWebViewConfig = {
  news_url: 'https://futminna.edu.ng/news/',
  events_url: 'https://futminna.edu.ng/events/',
  activities_url: 'https://futminna.edu.ng/activities/',
  safety_guide_url: 'https://futminna.edu.ng/safety/',
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
      .catch((err) => {
        // Silently fallback to default on error
      })
  }, [key])

  return url
}
