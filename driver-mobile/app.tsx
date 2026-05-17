import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DriverApp from './src/driver'
import { API_BASE_URL, APP_ENV } from './config/apiConfig'

console.log(`[LR-Ride Driver] env: ${APP_ENV}, api: ${API_BASE_URL}`)

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <DriverApp />
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}

