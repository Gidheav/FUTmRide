import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'

export type ThemeMode = 'system' | 'light' | 'dark'
export type NavigationApp = 'google_maps'

export type SettingsState = {
  language: string
  themeMode: ThemeMode
  pushEnabled: boolean
  navigationApp: NavigationApp
  biometricEnabled: boolean
  twoFactorEnabled: boolean
  twoFactorMethods: string[]
  hasPin: boolean
}

export type SettingsApiPayload = {
  has_pin?: boolean
  language?: string
  theme_mode?: ThemeMode
  push_enabled?: boolean
  navigation_app?: NavigationApp
  biometric_enabled?: boolean
  two_factor_enabled?: boolean
  two_factor_methods?: string[]
}

const DEFAULT_SETTINGS: SettingsState = {
  language: 'en',
  themeMode: 'system',
  pushEnabled: true,
  navigationApp: 'google_maps',
  biometricEnabled: false,
  twoFactorEnabled: false,
  twoFactorMethods: [],
  hasPin: false,
}

const mapApiToSettings = (payload: SettingsApiPayload): Partial<SettingsState> => ({
  hasPin: payload.has_pin,
  language: payload.language,
  themeMode: payload.theme_mode,
  pushEnabled: payload.push_enabled,
  navigationApp: payload.navigation_app,
  biometricEnabled: payload.biometric_enabled,
  twoFactorEnabled: payload.two_factor_enabled,
  twoFactorMethods: payload.two_factor_methods,
})

const compactSettings = (settings: SettingsState): SettingsState => ({
  language: settings.language || DEFAULT_SETTINGS.language,
  themeMode: settings.themeMode || DEFAULT_SETTINGS.themeMode,
  pushEnabled: settings.pushEnabled ?? DEFAULT_SETTINGS.pushEnabled,
  navigationApp: settings.navigationApp || DEFAULT_SETTINGS.navigationApp,
  biometricEnabled: settings.biometricEnabled ?? DEFAULT_SETTINGS.biometricEnabled,
  twoFactorEnabled: settings.twoFactorEnabled ?? DEFAULT_SETTINGS.twoFactorEnabled,
  twoFactorMethods: Array.isArray(settings.twoFactorMethods) ? settings.twoFactorMethods : [],
  hasPin: settings.hasPin ?? DEFAULT_SETTINGS.hasPin,
})

interface SettingsStore {
  settings: SettingsState
  isHydrated: boolean
  hydrateFromApi: (payload: SettingsApiPayload) => void
  updateLocal: (patch: Partial<SettingsState>) => void
  setHydrated: (value: boolean) => void
  reset: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      isHydrated: false,
      hydrateFromApi: (payload) => {
        const mapped = mapApiToSettings(payload)
        const merged = compactSettings({ ...get().settings, ...mapped })
        set({ settings: merged, isHydrated: true })
      },
      updateLocal: (patch) => {
        const merged = compactSettings({ ...get().settings, ...patch })
        set({ settings: merged })
      },
      setHydrated: (value) => set({ isHydrated: value }),
      reset: () => set({ settings: DEFAULT_SETTINGS, isHydrated: false }),
    }),
    {
      name: 'driver-settings-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
