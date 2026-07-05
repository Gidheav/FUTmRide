import { useState } from 'react'
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity } from 'react-native'
import { WebView } from 'react-native-webview'
import { safeWebViewProps } from '../services/safeWebViewConfig'

type Props = {
  url: string
  title?: string
  onClose?: () => void
}

export default function GenericWebPage({ url, title, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  return (
    <View style={styles.container}>
      {/* Header bar with optional close button */}
      {(title || onClose) && (
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Loading...'}</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Could not load page</Text>
          <Text style={styles.errorSubtitle}>Check your internet connection and try again.</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.errorBtn}>
              <Text style={styles.errorBtnText}>Go Back</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          {...safeWebViewProps}
          onLoadStart={() => { setLoading(true); setError(false) }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true) }}
        />
      )}

      {loading && !error && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6A1B9A" />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    zIndex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBtn: {
    marginTop: 16,
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
})
