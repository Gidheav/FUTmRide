import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme'

type AppLockScreenProps = {
  hasPin: boolean
  biometricEnabled: boolean
  busy: boolean
  onUnlockPin: (pin: string) => void
  onUnlockBiometric: () => void
  onLogout: () => void
}

export default function AppLockScreen({
  hasPin,
  biometricEnabled,
  busy,
  onUnlockPin,
  onUnlockBiometric,
  onLogout,
}: AppLockScreenProps) {
  const [pin, setPin] = useState('')

  return (
    <View style={styles.container}>
      <View style={[styles.card, AMBIENT_SHADOW]}>
        <MaterialIcons name="lock" size={28} color={COLORS.primary} />
        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.subtitle}>Unlock to continue</Text>

        {hasPin ? (
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder="Enter PIN"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.buttonDisabled]}
              onPress={() => onUnlockPin(pin)}
              disabled={busy}
            >
              <Text style={styles.primaryButtonText}>Unlock</Text>
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
    gap: 10,
  },
  title: {
    ...FONTS.headlineMd,
    color: COLORS.onSurface,
  },
  subtitle: {
    ...FONTS.bodySm,
    color: COLORS.tertiary,
  },
  inputGroup: {
    width: '100%',
    gap: 10,
    marginTop: 8,
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
