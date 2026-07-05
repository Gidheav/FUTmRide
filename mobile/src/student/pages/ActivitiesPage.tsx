import { useState } from 'react'
import { StyleSheet, View, ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import { useExternalWebViewUrl } from '../services/externalConfig'
import { safeWebViewProps } from '../services/safeWebViewConfig'

export default function ActivitiesPage() {
  const [loading, setLoading] = useState(true)
  const targetUrl = useExternalWebViewUrl('activities_url')

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: targetUrl }}
        style={styles.webview}
        {...safeWebViewProps}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
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
})
