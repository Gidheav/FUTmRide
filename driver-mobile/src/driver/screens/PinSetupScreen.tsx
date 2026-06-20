import { useEffect, useMemo, useState } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { AMBIENT_SHADOW, COLORS, FONTS } from '../../core/theme'
import LoadingOverlay from '../components/LoadingOverlay'

type PinSetupScreenProps = {
  busy: boolean
  errorMessage?: string
  onSetPin: (pin: string) => void
  onLogout: () => void
}

export default function PinSetupScreen({
  busy,
  errorMessage,
  onSetPin,
  onLogout,
}: PinSetupScreenProps) {
  const [step, setStep] = useState<'create' | 'confirm'>('create')
  const [firstPin, setFirstPin] = useState('')
  const [pin, setPin] = useState('')
  const [displayError, setDisplayError] = useState('')

  const keypadRows = useMemo(() => ([
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'back'],
  ]), [])
  
  const PIN_MAX_LENGTH = 4

  useEffect(() => {
    if (errorMessage) {
      setDisplayError(errorMessage)
      setPin('')
      setFirstPin('')
      setStep('create')
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
        setTimeout(() => processPinComplete(next), 50)
      }
      return next
    })
  }

  const processPinComplete = (completePin: string) => {
    if (step === 'create') {
      setFirstPin(completePin)
      setPin('')
      setStep('confirm')
    } else {
      if (completePin === firstPin) {
        onSetPin(completePin)
      } else {
        setDisplayError('PINs do not match. Please try again.')
        setFirstPin('')
        setPin('')
        setStep('create')
      }
    }
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
          <MaterialIcons name="admin-panel-settings" size={30} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>
          {step === 'create' ? 'Secure Driver App' : 'Confirm PIN'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'create'
            ? 'Set a 4-digit PIN before opening your driver workspace.'
            : 'Please re-enter your 4-digit PIN.'}
        </Text>

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
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout} disabled={busy}>
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
  logoutButton: {
    marginTop: 8,
    paddingVertical: 8,
  },
  logoutText: {
    ...FONTS.bodySm,
    color: COLORS.error,
  },
})
