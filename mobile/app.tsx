import { SafeAreaProvider } from 'react-native-safe-area-context'
import StudentApp from './src/student'
import { API_BASE_URL, APP_ENV } from './config/apiConfig'

console.log(`[LR-Ride] app env: ${APP_ENV}, api: ${API_BASE_URL}`)

export default function App() {
  return (
    <SafeAreaProvider>
      <StudentApp />
    </SafeAreaProvider>
  )
}
