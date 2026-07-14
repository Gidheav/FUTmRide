import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme'

interface WebViewScreenProps {
  url: string
  title: string
  onClose: () => void
}

export default function WebViewScreen({ url, title, onClose }: WebViewScreenProps) {
  const insets = useSafeAreaInsets()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={onClose} style={styles.backButton} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      {/* WebView Content */}
      <View style={styles.content}>
        {error ? (
          <View style={styles.centerContainer}>
            <MaterialIcons name="error-outline" size={48} color={COLORS.error} />
            <Text style={styles.errorText}>Failed to load content.</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={() => {
                setError(false)
                setIsLoading(true)
              }}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            source={{ uri: url }}
            style={styles.webview}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false)
              setError(true)
            }}
            bounces={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={false}
          />
        )}
        
        {/* Loading Indicator Overlay */}
        {isLoading && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceContainer,
    ...AMBIENT_SHADOW,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 64,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
  },
  title: {
    ...FONTS.titleMd,
    color: COLORS.onSurface,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    ...FONTS.bodyLg,
    color: COLORS.onSurfaceVariant,
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    ...FONTS.labelLg,
    color: '#ffffff',
  },
})
