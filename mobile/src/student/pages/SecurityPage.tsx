import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import { MaterialIcons } from '@expo/vector-icons'
import { clearStoredPinHash, getStoredPinHash, hashPin, setStoredPinHash } from '../../core/security'
import { useSecurityStore } from '../../core/securityStore'
import LoadingOverlay from '../components/LoadingOverlay'

const TIMEOUT_OPTIONS: Array<{ label: string; value: 0 | 1 | 5 | 15 }> = [
  { label: 'Immediate', value: 0 },
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
]

type SecurityPageProps = {
  onClose: () => void
  openPinOnLoad?: boolean
  skipCurrentPin?: boolean
}

export default function SecurityPage({ onClose, openPinOnLoad, skipCurrentPin }: SecurityPageProps) {
  const {
    appLockEnabled,
    biometricEnabled,
    lockTimeoutMinutes,
    setAppLockEnabled,
    setBiometricEnabled,
    setLockTimeoutMinutes,
    hasPin,
    setHasPin,
  } = useSecurityStore()

  const [loading, setLoading] = useState(true)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [error, setError] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState('')
  const [pinModalVisible, setPinModalVisible] = useState(false)
  const [pinAction, setPinAction] = useState<'set' | 'update' | 'remove'>('set')
  const [pinStep, setPinStep] = useState<'current' | 'new' | 'confirm'>('new')
  const [pinInput, setPinInput] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [currentPinInput, setCurrentPinInput] = useState('')
  const [timeoutModalVisible, setTimeoutModalVisible] = useState(false)
  const [didAutoOpenPin, setDidAutoOpenPin] = useState(false)
  const pinCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keypadRows = useMemo(() => ([
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'back'],
  ]), [])

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const [storedPin, hasHardware, enrolled] = await Promise.all([
          getStoredPinHash(),
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ])
        if (isMounted) {
          setHasPin(Boolean(storedPin))
          setBiometricAvailable(hasHardware && enrolled)
        }
      } catch (err) {
        if (isMounted) {
          setHasPin(false)
          setBiometricAvailable(false)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [setHasPin])

  useEffect(() => {
    if (!openPinOnLoad || didAutoOpenPin) return
    openPinModal(Boolean(skipCurrentPin))
    setDidAutoOpenPin(true)
  }, [openPinOnLoad, didAutoOpenPin, skipCurrentPin])

  useEffect(() => {
    if (!openPinOnLoad) {
      setDidAutoOpenPin(false)
    }
  }, [openPinOnLoad])


  const handleToggleLock = (value: boolean) => {
    if (!value) {
      setAppLockEnabled(false)
      setError('')
      return
    }

    if (!hasPin && !biometricEnabled) {
      setError('')
      openPinModal(true, 'set')
      return
    }
    setError('')
    setAppLockEnabled(true)
  }

  const handleToggleBiometric = async (value: boolean) => {
    if (value && !biometricAvailable) {
      setError('Biometrics are not available on this device.')
      return
    }
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm device owner to enable biometric unlock',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use PIN',
      })
      if (!result.success) {
        setError('Biometric verification failed.')
        return
      }
    }
    setError('')
    setBiometricEnabled(value)
    if (value) {
      setAppLockEnabled(true)
      return
    }
    if (!value && appLockEnabled && !hasPin) {
      setAppLockEnabled(false)
    }
  }

  const openPinModal = (forceNew = false, action?: 'set' | 'update' | 'remove') => {
    setError('')
    setPinError('')
    setPinSuccess('')
    const resolvedAction = action ?? (hasPin ? 'update' : 'set')
    setPinAction(resolvedAction)
    if (resolvedAction === 'remove') {
      setPinStep('current')
    } else {
      setPinStep(forceNew ? 'new' : hasPin ? 'current' : 'new')
    }
    setPinInput('')
    setPinConfirm('')
    setCurrentPinInput('')
    setPinModalVisible(true)
  }

  const resolvePinComplete = async (value: string) => {
    if (pinStep === 'current') {
      const storedHash = await getStoredPinHash()
      if (!storedHash) {
        setPinError('No PIN is set yet.')
        setPinStep('new')
        setCurrentPinInput('')
        return
      }
      const currentHash = await hashPin(value)
      if (currentHash !== storedHash) {
        setPinError('Incorrect current PIN.')
        setCurrentPinInput('')
        return
      }
      if (pinAction === 'remove') {
        await clearStoredPinHash()
        setHasPin(false)
        if (!biometricEnabled) {
          setAppLockEnabled(false)
        }
        setPinError('')
        setPinSuccess('PIN removed.')
        if (pinCloseTimer.current) {
          clearTimeout(pinCloseTimer.current)
        }
        pinCloseTimer.current = setTimeout(() => {
          setPinModalVisible(false)
          setPinSuccess('')
        }, 900)
        return
      }
      setPinError('')
      setPinStep('new')
      setPinInput('')
      return
    }

    if (pinStep === 'new') {
      setPinError('')
      setPinStep('confirm')
      setPinConfirm('')
      return
    }

    if (pinInput !== value) {
      setPinError('PINs do not match.')
      setPinConfirm('')
      return
    }

    await setStoredPinHash(pinInput)
    setHasPin(true)
    setAppLockEnabled(true)
    setPinError('')
    setPinSuccess(pinAction === 'update' ? 'PIN updated successfully.' : 'PIN saved successfully.')
    if (pinCloseTimer.current) {
      clearTimeout(pinCloseTimer.current)
    }
    pinCloseTimer.current = setTimeout(() => {
      setPinModalVisible(false)
      setPinSuccess('')
    }, 900)
  }

  const handleDigitPress = async (digit: string) => {
    if (!digit) return
    if (digit === 'back') {
      if (pinStep === 'current') {
        setCurrentPinInput((prev) => prev.slice(0, -1))
      } else if (pinStep === 'new') {
        setPinInput((prev) => prev.slice(0, -1))
      } else {
        setPinConfirm((prev) => prev.slice(0, -1))
      }
      return
    }
    setPinError('')
    const activeValue = pinStep === 'current' ? currentPinInput : pinStep === 'new' ? pinInput : pinConfirm
    if (activeValue.length >= 4) return
    const nextValue = `${activeValue}${digit}`
    if (pinStep === 'current') {
      setCurrentPinInput(nextValue)
    } else if (pinStep === 'new') {
      setPinInput(nextValue)
    } else {
      setPinConfirm(nextValue)
    }
    if (nextValue.length === 4) {
      await resolvePinComplete(nextValue)
    }
  }

  const handleClearPin = async () => {
    await clearStoredPinHash()
    setHasPin(false)
    if (!biometricEnabled) {
      setAppLockEnabled(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.page}>
        <LoadingOverlay visible={true} inline size={40} />
      </View>
    )
  }

  const selectedTimeout = TIMEOUT_OPTIONS.find((item) => item.value === lockTimeoutMinutes)
  const lockControlsDisabled = !appLockEnabled

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={onClose} activeOpacity={0.85}>
          <MaterialIcons name="chevron-left" size={22} color="#6A1B9A" />
        </TouchableOpacity>
        <Text style={styles.title}>Security</Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>App Lock</Text>
          <Text style={styles.sectionSubtitle}>Protect the app with a PIN or biometrics.</Text>
        </View>

        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Enable App Lock</Text>
            <Text style={styles.rowSubtitle}>Require unlock before app access.</Text>
          </View>
          <Switch value={appLockEnabled} onValueChange={handleToggleLock} />
        </View>

        <View style={[styles.row, lockControlsDisabled && styles.rowDisabled]}>
          <View>
            <Text style={styles.rowTitle}>Biometric Unlock</Text>
            <Text style={styles.rowSubtitle}>Use fingerprint or face unlock.</Text>
          </View>
          <Switch value={biometricEnabled} onValueChange={handleToggleBiometric} disabled={lockControlsDisabled} />
        </View>

        <View style={[styles.actionRow, lockControlsDisabled && styles.rowDisabled]}>
          <View>
            <Text style={styles.rowTitle}>App PIN</Text>
            <Text style={styles.rowSubtitle}>4-digit PIN for quick access.</Text>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, lockControlsDisabled && styles.actionButtonDisabled]}
              onPress={() => openPinModal(false, hasPin ? 'update' : 'set')}
              activeOpacity={0.85}
              disabled={lockControlsDisabled}
            >
              <Text style={styles.actionText}>{hasPin ? 'Update' : 'Set'}</Text>
            </TouchableOpacity>
            {hasPin ? (
              <TouchableOpacity
                style={[styles.actionButton, lockControlsDisabled && styles.actionButtonDisabled]}
                onPress={() => openPinModal(false, 'remove')}
                activeOpacity={0.85}
                disabled={lockControlsDisabled}
              >
                <Text style={styles.actionDanger}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.selectorRow, lockControlsDisabled && styles.rowDisabled]}
          onPress={() => setTimeoutModalVisible(true)}
          activeOpacity={0.85}
          disabled={lockControlsDisabled}
        >
          <View>
            <Text style={styles.rowTitle}>Auto-lock</Text>
            <Text style={styles.rowSubtitle}>Choose when to lock the app.</Text>
          </View>
          <View style={styles.selectorRight}>
            <Text style={styles.selectorValue}>{selectedTimeout?.label || 'Select'}</Text>
            <MaterialIcons name="expand-more" size={20} color="#6b7280" />
          </View>
        </TouchableOpacity>
      </View>

      <Modal visible={pinModalVisible} animationType="fade" transparent onRequestClose={() => setPinModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pinAction === 'remove'
                ? 'Remove PIN'
                : pinStep === 'current'
                  ? 'Verify Current PIN'
                  : pinStep === 'new'
                    ? 'Set PIN'
                    : 'Confirm PIN'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {pinAction === 'remove'
                ? 'Enter your current PIN to remove it.'
                : pinStep === 'current'
                  ? 'Enter your existing 4-digit PIN.'
                  : pinStep === 'new'
                    ? 'Create a new 4-digit PIN.'
                    : 'Re-enter your new PIN to confirm.'}
            </Text>

            <View style={styles.modalStatus}>
              {pinError ? <Text style={styles.modalError}>{pinError}</Text> : null}
              {!pinError && pinSuccess ? <Text style={styles.modalSuccess}>{pinSuccess}</Text> : null}
            </View>

            <View style={styles.dotRow}>
              {[0, 1, 2, 3].map((index) => {
                const activeValue =
                  pinStep === 'current' ? currentPinInput : pinStep === 'new' ? pinInput : pinConfirm
                return (
                  <View
                    key={`pin-dot-${index}`}
                    style={index < activeValue.length ? styles.dotFilled : styles.dotEmpty}
                  />
                )
              })}
            </View>

            <View style={styles.keypad}>
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

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setPinModalVisible(false)
                setPinError('')
                setPinSuccess('')
                if (pinCloseTimer.current) {
                  clearTimeout(pinCloseTimer.current)
                  pinCloseTimer.current = null
                }
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={timeoutModalVisible} animationType="fade" transparent onRequestClose={() => setTimeoutModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Auto-lock</Text>
            <ScrollView style={styles.modalScroll}>
              {TIMEOUT_OPTIONS.map((option) => {
                const selected = lockTimeoutMinutes === option.value
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.modalRow}
                    onPress={() => {
                      setLockTimeoutMinutes(option.value)
                      setTimeoutModalVisible(false)
                    }}
                  >
                    <View style={styles.radioOuter}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={styles.modalRowText}>{option.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setTimeoutModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3e5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  errorText: {
    color: '#ba1a1a',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eeeeee',
    padding: 16,
    gap: 16,
  },
  sectionHeader: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionButton: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    backgroundColor: 'transparent',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionText: {
    color: '#6A1B9A',
    fontWeight: '600',
  },
  actionDanger: {
    color: '#ba1a1a',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f3f3',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectorValue: {
    color: '#1a1c1c',
    fontWeight: '600',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#6A1B9A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6A1B9A',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  modalScroll: {
    maxHeight: 280,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  modalRowText: {
    fontSize: 14,
    color: '#1a1c1c',
  },
  modalStatus: {
    minHeight: 18,
    justifyContent: 'center',
  },
  modalError: {
    color: '#ba1a1a',
    fontSize: 12,
    fontWeight: '600',
  },
  modalSuccess: {
    color: '#1b7a3d',
    fontSize: 12,
    fontWeight: '600',
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  dotFilled: {
    width: 20,
    height: 20,
    borderRadius: 100,
    backgroundColor: '#6A1B9A',
  },
  dotEmpty: {
    width: 20,
    height: 20,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#d2c1df',
    backgroundColor: '#f9f7fb',
  },
  keypad: {
    gap: 12,
    marginTop: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  keypadButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#f5f0f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  keypadPressed: {
    opacity: 0.8,
  },
  keypadBack: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadEmpty: {
    flex: 1,
    height: 56,
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalCancelText: {
    color: '#6A1B9A',
    fontWeight: '600',
  },
})
