import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme'

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
  const PIN_MAX_LENGTH = 6
  const canSubmitPin = hasPin && pin.length >= PIN_MIN_LENGTH && !busy

  useEffect(() => {
    if (errorMessage) {
      setPin('')
    }
  }, [errorMessage])

  const submitPin = (value = pin) => {
    if (busy) return
    onUnlockPin(value)
  }

  const handleDigitPress = (digit: string) => {
    if (busy) return
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
      <View style={[styles.card, AMBIENT_SHADOW]}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="lock" size={30} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.subtitle}>
          {statusMessage || 'Unlock online to continue'}
        </Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="wifi-off" size={17} color={COLORS.error} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

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

            <TouchableOpacity
              style={[styles.primaryButton, !canSubmitPin && styles.buttonDisabled]}
              onPress={() => submitPin()}
              disabled={!canSubmitPin}
            >
              {busy ? (
                <ActivityIndicator size="small" color={COLORS.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Unlock</Text>
              )}
            </TouchableOpacity>
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

        {onRetry ? (
          <TouchableOpacity
            style={[styles.retryButton, busy && styles.buttonDisabled]}
            onPress={onRetry}
            disabled={busy}
          >
            <MaterialIcons name="refresh" size={17} color={COLORS.primary} />
            <Text style={styles.secondaryButtonText}>Retry Connection</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
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
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  errorBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: COLORS.errorContainer,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    ...FONTS.bodySm,
    color: COLORS.error,
    flex: 1,
  },
  pinPanel: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pinDotFilled: {
    backgroundColor: COLORS.primary,
  },
  pinDotEmpty: {
    backgroundColor: COLORS.surfaceContainerHighest,
  },
  keypad: {
    width: '100%',
    maxWidth: 300,
    gap: 14,
  },
  keypadDisabled: {
    opacity: 0.55,
  },
  keypadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  keypadButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadBack: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadEmpty: {
    width: 62,
    height: 62,
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
  primaryButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...FONTS.labelLg,
    color: COLORS.onPrimary,
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
  retryButton: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceContainerLow,
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
