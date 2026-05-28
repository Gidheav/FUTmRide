import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'react-native'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DriverApp from './src/driver'
import { API_BASE_URL, APP_ENV } from './config/apiConfig'
import { applyThemeMode } from './src/core/theme'
import { useSettingsStore } from './src/core/settingsStore'

console.log(`[LR-Ride Driver] env: ${APP_ENV}, api: ${API_BASE_URL}`)

const queryClient = new QueryClient()

export default function App() {
  const themeMode = useSettingsStore((state) => state.settings.themeMode)

  useEffect(() => {
    applyThemeMode(themeMode)
  }, [themeMode])

  const isDark = themeMode === 'dark'
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <DriverApp />
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
