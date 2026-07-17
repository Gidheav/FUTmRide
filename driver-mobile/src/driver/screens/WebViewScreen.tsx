import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme'
import { safeWebViewProps } from '../services/safeWebViewConfig'
import { getAuthTokens } from '../../../utils/secureStorage'
import { refreshDriverSessionTokens } from '../../core/session'

interface WebViewScreenProps {
  url: string
  title?: string
  onClose?: () => void
  enablePullToRefresh?: boolean
}

export default function WebViewScreen({ url, title, onClose, enablePullToRefresh = true }: WebViewScreenProps) {
  const insets = useSafeAreaInsets()
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('Check your internet connection and try again.')
  const [refreshing, setRefreshing] = useState(false)
  const [userToken, setUserToken] = useState<string | null>(null)
  const [tokenLoaded, setTokenLoaded] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [autoRetryCount, setAutoRetryCount] = useState(0)
  const webviewRef = useRef<any | null>(null)
  const autoRetryTimer = useRef<any>(null)

  useEffect(() => {
    getAuthTokens()
      .then((tokens: any) => {
        setUserToken(tokens?.accessToken || null)
        setTokenLoaded(true)
      })
      .catch(() => setTokenLoaded(true))
  }, [])

  useEffect(() => {
    setError(false)
    setErrorMessage('Check your internet connection and try again.')
    setRetryCount(0)
    setAutoRetryCount(0)
    if (autoRetryTimer.current) clearTimeout(autoRetryTimer.current)
  }, [url])

  useEffect(() => {
    return () => {
      if (autoRetryTimer.current) clearTimeout(autoRetryTimer.current)
    }
  }, [])

  const scheduleAutoRetry = () => {
    if (autoRetryTimer.current) clearTimeout(autoRetryTimer.current)
    autoRetryTimer.current = setTimeout(() => {
      setError(false)
      webviewRef.current?.reload()
    }, 3000)
  }

  const handleHttpError = async (syntheticEvent: any) => {
    const { statusCode } = syntheticEvent.nativeEvent
    if (statusCode === 401 || statusCode === 403) {
      if (retryCount < 1) {
        setRetryCount((c) => c + 1)
        try {
          const newTokens = await refreshDriverSessionTokens()
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
    if (autoRetryCount < 3) {
      setAutoRetryCount((c) => c + 1)
      scheduleAutoRetry()
      return
    }
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
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  )

  return (
    <View style={styles.container}>
      {(title || onClose) && (
        <View style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
          <View style={styles.headerContent}>
            {onClose ? (
              <TouchableOpacity onPress={onClose} style={styles.backButton} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialIcons name="arrow-back" size={24} color={COLORS.onSurface} />
              </TouchableOpacity>
            ) : <View style={styles.placeholder} />}
            <Text style={styles.title} numberOfLines={1}>
              {title || ''}
            </Text>
            {onClose ? <View style={styles.placeholder} /> : <View style={styles.placeholder} />}
          </View>
        </View>
      )}

      <View style={styles.content}>
        {!tokenLoaded ? (
          renderLoader()
        ) : error ? (
          <View style={styles.centerContainer}>
            <MaterialIcons name="wifi-off" size={48} color={COLORS.outline} />
            <Text style={styles.errorText}>Could not load page</Text>
            <Text style={styles.errorSubtitle}>{errorMessage}</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={() => {
                setError(false)
                setRetryCount(0)
                setAutoRetryCount(0)
                webviewRef.current?.reload()
              }}
            >
              <Text style={styles.retryText}>Try Again</Text>
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
                  tintColor={COLORS.primary}
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
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    ...FONTS.titleLg,
    color: COLORS.onSurface,
    marginTop: 16,
  },
  errorSubtitle: {
    ...FONTS.bodyMd,
    color: COLORS.onSurfaceVariant,
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
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
  errorBackBtn: {
    marginTop: 16,
    padding: 12,
  },
  errorBackBtnText: {
    ...FONTS.labelLg,
    color: COLORS.primary,
  },
})
