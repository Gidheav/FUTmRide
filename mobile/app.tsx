import { SafeAreaProvider } from 'react-native-safe-area-context'
import StudentApp from './src/student'

export default function App() {
  return (
    <SafeAreaProvider>
      <StudentApp />
    </SafeAreaProvider>
  )
}
