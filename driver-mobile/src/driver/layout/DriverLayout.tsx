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
import { COLORS, FONTS } from '../../core/theme';
import DriverSidebar from '../components/DriverSidebar';
import { useAuthStore } from '../../core/authStore';

interface LayoutProps {
  activeTab: DriverTab;
  onTabChange: (tab: DriverTab) => void;
  children: ReactNode;
}

const IMAGES = {
  avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAJaTBlqu2p2DpDpc1cfUyzepdPCe0atBoLkWh1Mf96LvvZGuIm-cSYwvg-XPZkAUf6j6jhGhksPyx1To2U20s6_3B8lC9ErpMh5oaRzqp5umPAs0UMVnUPnViAmjr6SeLggYz5p05vMeydMBF-lPviBBg65ouMg5OXIZNwy4h-si_iN1ZZY0XWM_yXduOl3wLE47d62SGc3OJd2j_VRgsIZg1xS7Hpjk9oWX5H6dY4rHFr0C2a6rhe-9w2CfJ4L2UpDfBmB2OpjH8",
};

export default function DriverLayout({ activeTab, onTabChange, children }: LayoutProps) {
  const insets = useSafeAreaInsets();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const { logout } = useAuthStore();

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
            <Image source={{ uri: IMAGES.avatar }} style={styles.avatar} />
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
            <MaterialIcons name="home" size={24} color={activeTab === 'home' ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant} />
            <Text style={[FONTS.labelMd, { color: activeTab === 'home' ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant, marginTop: 4 }]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={activeTab === 'rides' ? styles.navItemActive : styles.navItem}
            onPress={() => onTabChange('rides')}
          >
            <MaterialIcons name="directions-car" size={24} color={activeTab === 'rides' ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant} />
            <Text style={[FONTS.labelMd, { color: activeTab === 'rides' ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant, marginTop: 4 }]}>Rides</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={activeTab === 'wallet' ? styles.navItemActive : styles.navItem}
            onPress={() => onTabChange('wallet')}
          >
            <MaterialIcons name="account-balance-wallet" size={24} color={activeTab === 'wallet' ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant} />
            <Text style={[FONTS.labelMd, { color: activeTab === 'wallet' ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant, marginTop: 4 }]}>Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={activeTab === 'profile' ? styles.navItemActive : styles.navItem}
            onPress={() => onTabChange('profile')}
          >
            <MaterialIcons name="person" size={24} color={activeTab === 'profile' ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant} />
            <Text style={[FONTS.labelMd, { color: activeTab === 'profile' ? COLORS.onPrimaryContainer : COLORS.onSurfaceVariant, marginTop: 4 }]}>Profile</Text>
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
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
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
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
});
