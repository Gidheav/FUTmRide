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
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEffect, useRef, useState } from 'react'
import { COLORS, FONTS } from '../../core/theme'

type SidebarProps = {
  visible: boolean
  onClose: () => void
  onLogout: () => void
}

export default function DriverSidebar({
  visible,
  onClose,
  onLogout,
}: SidebarProps) {
  const [isVisible, setIsVisible] = useState(visible)
  const { width } = Dimensions.get('window')
  const sidebarWidth = Math.min(width * 0.76, 320)
  const translateX = useRef(new Animated.Value(-sidebarWidth)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()

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
                {/* Menu items can be added here */}
              </View>

              <TouchableOpacity style={styles.menuItem} onPress={onLogout} activeOpacity={0.85}>
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
    backgroundColor: '#f3f3f3',
  },
  menuContent: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fff5f5',
    gap: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
  },
})
