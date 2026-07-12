import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AppState,
  type AppStateStatus,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import { MaterialIcons } from '@expo/vector-icons'
import { getStoredPinHash, hashPin } from '../../core/security'
import { useSecurityStore } from '../../core/securityStore'
import { kickoffProactiveRefresh } from '../../core/session'
import LoadingOverlay from '../components/LoadingOverlay'

type AppLockProps = {
  onUnlocked: () => void
  onForgotPin?: () => void
}

export default function AppLockPage({ onUnlocked, onForgotPin }: AppLockProps) {
  const { biometricEnabled, hasPin } = useSecurityStore()
  const [pin, setPin] = useState('')
  const [pinHash, setPinHash] = useState<string | null>(null)
  const [pinHashReady, setPinHashReady] = useState(false)
  const [error, setError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [finishingUnlock, setFinishingUnlock] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [pinAttempts, setPinAttempts] = useState(0)
  const [biometricAttempts, setBiometricAttempts] = useState(0)
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState)
  const didAutoPromptBiometric = useRef(false)
  const keypadRows = useMemo(() => ([
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'back'],
  ]), [])

  const MAX_PIN_ATTEMPTS = 5
  const MAX_BIOMETRIC_ATTEMPTS = 3
  const LOCKOUT_DURATION_SECONDS = 30

  const isLockedOut = lockoutUntil ? Date.now() < lockoutUntil : false

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  useEffect(() => {
    let isMounted = true
    const loadPinHash = async () => {
      try {
        const storedHash = await getStoredPinHash()
        if (isMounted) {
          setPinHash(storedHash)
        }
      } catch (err) {
        if (isMounted) {
          setPinHash(null)
        }
      } finally {
        if (isMounted) setPinHashReady(true)
      }
    }

    const loadBiometricAvailability = async () => {
      if (!biometricEnabled) return
      try {
        const [hasHardware, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ])
        if (isMounted) {
          setBiometricAvailable(hasHardware && enrolled)
        }
      } catch {
        if (isMounted) {
          setBiometricAvailable(false)
        }
      }
    }

    void loadPinHash()
    void loadBiometricAvailability()
    return () => {
      isMounted = false
    }
  }, [biometricEnabled])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState)
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    if (!lockoutUntil) return
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000))
      setLockoutSeconds(remaining)
      if (remaining === 0) {
        setLockoutUntil(null)
        setError('')
      }
    }
    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [lockoutUntil])

  const startLockout = () => {
    const until = Date.now() + LOCKOUT_DURATION_SECONDS * 1000
    setLockoutUntil(until)
    setLockoutSeconds(LOCKOUT_DURATION_SECONDS)
    setPinAttempts(0)
    setBiometricAttempts(0)
  }

  const finishUnlock = () => {
    setFinishingUnlock(true)
    // Fire token refresh in background — don't block unlock
    kickoffProactiveRefresh()?.catch(() => {})
    // Unlock immediately — the 401 interceptor handles stale tokens
    onUnlocked()
  }

  const handleUnlock = async (value: string) => {
    if (!pinHashReady) {
      return
    }
    if (!pinHash) {
      setError('PIN is not set. Please set a PIN in Security settings.')
      return
    }
    if (isLockedOut) {
      setError(`Too many attempts. Try again in ${formatCountdown(lockoutSeconds)}.`)
      return
    }
    if (value.length !== 4) return
    setUnlocking(true)
    try {
      const inputHash = await hashPin(value)
      if (inputHash !== pinHash) {
        const nextAttempts = pinAttempts + 1
        if (nextAttempts >= MAX_PIN_ATTEMPTS) {
          setError('Too many attempts. Please wait a moment.')
          startLockout()
        } else {
          setError(`Incorrect PIN. ${MAX_PIN_ATTEMPTS - nextAttempts} tries left.`)
        }
        setPinAttempts(nextAttempts)
        setPin('')
        return
      }
      setError('')
      setPinAttempts(0)
      finishUnlock()
    } finally {
      setUnlocking(false)
    }
  }

  const handleBiometric = async () => {
    setError('')
    if (!biometricAvailable || !biometricEnabled) {
      setError('Biometric unlock is not available.')
      return
    }
    if (isLockedOut) {
      setError(`Too many attempts. Try again in ${formatCountdown(lockoutSeconds)}.`)
      return
    }
    setUnlocking(true)
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock LR Ride',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use PIN',
      })
      if (res.success) {
        setBiometricAttempts(0)
        finishUnlock()
      } else {
        const errorCode = (res as { error?: string }).error
        if (errorCode === 'user_cancel' || errorCode === 'system_cancel' || errorCode === 'app_cancel') {
          return
        }
        const nextAttempts = biometricAttempts + 1
        if (nextAttempts >= MAX_BIOMETRIC_ATTEMPTS) {
          setError('Too many attempts. Please wait a moment.')
          startLockout()
        } else {
          setError(`Biometric failed. ${MAX_BIOMETRIC_ATTEMPTS - nextAttempts} tries left.`)
        }
        setBiometricAttempts(nextAttempts)
      }
    } finally {
      setUnlocking(false)
    }
  }

  useEffect(() => {
    if (
      unlocking ||
      finishingUnlock ||
      isLockedOut ||
      didAutoPromptBiometric.current ||
      appState !== 'active' ||
      !biometricEnabled ||
      !biometricAvailable
    ) {
      return
    }

    didAutoPromptBiometric.current = true
    void handleBiometric()
  }, [appState, biometricAvailable, biometricEnabled, finishingUnlock, isLockedOut, unlocking])

  const handleDigitPress = (digit: string) => {
    if (isLockedOut || unlocking || finishingUnlock || !pinHashReady) return
    if (digit === 'back') {
      setPin((prev) => prev.slice(0, -1))
      return
    }
    if (!digit) return
    setError('')
    setPin((prev) => {
      if (prev.length >= 4) return prev
      const next = `${prev}${digit}`
      if (next.length === 4) {
        void handleUnlock(next)
      }
      return next
    })
  }



  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="shield" size={64} color="#6A1B9A" />
          <View style={styles.iconLockBadge}>
            <MaterialIcons name="lock" size={14} color="#6A1B9A" />
          </View>
        </View>

        <Text style={styles.title}>Unlock App</Text>
        <Text style={styles.subtitle}>Enter your 4-digit PIN to continue</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {isLockedOut ? (
          <Text style={styles.lockoutText}>Try again in {formatCountdown(lockoutSeconds)}</Text>
        ) : null}

        <View style={styles.dotRow}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={index < pin.length ? styles.dotFilled : styles.dotEmpty}
            />
          ))}
        </View>

        <View style={[styles.keypad, isLockedOut && styles.keypadDisabled]}>
          {keypadRows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.keypadRow}>
              {row.map((item, index) => {
                if (!item) {
                  return <View key={`empty-${rowIndex}-${index}`} style={styles.keypadEmpty} />
                }
                if (item === 'back') {
                  return (
                    <Pressable
                      key="back"
                      style={({ pressed }) => [styles.keypadBack, pressed && styles.keypadPressed]}
                      onPress={() => handleDigitPress('back')}
                    >
                      <MaterialIcons name="backspace" size={26} color="#3d4a3e" />
                    </Pressable>
                  )
                }
                return (
                  <Pressable
                    key={`${item}-${rowIndex}`}
                    style={({ pressed }) => [styles.keypadButton, pressed && styles.keypadPressed]}
                    onPress={() => handleDigitPress(item)}
                  >
                    <Text style={styles.keypadText}>{item}</Text>
                  </Pressable>
                )
              })}
            </View>
          ))}
        </View>

        {biometricEnabled && biometricAvailable ? (
          <TouchableOpacity style={styles.biometricButton} onPress={handleBiometric} activeOpacity={0.9}>
            <MaterialIcons name="fingerprint" size={30} color="#6A1B9A" />
            <Text style={styles.biometricText}>Use Biometrics</Text>
          </TouchableOpacity>
        ) : null}

        <Pressable onPress={onForgotPin} disabled={!onForgotPin}>
          <Text style={styles.forgotText}>Forgot PIN?</Text>
        </Pressable>
      </View>
      <LoadingOverlay visible={finishingUnlock} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 20,
  },
  header: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6A1B9A',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  iconWrap: {
    width: 80,
    height: 62,
    borderRadius: 40,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  iconLockBadge: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    bottom: 18,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1c1c',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#3d4a3e',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  errorText: {
    color: '#ba1a1a',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  lockoutText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  dotFilled: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6A1B9A',
  },
  dotEmpty: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e2e2e2',
  },
  keypad: {
    width: '100%',
    maxWidth: 300,
    gap: 20,
    marginBottom: 24,
  },
  keypadDisabled: {
    opacity: 0.6,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keypadButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadBack: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadEmpty: {
    width: 60,
    height: 60,
  },
  keypadText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  keypadPressed: {
    opacity: 0.8,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f3f3',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 16,
  },
  biometricText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  forgotText: {
    fontSize: 12,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
})
