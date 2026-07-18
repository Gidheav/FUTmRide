import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AuthUser } from './authStore'
import { useAuthStore } from './authStore'
import { useSecurityStore } from './securityStore'
import { useWalletStore } from './walletStore'
import { useStudentProfileStore } from './studentProfileStore'
import { clearAuthTokens, getSecureItem, removeSecureItem, setSecureItem } from '../../utils/secureStorage'
import { clearStoredPinHash } from './security'

const STUDENT_SESSION_SNAPSHOT_KEY = 'lr-ride:student:sandbox:session'
const STUDENT_PENDING_LOGOUTS_KEY = 'lr-ride:student:sandbox:pending-logouts'
type LockTimeout = 0 | 0.25 | 1 | 5 | 15

const ASYNC_KEYS_TO_CLEAR = [
  'auth-store',
  'security-store',
  'student-profile-store',
]

export type PendingLogoutToken = {
  accessToken?: string | null
  refreshToken: string
  queuedAt: number
}

export type StudentSessionSnapshot = {
  version: 1
  userId: string
  savedAt: number
  loginClockStartedAt?: number | null
  user: AuthUser
  security: {
    appLockEnabled: boolean
    biometricEnabled: boolean
    lockTimeoutMinutes: LockTimeout
    lastUnlockAt: number | null
    hasPin: boolean
    pinRecoveryRequired: boolean
  }
  wallet: {
    walletBalance: number | string | null
  }
  profilesByUserId: ReturnType<typeof useStudentProfileStore.getState>['profilesByUserId']
}

export const readStudentSessionSnapshot = async (): Promise<StudentSessionSnapshot | null> => {
  const raw = await getSecureItem(STUDENT_SESSION_SNAPSHOT_KEY)
  if (!raw) return null
  try {
    const snapshot = JSON.parse(raw) as StudentSessionSnapshot
    if (snapshot?.version !== 1 || !snapshot.user?.id) return null
    return snapshot
  } catch {
    return null
  }
}

export const applyStudentSessionSnapshot = (snapshot: StudentSessionSnapshot) => {
  useAuthStore.getState().setUser(snapshot.user)
  useSecurityStore.setState({
    ...snapshot.security,
    locked: false,
  })
  useWalletStore.getState().setWalletBalance(snapshot.wallet.walletBalance)
  useStudentProfileStore.setState({
    profilesByUserId: snapshot.profilesByUserId || {},
  })
}

export const saveStudentSessionSnapshotFromStores = async (options?: {
  user?: AuthUser | null
  loginClockStartedAt?: number | null
}) => {
  const auth = useAuthStore.getState()
  const security = useSecurityStore.getState()
  const wallet = useWalletStore.getState()
  const profile = useStudentProfileStore.getState()
  const user = options?.user || auth.user

  if (!user?.id || user.role !== 'student') return

  const snapshot: StudentSessionSnapshot = {
    version: 1,
    userId: String(user.id),
    savedAt: Date.now(),
    loginClockStartedAt: options?.loginClockStartedAt ?? auth.loginAt,
    user,
    security: {
      appLockEnabled: security.appLockEnabled,
      biometricEnabled: security.biometricEnabled,
      lockTimeoutMinutes: security.lockTimeoutMinutes,
      lastUnlockAt: security.lastUnlockAt,
      hasPin: security.hasPin,
      pinRecoveryRequired: security.pinRecoveryRequired,
    },
    wallet: {
      walletBalance: wallet.walletBalance,
    },
    profilesByUserId: profile.profilesByUserId,
  }

  await setSecureItem(STUDENT_SESSION_SNAPSHOT_KEY, JSON.stringify(snapshot))
}

export const hydrateStudentSessionFromSandbox = async (expectedUserId?: string | null) => {
  const snapshot = await readStudentSessionSnapshot()
  if (!snapshot) return null
  if (expectedUserId && String(snapshot.userId) !== String(expectedUserId)) return null
  applyStudentSessionSnapshot(snapshot)
  return snapshot
}

export const resetStudentRuntimeStores = () => {
  useSecurityStore.getState().resetForLogout()
  useWalletStore.getState().resetForLogout()
  useStudentProfileStore.getState().clearAllProfiles()
}

export const clearStudentSandbox = async () => {
  await Promise.all([
    clearAuthTokens(),
    clearStoredPinHash(),
    removeSecureItem(STUDENT_SESSION_SNAPSHOT_KEY),
    ...ASYNC_KEYS_TO_CLEAR.map((key) => AsyncStorage.removeItem(key).catch(() => undefined)),
  ])
}

export const getPendingLogoutTokens = async (): Promise<PendingLogoutToken[]> => {
  const raw = await getSecureItem(STUDENT_PENDING_LOGOUTS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item) => item?.refreshToken) : []
  } catch {
    return []
  }
}

export const queuePendingLogoutToken = async (token: PendingLogoutToken) => {
  const pending = await getPendingLogoutTokens()
  const next = [
    token,
    ...pending.filter((item) => item.refreshToken !== token.refreshToken),
  ].slice(0, 5)
  await setSecureItem(STUDENT_PENDING_LOGOUTS_KEY, JSON.stringify(next))
}

export const removePendingLogoutToken = async (refreshToken: string) => {
  const pending = await getPendingLogoutTokens()
  const next = pending.filter((item) => item.refreshToken !== refreshToken)
  if (next.length) {
    await setSecureItem(STUDENT_PENDING_LOGOUTS_KEY, JSON.stringify(next))
  } else {
    await removeSecureItem(STUDENT_PENDING_LOGOUTS_KEY)
  }
}
