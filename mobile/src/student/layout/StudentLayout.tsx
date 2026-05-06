import { ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useAuthStore } from '../../core/authStore'
import type { StudentTab } from '../types'

type LayoutProps = {
  activeTab: StudentTab
  onTabChange: (tab: StudentTab) => void
  onMenuPress: () => void
  children: ReactNode
}

const PROFILE_IMAGE_URI =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuClMVoh7zmBg2OcDmJVqaJGaFf7OijZawkSK47wT4QxqSO21IVyKq0kUlmIcilMRCKoy9O07xvZlFSeuy98ovJDxs3v9ZNVcjHrmfAXN02bOqYRpbKqNDhuNIern7HbnwLpYMeqI5I0Tc8b9uz4sKhP3FP4yN6N_Jq89CC6X6u67nwdBwNAiFauHc4mGw5lxlVJyazxdmbsgFZfq6jrlSXmWHNikXliNOTjUgGdIrAmiSndbopWWqvyqzl7LgrUm6fpw3I9tSeEVHY'

const NAV_ITEMS: Array<{ key: StudentTab; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'rides', label: 'Rides', icon: 'directions-car' },
  { key: 'wallet', label: 'Wallet', icon: 'account-balance-wallet' },
  { key: 'account', label: 'Account', icon: 'person' },
]

export default function StudentLayout({ activeTab, onTabChange, onMenuPress, children }: LayoutProps) {
  const { user } = useAuthStore()
  const avatarUri = user?.profile_photo || PROFILE_IMAGE_URI

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={onMenuPress} activeOpacity={0.85}>
          <MaterialIcons name="menu" size={22} color="#6A1B9A" />
        </TouchableOpacity>
        <Text style={styles.brandText}>Campus Ride</Text>
        <TouchableOpacity style={styles.avatarButton} activeOpacity={0.85}>
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>{children}</View>

      <View style={styles.bottomNav}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.key
          return (
            <TouchableOpacity
              key={item.key}
              style={isActive ? styles.navItemActive : styles.navItem}
              onPress={() => onTabChange(item.key)}
              activeOpacity={0.85}
            >
              <MaterialIcons name={item.icon} size={20} color={isActive ? '#6A1B9A' : '#9ca3af'} />
              <Text style={isActive ? styles.navLabelActive : styles.navLabel}>{item.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  topBar: {
    height: 64,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6A1B9A',
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  navItemActive: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f0e6ff',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  navLabelActive: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  navLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
  },
})
