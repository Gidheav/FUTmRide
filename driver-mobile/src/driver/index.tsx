import { View } from 'react-native'
import { useAuthStore } from '../core/authStore'
import DriverLoginScreen from './screens/LoginScreen'
import DriverDashboardScreen from './screens/DashboardScreen'

export default function DriverApp() {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <DriverLoginScreen />
  }

  if (user.role !== 'driver') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <DriverLoginScreen />
      </View>
    )
  }

  return <DriverDashboardScreen />
}
