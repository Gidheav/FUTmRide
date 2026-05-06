import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useAuthStore } from '../../core/authStore'

export default function DriverDashboardScreen() {
  const { user, logout } = useAuthStore()

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome, {user?.full_name}</Text>
        <Text style={styles.subtitle}>Your driver workspace is ready.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Driver Status</Text>
        <Text style={styles.cardText}>You can accept rides once your account is approved and online.</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Trips</Text>
          <Text style={styles.statValue}>0</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Earnings</Text>
          <Text style={styles.statValue}>NGN 10.00</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    marginTop: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1c1c',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#5e5e5e',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#5e5e5e',
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#5e5e5e',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6A1B9A',
  },
  logoutButton: {
    backgroundColor: '#f3f3f3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#1a1c1c',
    fontSize: 16,
    fontWeight: '600',
  },
})
