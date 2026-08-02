import React from 'react'
import { StyleSheet, View, ViewStyle, Platform } from 'react-native'
import { BlurView } from 'expo-blur'

interface GlassCardProps {
  children: React.ReactNode
  style?: ViewStyle
  intensity?: number
  tint?: 'light' | 'dark' | 'default'
  blurRadius?: number
}

export default function GlassCard({
  children,
  style,
  intensity = 60,
  tint = 'light',
}: GlassCardProps) {
  // On Android, BlurView can sometimes be heavy or unsupported in certain contexts.
  // Using an overlay background on Android helps.
  const isAndroid = Platform.OS === 'android'

  return (
    <View style={[styles.container, style]}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill}>
        {isAndroid && (
          <View style={[
            StyleSheet.absoluteFill,
            { backgroundColor: tint === 'dark' ? 'rgba(15,15,20,0.65)' : 'rgba(255,255,255,0.72)' }
          ]} />
        )}
      </BlurView>
      <View style={[
        styles.inner,
        {
          borderColor: tint === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)',
        }
      ]}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6A1B9A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 8, // For Android shadow
  },
  inner: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
})
