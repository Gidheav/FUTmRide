import { useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { AMBIENT_SHADOW, COLORS, FONTS } from '../../core/theme'

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
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [localError, setLocalError] = useState('')

  const submit = () => {
    if (!pin || pin.length < 4) {
      setLocalError('Enter a 4 to 6 digit PIN.')
      return
    }
    if (!/^\d+$/.test(pin)) {
      setLocalError('PIN must contain numbers only.')
      return
    }
    if (pin !== confirmPin) {
      setLocalError('PINs do not match.')
      return
    }
    setLocalError('')
    onSetPin(pin)
  }

  return (
    <View style={styles.container}>
      <View style={[styles.card, AMBIENT_SHADOW]}>
        <MaterialIcons name="admin-panel-settings" size={30} color={COLORS.primary} />
        <Text style={styles.title}>Secure Driver App</Text>
        <Text style={styles.subtitle}>Set a PIN before opening your driver workspace.</Text>

        {localError || errorMessage ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={17} color={COLORS.error} />
            <Text style={styles.errorText}>{localError || errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            placeholder="New PIN"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            value={confirmPin}
            onChangeText={setConfirmPin}
            placeholder="Confirm PIN"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            editable={!busy}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, busy && styles.buttonDisabled]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator size="small" color={COLORS.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>Set PIN & Unlock</Text>
          )}
        </TouchableOpacity>

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
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 24,
    alignItems: 'center',
    gap: 12,
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
  inputGroup: {
    width: '100%',
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHighest,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.surfaceContainerLowest,
    color: COLORS.onSurface,
    textAlign: 'center',
    fontSize: 16,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...FONTS.labelLg,
    color: COLORS.onPrimary,
  },
  logoutButton: {
    paddingVertical: 8,
  },
  logoutText: {
    ...FONTS.bodySm,
    color: COLORS.error,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
})
