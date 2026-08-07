import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme'
import LoadingOverlay from '../components/LoadingOverlay'

type AppLockScreenProps = {
  hasPin: boolean
  biometricEnabled: boolean
  busy: boolean
  errorMessage?: string
  statusMessage?: string
  onUnlockPin: (pin: string) => void
  onUnlockBiometric: () => void
  onRetry?: () => void
  onLogout: () => void
}

export default function AppLockScreen({
  hasPin,
  biometricEnabled,
  busy,
  errorMessage,
  statusMessage,
  onUnlockPin,
  onUnlockBiometric,
  onRetry,
  onLogout,
}: AppLockScreenProps) {
  const [pin, setPin] = useState('')
  const keypadRows = useMemo(() => ([
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'back'],
  ]), [])
  const PIN_MIN_LENGTH = 4
  const PIN_MAX_LENGTH = 4
  const [displayError, setDisplayError] = useState('')

  useEffect(() => {
    if (errorMessage) {
      setDisplayError(errorMessage)
      setPin('')
    }
  }, [errorMessage])

  useEffect(() => {
    if (displayError) {
      const timer = setTimeout(() => {
        setDisplayError('')
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [displayError])

  // Auto-trigger biometric prompt once when available and not busy
  const biometricTriggeredRef = useRef(false)
  useEffect(() => {
    if (!biometricEnabled) return
    if (biometricTriggeredRef.current) return
    if (busy) return
    biometricTriggeredRef.current = true
    const t = setTimeout(() => {
      onUnlockBiometric()
    }, 300)
    return () => clearTimeout(t)
  }, [biometricEnabled, busy, onUnlockBiometric])

  const submitPin = (value = pin) => {
    if (busy) return
    onUnlockPin(value)
  }

  const handleDigitPress = (digit: string) => {
    if (busy) return
    setDisplayError('')
    if (digit === 'back') {
      setPin((prev) => prev.slice(0, -1))
      return
    }
    if (!digit) return
    setPin((prev) => {
      if (prev.length >= PIN_MAX_LENGTH) return prev
      const next = `${prev}${digit}`
      if (next.length === PIN_MAX_LENGTH) {
        setTimeout(() => submitPin(next), 0)
      }
      return next
    })
  }

  return (
    <View style={styles.container}>
      {displayError ? (
        <View style={styles.floatingPill}>
          <MaterialIcons name="error-outline" size={18} color={COLORS.error} />
          <Text style={styles.pillText}>{displayError}</Text>
        </View>
      ) : null}
      <View style={[styles.card, AMBIENT_SHADOW]}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="lock" size={30} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.subtitle}>
          {statusMessage || 'Unlock to continue'}
        </Text>

        {hasPin ? (
          <View style={styles.pinPanel}>
            <View style={styles.dotRow}>
              {Array.from({ length: PIN_MAX_LENGTH }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.pinDot,
                    index < pin.length ? styles.pinDotFilled : styles.pinDotEmpty,
                  ]}
                />
              ))}
            </View>

            <View style={[styles.keypad, busy && styles.keypadDisabled]}>
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
                          style={({ pressed }) => [
                            styles.keypadBack,
                            pressed && styles.keypadPressed,
                          ]}
                          onPress={() => handleDigitPress('back')}
                          disabled={busy || pin.length === 0}
                        >
                          <MaterialIcons name="backspace" size={24} color={COLORS.onSurfaceVariant} />
                        </Pressable>
                      )
                    }
                    return (
                      <Pressable
                        key={`${item}-${rowIndex}`}
                        style={({ pressed }) => [
                          styles.keypadButton,
                          pressed && styles.keypadPressed,
                        ]}
                        onPress={() => handleDigitPress(item)}
                        disabled={busy}
                      >
                        <Text style={styles.keypadText}>{item}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              ))}
            </View>

            {/* Unlock is submitted automatically when PIN reaches required length */}
          </View>
        ) : null}

        {biometricEnabled ? (
          <TouchableOpacity
            style={[styles.secondaryButton, busy && styles.buttonDisabled]}
            onPress={onUnlockBiometric}
            disabled={busy}
          >
            <MaterialIcons name="fingerprint" size={18} color={COLORS.primary} />
            <Text style={styles.secondaryButtonText}>Use Biometrics</Text>
          </TouchableOpacity>
        ) : null}

        {/* Retry connection removed; connection retry handled elsewhere */}

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
      <LoadingOverlay visible={busy} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },
  card: {
    width: '94%',
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...FONTS.headlineMd,
    color: COLORS.onSurface,
  },
  subtitle: {
    ...FONTS.bodySm,
    color: COLORS.tertiary,
    textAlign: 'center',
  },
  floatingPill: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorContainer,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 100,
  },
  pillText: {
    ...FONTS.bodySm,
    color: COLORS.error,
    fontWeight: '600',
  },
  pinPanel: {
    width: '100%',
    alignItems: 'center',
    marginTop: 22,
    gap: 24,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 14,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  pinDotFilled: {
    backgroundColor: COLORS.primary,
  },
  pinDotEmpty: {
    backgroundColor: COLORS.surfaceContainerHighest,
  },
  keypad: {
    width: '100%',
    maxWidth: 360,
    gap: 20,
  },
  keypadDisabled: {
    opacity: 0.55,
  },
  keypadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  keypadButton: {
    width: '28%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadBack: {
    width: '28%',
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadEmpty: {
    width: '28%',
    aspectRatio: 1,
  },
  keypadText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  keypadPressed: {
    opacity: 0.78,
  },
  secondaryButton: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  secondaryButtonText: {
    ...FONTS.labelLg,
    color: COLORS.primary,
  },
  logoutButton: {
    marginTop: 8,
    paddingVertical: 8,
  },
  logoutText: {
    ...FONTS.bodySm,
    color: COLORS.error,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
})
