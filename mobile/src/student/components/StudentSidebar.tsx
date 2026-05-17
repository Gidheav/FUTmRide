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

type SidebarProps = {
  visible: boolean
  onClose: () => void
  onLogout: () => void
}

export default function StudentSidebar({
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
                <Text style={styles.brand}>LR Ride</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.85}>
                  <MaterialIcons name="close" size={20} color="#5e5e5e" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.menuItem} onPress={onLogout} activeOpacity={0.85}>
                <MaterialIcons name="logout" size={20} color="#ba1a1a" />
                <Text style={styles.logoutText}>Sign Out</Text>
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
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brand: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6A1B9A',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f3f3',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
    gap: 10,
  },
  logoutText: {
    fontSize: 15,
    color: '#ba1a1a',
    fontWeight: '700',
  },
})
