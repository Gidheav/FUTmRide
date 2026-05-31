import axios from 'axios'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokenStorage'

const rawBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8002/api/v1'
const BASE_URL = rawBase.endsWith('/') ? rawBase : `${rawBase}/`

export const getMediaUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  
  const backendHost = rawBase.replace(/\/api\/v1\/?$/, '');
  return `${backendHost}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use(
  (config) => {
    // Strip leading slash from URL so it appends correctly to baseURL
    if (config.url && config.url.startsWith('/')) {
      config.url = config.url.slice(1)
    }
    
    const token = getAccessToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as any
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = getRefreshToken()
      if (refresh) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh })
          const token = res.data.access
          setTokens(token, refresh)
          if (original.headers) original.headers.Authorization = `Bearer ${token}`
          return api(original)
        } catch {
          clearTokens()
          window.location.href = '/login'
        }
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api