import { ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useAuthStore } from '../../core/authStore'
import type { StudentTab } from '../types'

type LayoutProps = {
  activeTab: StudentTab
  onTabChange: (tab: StudentTab) => void
  onMenuPress: () => void
  onNotificationPress?: () => void
  unreadCount?: number
  children: ReactNode
}

const NAV_ITEMS: Array<{ key: StudentTab; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'rides', label: 'Rides', icon: 'directions-car' },
  { key: 'wallet', label: 'Wallet', icon: 'account-balance-wallet' },
  { key: 'account', label: 'Account', icon: 'person' },
]

export default function StudentLayout({ activeTab, onTabChange, onMenuPress, onNotificationPress, unreadCount = 0, children }: LayoutProps) {
  const { user } = useAuthStore()
  
  const getInitials = () => {
    if (!user?.full_name) return '?'
    const parts = user.full_name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0][0].toUpperCase()
  }

  const insets = useSafeAreaInsets()

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.iconButton} onPress={onMenuPress} activeOpacity={0.85}>
          <MaterialIcons name="menu" size={22} color="#6A1B9A" />
        </TouchableOpacity>
        <Text style={styles.brandText}>FUTmRide</Text>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onNotificationPress}
            activeOpacity={0.85}
          >
            <MaterialIcons name="notifications-none" size={22} color="#6A1B9A" />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarButton} activeOpacity={0.85}>
            {user?.profile_photo ? (
              <Image source={{ uri: user.profile_photo }} style={styles.avatar} />
            ) : (
              <View style={styles.initialsContainer}>
                <Text style={styles.initialsText}>{getInitials()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>{children}</View>

      <View style={[styles.bottomNav, { paddingBottom: insets.bottom || 8 }]}>
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
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
    minHeight: 64,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  brandText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6A1B9A',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
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
  initialsContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0e6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6A1B9A',
  },
  content: {
    flex: 1,
  },
  bottomNav: {
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
    paddingTop: 8,
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