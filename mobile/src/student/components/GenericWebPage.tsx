import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity, ScrollView, RefreshControl, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { MaterialIcons } from '@expo/vector-icons'
import { safeWebViewProps } from '../services/safeWebViewConfig'
import { getAuthTokens } from '../../../utils/secureStorage'

type Props = {
  url: string
  title?: string
  onClose?: () => void
  enablePullToRefresh?: boolean
}

export default function GenericWebPage({ url, title, onClose, enablePullToRefresh }: Props) {
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('Check your internet connection and try again.')
  const [refreshing, setRefreshing] = useState(false)
  const [userToken, setUserToken] = useState<string | null>(null)
  const [tokenLoaded, setTokenLoaded] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const webviewRef = useRef<any | null>(null)

  useEffect(() => {
    getAuthTokens()
      .then((tokens) => {
        setUserToken(tokens?.accessToken || null)
        setTokenLoaded(true)
      })
      .catch(() => setTokenLoaded(true))
  }, [])

  useEffect(() => {
    setError(false)
    setErrorMessage('Check your internet connection and try again.')
    setRetryCount(0)
  }, [url])

  const handleHttpError = async (syntheticEvent: any) => {
    const { statusCode } = syntheticEvent.nativeEvent
    if (statusCode === 401 || statusCode === 403) {
      if (retryCount < 1) {
        setRetryCount((c) => c + 1)
        try {
          const { refreshStudentSessionTokens } = require('../../../core/session')
          const newTokens = await refreshStudentSessionTokens()
          setUserToken(newTokens.accessToken)
          setTimeout(() => {
            webviewRef.current?.reload()
          }, 100)
        } catch {
          setError(true)
          setErrorMessage('Session expired. Please log in again.')
          setRefreshing(false)
        }
      } else {
        setError(true)
        setErrorMessage('Session expired. Please log in again.')
        setRefreshing(false)
      }
      return
    }
    
    if (statusCode >= 500) {
      setError(true)
      setErrorMessage('Server error. Please try again later.')
      setRefreshing(false)
      return
    }

    setError(true)
    setErrorMessage('Could not load page. Please try again.')
    setRefreshing(false)
  }

  const handleNetworkError = () => {
    setError(true)
    setErrorMessage('Check your internet connection and try again.')
    setRefreshing(false)
  }

  const webviewSource = {
    uri: url,
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      ...(userToken ? { Authorization: `Bearer ${userToken}` } : {})
    }
  }

  const combinedJS = `
    ${userToken ? `window.localStorage.setItem('auth_token', '${userToken}'); window.userToken = '${userToken}';` : ''}
    ${safeWebViewProps.injectedJavaScript || ''}
  `

  const renderLoader = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#6A1B9A" />
    </View>
  )

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {(title || onClose) && (
        <View style={styles.header}>
          {onClose ? (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="arrow-back" size={22} color="#1a1c1c" />
            </TouchableOpacity>
          ) : <View style={styles.headerSpacer} />}
          
          <Text style={styles.headerTitle} numberOfLines={1}>{title || ''}</Text>
          
          {/* Invisible spacer to perfectly centre the title */}
          {onClose ? <View style={styles.headerSpacer} /> : <View style={styles.headerSpacer} />}
        </View>
      )}

      {!tokenLoaded ? (
        renderLoader()
      ) : error ? (
        <View style={styles.errorContainer}>
          <MaterialIcons name="wifi-off" size={48} color="#d1d5db" />
          <Text style={styles.errorTitle}>Could not load page</Text>
          <Text style={styles.errorSubtitle}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => { setError(false); setRetryCount(0); webviewRef.current?.reload() }} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Try Again</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.errorBackBtn}>
              <Text style={styles.errorBackBtnText}>Go Back</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        (enablePullToRefresh && Platform.OS === 'ios') ? (
          <ScrollView
            contentContainerStyle={{ flex: 1 }}
            refreshControl={(
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true)
                  webviewRef.current?.reload()
                }}
                tintColor="#6A1B9A"
              />
            )}
          >
            <WebView
              ref={webviewRef}
              source={webviewSource}
              style={styles.webview}
              {...safeWebViewProps}
              injectedJavaScript={combinedJS}
              startInLoadingState={true}
              renderLoading={renderLoader}
              onLoadStart={() => { setError(false) }}
              onLoadEnd={() => { setRefreshing(false) }}
              onHttpError={handleHttpError}
              onError={handleNetworkError}
            />
          </ScrollView>
        ) : (
          <WebView
            ref={webviewRef}
            source={webviewSource}
            style={styles.webview}
            {...safeWebViewProps}
            injectedJavaScript={combinedJS}
            pullToRefreshEnabled={enablePullToRefresh}
            startInLoadingState={true}
            renderLoading={renderLoader}
            onLoadStart={() => { setError(false) }}
            onHttpError={handleHttpError}
            onError={handleNetworkError}
          />
        )
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  headerTitle: {
    flex: 1,
    color: '#1a1c1c',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f1f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    gap: 10,
    backgroundColor: '#ffffff',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
    textAlign: 'center',
    marginTop: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBtn: {
    marginTop: 12,
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
  errorBackBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  errorBackBtnText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
})
