import React, { ReactNode, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import type { DriverTab } from '../types';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import DriverSidebar from '../components/DriverSidebar';
import { useAuthStore } from '../../core/authStore';

interface LayoutProps {
  activeTab: DriverTab;
  onTabChange: (tab: DriverTab) => void;
  children: ReactNode;
  onOpenWebLink?: (url: string, title: string) => void;
}

export default function DriverLayout({ activeTab, onTabChange, children, onOpenWebLink }: LayoutProps) {
  const insets = useSafeAreaInsets();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const { user, logout } = useAuthStore();

  const getInitials = () => {
    if (!user) return '?';
    const first = user.first_name?.[0] || '';
    const last = user.last_name?.[0] || '';
    return (first + last).toUpperCase() || user.phone_number?.slice(-2) || 'D';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} translucent />
      
      <DriverSidebar 
        visible={isSidebarVisible} 
        onClose={() => setIsSidebarVisible(false)} 
        onLogout={() => {
          setIsSidebarVisible(false);
          logout();
        }}
        onOpenWebLink={onOpenWebLink || (() => {})}
      />

      {/* Top App Bar with safe area padding */}
      <View style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => setIsSidebarVisible(true)} 
            style={styles.menuButton}
            activeOpacity={0.7}
          >
            <MaterialIcons name="menu" size={28} color={COLORS.primary} />
          </TouchableOpacity>
          
          <View style={styles.headerIcons}>
            <View style={styles.notificationWrapper}>
              <MaterialIcons name="notifications" size={24} color={COLORS.onSurfaceVariant} />
              <View style={styles.notificationDot} />
            </View>
            {user?.profile_photo ? (
              <Image source={{ uri: user.profile_photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.initialsContainer]}>
                <Text style={styles.initialsText}>{getInitials()}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {children}
      </View>

      {/* Bottom Navigation with safe area padding */}
      <View style={[
        styles.bottomNavContainer, 
        { 
          paddingBottom: insets.bottom,
          shadowColor: '#000', 
          shadowOffset: { width: 0, height: -4 }, 
          shadowOpacity: 0.05, 
          shadowRadius: 20 
        }
      ]}>
        <View style={styles.bottomNav}>
          <TouchableOpacity 
            style={activeTab === 'home' ? styles.navItemActive : styles.navItem}
            onPress={() => onTabChange('home')}
          >
            <MaterialIcons name="home" size={24} color={activeTab === 'home' ? '#ffffff' : COLORS.onSurfaceVariant} />
            <Text style={[FONTS.labelMd, { color: activeTab === 'home' ? '#ffffff' : COLORS.onSurfaceVariant, marginTop: 4 }]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={activeTab === 'rides' ? styles.navItemActive : styles.navItem}
            onPress={() => onTabChange('rides')}
          >
            <MaterialIcons name="directions-car" size={24} color={activeTab === 'rides' ? '#ffffff' : COLORS.onSurfaceVariant} />
            <Text style={[FONTS.labelMd, { color: activeTab === 'rides' ? '#ffffff' : COLORS.onSurfaceVariant, marginTop: 4 }]}>Rides</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={activeTab === 'wallet' ? styles.navItemActive : styles.navItem}
            onPress={() => onTabChange('wallet')}
          >
            <MaterialIcons name="account-balance-wallet" size={24} color={activeTab === 'wallet' ? '#ffffff' : COLORS.onSurfaceVariant} />
            <Text style={[FONTS.labelMd, { color: activeTab === 'wallet' ? '#ffffff' : COLORS.onSurfaceVariant, marginTop: 4 }]}>Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={activeTab === 'profile' ? styles.navItemActive : styles.navItem}
            onPress={() => onTabChange('profile')}
          >
            <MaterialIcons name="person" size={24} color={activeTab === 'profile' ? '#ffffff' : COLORS.onSurfaceVariant} />
            <Text style={[FONTS.labelMd, { color: activeTab === 'profile' ? '#ffffff' : COLORS.onSurfaceVariant, marginTop: 4 }]}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 40,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  menuButton: {
    padding: 4,
    marginLeft: -4,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationWrapper: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surfaceContainerHigh,
    ...AMBIENT_SHADOW,
    shadowRadius: 8,
    elevation: 2,
  },
  initialsContainer: {
    backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceContainer,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    zIndex: 50,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  navItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  navItemActive: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
});
