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
import type { StudentTab } from '../types'

type SidebarProps = {
  visible: boolean
  onClose: () => void
  onNavigate: (page: StudentTab) => void
}

export default function StudentSidebar({
  visible,
  onClose,
  onNavigate,
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
                <Text style={styles.brand}>FUTmRide</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.85}>
                  <MaterialIcons name="close" size={20} color="#5e5e5e" />
                </TouchableOpacity>
              </View>

              <View style={styles.menuGroup}>
                <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('about')} activeOpacity={0.85}>
                  <MaterialIcons name="info-outline" size={20} color="#6A1B9A" />
                  <Text style={styles.menuText}>About</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('activities')} activeOpacity={0.85}>
                  <MaterialIcons name="history" size={20} color="#6A1B9A" />
                  <Text style={styles.menuText}>My Activities</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('updates')} activeOpacity={0.85}>
                  <MaterialIcons name="system-update" size={20} color="#6A1B9A" />
                  <Text style={styles.menuText}>App Updates</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('events')} activeOpacity={0.85}>
                  <MaterialIcons name="event" size={20} color="#6A1B9A" />
                  <Text style={styles.menuText}>Events</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('news')} activeOpacity={0.85}>
                  <MaterialIcons name="article" size={20} color="#6A1B9A" />
                  <Text style={styles.menuText}>News</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('safety')} activeOpacity={0.85}>
                  <MaterialIcons name="security" size={20} color="#6A1B9A" />
                  <Text style={styles.menuText}>Safety Guide</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('support')} activeOpacity={0.85}>
                  <MaterialIcons name="help-outline" size={20} color="#6A1B9A" />
                  <Text style={styles.menuText}>Help & Support</Text>
                </TouchableOpacity>
              </View>
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
  menuGroup: {
    marginTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 6,
    gap: 12,
  },
  menuText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '600',
  },
})
