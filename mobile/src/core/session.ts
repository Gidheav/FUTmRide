import api, { API_BASE_URL } from './api'

export type RefreshResponse = {
  access: string
  refresh?: string
}

export const refreshSession = async (refreshToken: string) => {
  const res = await api.post<RefreshResponse>('auth/token/refresh/', {
    refresh: refreshToken,
  })
  return res.data
}

export const fetchCurrentUser = async () => {
  const res = await api.get('users/me/')
  return res.data
}
