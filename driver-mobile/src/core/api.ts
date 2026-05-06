import axios from 'axios'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { useAuthStore } from './authStore'

const getDevHost = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as { manifest?: { hostUri?: string } }).manifest?.hostUri
  if (!hostUri) return null
  return hostUri.split(':')[0]
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (getDevHost() ? `http://${getDevHost()}:8002/api/v1` : null) ||
  (Platform.OS === 'android'
    ? 'http://10.0.2.2:8002/api/v1'
    : 'http://localhost:8002/api/v1')

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
