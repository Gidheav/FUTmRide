import React, { useEffect, useRef } from 'react'
import { Animated, PanResponder, StyleSheet, Text, View, Modal } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useToastStore } from '../../core/toastStore'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function GlobalToast() {
  const { message, type, hideToast } = useToastStore()
  const slideY = useRef(new Animated.Value(-150)).current
  const slideX = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const insets = useSafeAreaInsets()
  const topTarget = insets.top > 0 ? insets.top + 12 : 40

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: -150, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      slideX.setValue(0)
      opacity.setValue(1)
      hideToast()
    })
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10,
      onPanResponderMove: (_, g) => {
        slideX.setValue(g.dx)
        // Fade as it moves away
        const progress = Math.min(Math.abs(g.dx) / 120, 1)
        opacity.setValue(1 - progress * 0.6)
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 80 || g.vy < -0.5) {
          // Swipe far enough — dismiss
          Animated.parallel([
            Animated.timing(slideX, {
              toValue: g.dx > 0 ? 400 : -400,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => {
            slideX.setValue(0)
            opacity.setValue(1)
            hideToast()
          })
          if (timerRef.current) clearTimeout(timerRef.current)
        } else {
          // Snap back
          Animated.parallel([
            Animated.spring(slideX, { toValue: 0, useNativeDriver: true, friction: 6 }),
            Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start()
        }
      },
    })
  ).current

  useEffect(() => {
    if (message) {
      slideX.setValue(0)
      opacity.setValue(1)

      Animated.spring(slideY, {
        toValue: topTarget,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start()

      timerRef.current = setTimeout(dismiss, 4500)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    } else {
      slideY.setValue(-150)
    }
  }, [message, type])

  if (!message) return null

  const theme = {
    error:   { bg: '#fef2f2', border: '#fecaca', icon: '#ef4444', text: '#991b1b' },
    success: { bg: '#ecfdf5', border: '#d1fae5', icon: '#10b981', text: '#065f46' },
    info:    { bg: '#eff6ff', border: '#dbeafe', icon: '#3b82f6', text: '#1e40af' },
  }[type]

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY: slideY }, { translateX: slideX }],
          opacity,
          backgroundColor: theme.bg,
          borderColor: theme.border,
        },
      ]}
    >
      <MaterialIcons
        name={type === 'error' ? 'error-outline' : type === 'success' ? 'check-circle-outline' : 'info-outline'}
        size={22}
        color={theme.icon}
      />
      <Text style={[styles.toastText, { color: theme.text }]}>{message}</Text>
      <MaterialIcons name="drag-handle" size={16} color={theme.icon} style={{ opacity: 0.4 }} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 9999,
    zIndex: 9999,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
})
