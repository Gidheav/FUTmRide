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

export const authApi = {
  getMe: () => api.get('/users/me/'),
  updateMe: (data: any) => api.patch('/users/me/', data),
}

export const driverApi = {
  getProfile: () => api.get('/users/me/driver-profile/'),
  updateProfile: (data: any) => api.patch('/users/me/driver-profile/', data),
  getActiveRide: () => api.get('rides/driver/active/'),
  advanceRide: (rideId: string) => api.post(`rides/${rideId}/advance/`),
  getMarketplaceRequests: () => api.get('rides/driver/requests/'),
  acceptRideRequest: (rideId: string) => api.post(`rides/driver/requests/${rideId}/accept/`),
}

export const verificationApi = {
  // Driver: Account Verification
  getAccountStatus: () => api.get('/verification/account/'),
  submitAccount: (formData: FormData) =>
    api.post('/verification/account/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  resubmitAccount: (formData: FormData) =>
    api.patch('/verification/account/resubmit/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Driver: Verification Progress
  getProgress: () => api.get('/verification/progress/'),

  // Driver: Vehicle Documents
  uploadDocument: (formData: FormData) =>
    api.post('/verification/documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getMyDocuments: () => api.get('/verification/documents/'),
}

export default api
