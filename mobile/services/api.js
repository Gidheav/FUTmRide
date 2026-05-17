import axios from 'axios'
import { API_BASE_URL } from '../config/apiConfig'
import { getAuthTokens } from '../utils/storage'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

api.interceptors.request.use(async (config) => {
  const tokens = await getAuthTokens()
  const token = tokens?.accessToken
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const setApiBaseUrl = (nextBaseUrl) => {
  api.defaults.baseURL = nextBaseUrl
}

export default api
