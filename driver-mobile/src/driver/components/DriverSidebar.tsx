import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEffect, useRef, useState } from 'react'
import { COLORS, FONTS } from '../../core/theme'

import { useExternalWebViewUrl } from '../services/externalConfig'

type SidebarProps = {
  visible: boolean
  onClose: () => void
  onLogout: () => void
  onOpenWebLink: (url: string, title: string) => void
}

export default function DriverSidebar({
  visible,
  onClose,
  onLogout,
  onOpenWebLink,
}: SidebarProps) {
  const [isVisible, setIsVisible] = useState(visible)
  const { width } = Dimensions.get('window')
  const sidebarWidth = Math.min(width * 0.76, 320)
  const translateX = useRef(new Animated.Value(-sidebarWidth)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()

  const driverNewsUrl = useExternalWebViewUrl('driver_news_url')
  const driverEventsUrl = useExternalWebViewUrl('driver_events_url')
  const communityUrl = useExternalWebViewUrl('community_url')
  const driverGuidelinesUrl = useExternalWebViewUrl('driver_guidelines_url')

  useEffect(() => {
    if (visible) {
      setIsVisible(true)
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -sidebarWidth,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setIsVisible(false))
    }
  }, [backdropOpacity, sidebarWidth, translateX, visible])

  const handleMenuPress = (url: string, title: string) => {
    onClose()
    onOpenWebLink(url, title)
  }

  return (
    <Modal visible={isVisible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        {/* Full screen animated backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Overlay layout containing the side panel */}
        <View
          style={[styles.overlayWrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
          pointerEvents="box-none"
        >
          <Animated.View style={[
            styles.sidebar,
            {
              width: sidebarWidth,
              transform: [{ translateX }],
            }
          ]}>
            <View style={styles.sidebarContent}>
              <View style={styles.header}>
                <Text style={[styles.brand, { color: COLORS.primary }]}>CampusDrive</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.85}>
                  <MaterialIcons name="close" size={20} color={COLORS.outline} />
                </TouchableOpacity>
              </View>

              <View style={styles.menuContent}>
                <Text style={styles.sectionTitle}>Enterprise Updates</Text>
                
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => handleMenuPress(driverNewsUrl, 'Driver News')}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="article" size={22} color={COLORS.onSurfaceVariant} />
                  <Text style={styles.menuText}>Driver News</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => handleMenuPress(driverEventsUrl, 'Campus Events')}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="event" size={22} color={COLORS.onSurfaceVariant} />
                  <Text style={styles.menuText}>Campus Events</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => handleMenuPress(communityUrl, 'Driver Community')}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="people" size={22} color={COLORS.onSurfaceVariant} />
                  <Text style={styles.menuText}>Driver Community</Text>
                </TouchableOpacity>

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Support & Legal</Text>

                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => handleMenuPress(driverGuidelinesUrl, 'Guidelines & Safety')}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="security" size={22} color={COLORS.onSurfaceVariant} />
                  <Text style={styles.menuText}>Guidelines & Safety</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => handleMenuPress('https://lrride.com/support', 'Help & Support')}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="help-outline" size={22} color={COLORS.onSurfaceVariant} />
                  <Text style={styles.menuText}>Help & Support</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => handleMenuPress('https://lrride.com/terms', 'Terms of Service')}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="description" size={22} color={COLORS.onSurfaceVariant} />
                  <Text style={styles.menuText}>Terms of Service</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.logoutItem} onPress={onLogout} activeOpacity={0.85}>
                <MaterialIcons name="logout" size={20} color={COLORS.error} />
                <Text style={[styles.logoutText, { color: COLORS.error }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlayWrap: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0)',
  },
  sidebar: {
    backgroundColor: '#ffffff',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 20,
  },
  sidebarContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  brand: {
    fontSize: 24,
    fontWeight: '900',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
  },
  menuContent: {
    flex: 1,
  },
  sectionTitle: {
    ...FONTS.labelMd,
    color: COLORS.outline,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 16,
  },
  menuText: {
    ...FONTS.bodyLg,
    color: COLORS.onSurface,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.surfaceContainer,
    marginVertical: 8,
    marginHorizontal: 12,
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.errorContainer,
    gap: 12,
    marginTop: 16,
  },
  logoutText: {
    ...FONTS.labelLg,
    fontWeight: '700',
  },
})
