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
import api from '../../core/api'
import { refreshTransactionPinStatus } from '../../core/transactionPin'
import { saveStudentSessionSnapshotFromStores } from '../../core/session'

const TIMEOUT_OPTIONS: Array<{ label: string; value: -1 | 0 | 0.25 | 0.5 | 1 | 5 | 15 | 30 }> = [
  { label: 'None (Disabled)', value: -1 },
  { label: 'Immediate', value: 0 },
  { label: '15 seconds', value: 0.25 },
  { label: '30 seconds', value: 0.5 },
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
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
    setLocked,
    hasPin,
    setHasPin,
    hasTransactionPin,
    transactionPinStatus,
    setHasTransactionPin,
    setTransactionPinStatus,
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

  const [txPinModalVisible, setTxPinModalVisible] = useState(false)
  const [txPinAction, setTxPinAction] = useState<'set' | 'update'>('set')
  const [txPinStep, setTxPinStep] = useState<'current' | 'new' | 'confirm'>('new')
  const [txPinInput, setTxPinInput] = useState('')
  const [txPinConfirm, setTxPinConfirm] = useState('')
  const [currentTxPinInput, setCurrentTxPinInput] = useState('')
  const [txPinError, setTxPinError] = useState('')
  const [txPinSuccess, setTxPinSuccess] = useState('')
  const [txPinLoading, setTxPinLoading] = useState(false)

  // Forgot TX PIN (OTP reset) state
  const [pinResetModalVisible, setPinResetModalVisible] = useState(false)
  const [pinResetStep, setPinResetStep] = useState<'request' | 'confirm'>('request')
  const [pinResetOtp, setPinResetOtp] = useState('')
  const [pinResetNewPin, setPinResetNewPin] = useState('')
  const [pinResetConfirm, setPinResetConfirm] = useState('')
  const [pinResetError, setPinResetError] = useState('')
  const [pinResetSuccess, setPinResetSuccess] = useState('')
  const [pinResetLoading, setPinResetLoading] = useState(false)

  const [timeoutModalVisible, setTimeoutModalVisible] = useState(false)
  const [didAutoOpenPin, setDidAutoOpenPin] = useState(false)
  const pinCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const txPinCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    void refreshTransactionPinStatus().catch(() => {
      // The transaction section renders an explicit retry state.
    })
  }, [])

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
      setLockTimeoutMinutes(-1)
      void saveStudentSessionSnapshotFromStores()
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
    if (lockTimeoutMinutes === -1) {
      setLockTimeoutMinutes(0.25)
    }
    void saveStudentSessionSnapshotFromStores()
  }

  const handleLockTimeoutSelect = (value: -1 | 0 | 0.25 | 0.5 | 1 | 5 | 15 | 30) => {
    setLockTimeoutMinutes(value)
    if (value === -1) {
      setAppLockEnabled(false)
      setLocked(false)
    } else {
      setAppLockEnabled(true)
    }
    void saveStudentSessionSnapshotFromStores()
    setTimeoutModalVisible(false)
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
      void saveStudentSessionSnapshotFromStores()
      return
    }
    if (!value && appLockEnabled && !hasPin) {
      setAppLockEnabled(false)
    }
    void saveStudentSessionSnapshotFromStores()
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
        void saveStudentSessionSnapshotFromStores()
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
    if (!appLockEnabled || lockTimeoutMinutes === -1) {
      setLockTimeoutMinutes(0.25)
    }
    void saveStudentSessionSnapshotFromStores()
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
    void saveStudentSessionSnapshotFromStores()
  }

  const openTxPinModal = (action: 'set' | 'update') => {
    setTxPinError('')
    setTxPinSuccess('')
    setTxPinAction(action)
    setTxPinStep(action === 'update' ? 'current' : 'new')
    setTxPinInput('')
    setTxPinConfirm('')
    setCurrentTxPinInput('')
    setTxPinModalVisible(true)
  }

  const openPinResetModal = () => {
    setTxPinModalVisible(false)
    setPinResetStep('request')
    setPinResetOtp('')
    setPinResetNewPin('')
    setPinResetConfirm('')
    setPinResetError('')
    setPinResetSuccess('')
    setPinResetModalVisible(true)
  }

  const handleRequestPinResetOtp = async () => {
    setPinResetLoading(true)
    setPinResetError('')
    try {
      await api.post('auth/settings/pin/reset/request/')
      setPinResetStep('confirm')
    } catch (err: any) {
      setPinResetError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.detail ||
        'Failed to send OTP. Please try again.'
      )
    } finally {
      setPinResetLoading(false)
    }
  }

  const handleConfirmPinReset = async () => {
    if (!pinResetOtp || pinResetOtp.length < 6) {
      setPinResetError('Please enter the 6-digit OTP.')
      return
    }
    if (!pinResetNewPin || pinResetNewPin.length < 4) {
      setPinResetError('PIN must be at least 4 digits.')
      return
    }
    if (pinResetNewPin !== pinResetConfirm) {
      setPinResetError('PINs do not match.')
      return
    }
    setPinResetLoading(true)
    setPinResetError('')
    try {
      const res = await api.post('auth/settings/pin/reset/confirm/', {
        otp_code: pinResetOtp,
        new_pin: pinResetNewPin,
      })
      setHasTransactionPin(true)
      setTransactionPinStatus('ready')
      setPinResetSuccess('Transaction PIN reset successfully!')
      setTimeout(() => {
        setPinResetModalVisible(false)
        setPinResetSuccess('')
      }, 1200)
    } catch (err: any) {
      setPinResetError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.detail ||
        'Reset failed. Please check your OTP and try again.'
      )
    } finally {
      setPinResetLoading(false)
    }
  }

  const resolveTxPinComplete = async (value: string) => {
    if (txPinStep === 'current') {
      setTxPinLoading(true)
      try {
        await api.post('auth/settings/pin/verify/', { pin: value })
        setTxPinError('')
        setTxPinStep('new')
        setTxPinInput('')
      } catch (err: any) {
        setTxPinError(err?.response?.data?.message || err?.response?.data?.error?.message || 'Incorrect PIN.')
        setCurrentTxPinInput('')
      } finally {
        setTxPinLoading(false)
      }
      return
    }

    if (txPinStep === 'new') {
      setTxPinError('')
      setTxPinStep('confirm')
      setTxPinConfirm('')
      return
    }

    if (txPinInput !== value) {
      setTxPinError('PINs do not match.')
      setTxPinConfirm('')
      return
    }

    setTxPinLoading(true)
    try {
      const payload: any = { new_pin: txPinInput }
      if (txPinAction === 'update') {
        payload.current_pin = currentTxPinInput
      }
      await api.post('auth/settings/pin/set/', payload)
      setHasTransactionPin(true)
      setTransactionPinStatus('ready')
      setTxPinError('')
      setTxPinSuccess(txPinAction === 'update' ? 'Transaction PIN updated.' : 'Transaction PIN saved.')
      if (txPinCloseTimer.current) {
        clearTimeout(txPinCloseTimer.current)
      }
      txPinCloseTimer.current = setTimeout(() => {
        setTxPinModalVisible(false)
        setTxPinSuccess('')
      }, 900)
    } catch (err: any) {
      setTxPinError(err?.response?.data?.message || err?.response?.data?.error?.message || 'Failed to save PIN.')
      setTxPinConfirm('')
    } finally {
      setTxPinLoading(false)
    }
  }

  const handleTxDigitPress = async (digit: string) => {
    if (txPinLoading) return
    if (!digit) return
    if (digit === 'back') {
      if (txPinStep === 'current') {
        setCurrentTxPinInput((prev) => prev.slice(0, -1))
      } else if (txPinStep === 'new') {
        setTxPinInput((prev) => prev.slice(0, -1))
      } else {
        setTxPinConfirm((prev) => prev.slice(0, -1))
      }
      return
    }
    setTxPinError('')
    const activeValue = txPinStep === 'current' ? currentTxPinInput : txPinStep === 'new' ? txPinInput : txPinConfirm
    if (activeValue.length >= 4) return
    const nextValue = `${activeValue}${digit}`
    if (txPinStep === 'current') {
      setCurrentTxPinInput(nextValue)
    } else if (txPinStep === 'new') {
      setTxPinInput(nextValue)
    } else {
      setTxPinConfirm(nextValue)
    }
    if (nextValue.length === 4) {
      await resolveTxPinComplete(nextValue)
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
  const transactionPinLoading = transactionPinStatus === 'unknown' || transactionPinStatus === 'loading'
  const transactionPinUnavailable = transactionPinStatus === 'error'

  return (
    <View style={styles.page}>
      {/* Removed header since StudentLayout handles it */}

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

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transaction PIN</Text>
          <Text style={styles.sectionSubtitle}>Protect your wallet and bookings.</Text>
        </View>
        {transactionPinLoading ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color="#6A1B9A" />
            <View style={styles.statusCopy}>
              <Text style={styles.rowTitle}>Wallet PIN</Text>
              <Text style={styles.rowSubtitle}>Checking transaction PIN status...</Text>
            </View>
          </View>
        ) : transactionPinUnavailable ? (
          <View style={styles.actionRow}>
            <View style={styles.statusCopy}>
              <Text style={styles.rowTitle}>Wallet PIN</Text>
              <Text style={styles.rowSubtitle}>Unable to verify transaction PIN status.</Text>
            </View>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => refreshTransactionPinStatus().catch(() => undefined)}
              activeOpacity={0.85}
            >
              <Text style={styles.actionText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <View>
              <Text style={styles.rowTitle}>Wallet PIN</Text>
              <Text style={styles.rowSubtitle}>4-digit PIN for transactions.</Text>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => openTxPinModal(hasTransactionPin ? 'update' : 'set')}
                activeOpacity={0.85}
              >
                <Text style={styles.actionText}>{hasTransactionPin ? 'Change' : 'Set'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── App Lock PIN Modal ──────────────────────────────────────────── */}
      <Modal visible={pinModalVisible} animationType="fade" transparent onRequestClose={() => setPinModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pinAction === 'remove' ? 'Remove PIN' : pinStep === 'current' ? 'Verify Current PIN' : pinStep === 'new' ? 'Set PIN' : 'Confirm PIN'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {pinAction === 'remove' ? 'Enter your current PIN to remove it.' : pinStep === 'current' ? 'Enter your existing 4-digit PIN.' : pinStep === 'new' ? 'Create a new 4-digit PIN.' : 'Re-enter your new PIN to confirm.'}
            </Text>
            <View style={styles.modalStatus}>
              {pinError ? <Text style={styles.modalError}>{pinError}</Text> : null}
              {!pinError && pinSuccess ? <Text style={styles.modalSuccess}>{pinSuccess}</Text> : null}
            </View>
            <View style={styles.dotRow}>
              {[0, 1, 2, 3].map((index) => {
                const activeValue = pinStep === 'current' ? currentPinInput : pinStep === 'new' ? pinInput : pinConfirm
                return <View key={`pin-dot-${index}`} style={index < activeValue.length ? styles.dotFilled : styles.dotEmpty} />
              })}
            </View>
            <View style={styles.keypad}>
              {keypadRows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.keypadRow}>
                  {row.map((item, index) => {
                    if (!item) return <View key={`empty-${rowIndex}-${index}`} style={styles.keypadEmpty} />
                    if (item === 'back') return (
                      <Pressable key="back" style={({ pressed }) => [styles.keypadBack, pressed && styles.keypadPressed]} onPress={() => handleDigitPress('back')}>
                        <MaterialIcons name="backspace" size={26} color="#3d4a3e" />
                      </Pressable>
                    )
                    return (
                      <Pressable key={`${item}-${rowIndex}`} style={({ pressed }) => [styles.keypadButton, pressed && styles.keypadPressed]} onPress={() => handleDigitPress(item)}>
                        <Text style={styles.keypadText}>{item}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.modalCancel} onPress={() => { setPinModalVisible(false); setPinError(''); setPinSuccess(''); if (pinCloseTimer.current) { clearTimeout(pinCloseTimer.current); pinCloseTimer.current = null } }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Transaction PIN Modal ───────────────────────────────────────── */}
      <Modal visible={txPinModalVisible} animationType="fade" transparent onRequestClose={() => setTxPinModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {txPinStep === 'current' ? 'Verify Current PIN' : txPinStep === 'new' ? 'Set Transaction PIN' : 'Confirm PIN'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {txPinStep === 'current' ? 'Enter your existing 4-digit PIN.' : txPinStep === 'new' ? 'Create a new 4-digit transaction PIN.' : 'Re-enter your new PIN to confirm.'}
            </Text>
            {txPinStep === 'current' && (
              <TouchableOpacity onPress={openPinResetModal} style={{ alignSelf: 'flex-end' }} activeOpacity={0.7}>
                <Text style={{ fontSize: 12, color: '#6A1B9A', fontWeight: '600' }}>Forgot PIN?</Text>
              </TouchableOpacity>
            )}
            <View style={styles.modalStatus}>
              {txPinError ? <Text style={styles.modalError}>{txPinError}</Text> : null}
              {!txPinError && txPinSuccess ? <Text style={styles.modalSuccess}>{txPinSuccess}</Text> : null}
            </View>
            <View style={styles.dotRow}>
              {[0, 1, 2, 3].map((index) => {
                const activeValue = txPinStep === 'current' ? currentTxPinInput : txPinStep === 'new' ? txPinInput : txPinConfirm
                return <View key={`tx-pin-dot-${index}`} style={index < activeValue.length ? styles.dotFilled : styles.dotEmpty} />
              })}
            </View>
            <View style={styles.keypad}>
              {keypadRows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.keypadRow}>
                  {row.map((item, index) => {
                    if (!item) return <View key={`empty-${rowIndex}-${index}`} style={styles.keypadEmpty} />
                    if (item === 'back') return (
                      <Pressable key="back" style={({ pressed }) => [styles.keypadBack, pressed && styles.keypadPressed]} onPress={() => handleTxDigitPress('back')} disabled={txPinLoading}>
                        <MaterialIcons name="backspace" size={26} color="#3d4a3e" />
                      </Pressable>
                    )
                    return (
                      <Pressable key={`${item}-${rowIndex}`} style={({ pressed }) => [styles.keypadButton, pressed && styles.keypadPressed]} onPress={() => handleTxDigitPress(item)} disabled={txPinLoading}>
                        <Text style={styles.keypadText}>{item}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.modalCancel} onPress={() => { setTxPinModalVisible(false); setTxPinError(''); setTxPinSuccess(''); if (txPinCloseTimer.current) { clearTimeout(txPinCloseTimer.current); txPinCloseTimer.current = null } }} disabled={txPinLoading}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Forgot Transaction PIN (OTP Reset) Modal ────────────────────── */}
      <Modal visible={pinResetModalVisible} animationType="fade" transparent onRequestClose={() => setPinResetModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 20 }}>
            <View style={[styles.modalCard, { paddingBottom: 24, margin: 0 }]}>
              <Text style={styles.modalTitle}>Reset Transaction PIN</Text>

              {pinResetStep === 'request' ? (
                <>
                  <Text style={styles.modalSubtitle}>
                    We'll send a one-time code to your registered email. Use it to set a new transaction PIN.
                  </Text>
                  {pinResetError ? <Text style={[styles.modalError, { textAlign: 'center' }]}>{pinResetError}</Text> : null}
                  {pinResetSuccess ? <Text style={[styles.modalSuccess, { textAlign: 'center' }]}>{pinResetSuccess}</Text> : null}
                  <TouchableOpacity
                    style={{ backgroundColor: '#6A1B9A', borderRadius: 10, paddingVertical: 14, marginTop: 8, alignItems: 'center' }}
                    onPress={handleRequestPinResetOtp}
                    disabled={pinResetLoading}
                    activeOpacity={0.85}
                  >
                    {pinResetLoading
                      ? <ActivityIndicator size="small" color="#ffffff" />
                      : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Send OTP to Email</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.modalSubtitle}>
                    Enter the 6-digit code sent to your email, then set your new PIN below.
                  </Text>
                  {pinResetError ? <Text style={[styles.modalError, { textAlign: 'center' }]}>{pinResetError}</Text> : null}
                  {pinResetSuccess ? <Text style={[styles.modalSuccess, { textAlign: 'center' }]}>{pinResetSuccess}</Text> : null}

                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 4, letterSpacing: 0.5 }}>OTP CODE</Text>
                  <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 4, width: '100%' }}>
                    {[0,1,2,3,4,5].map((i) => (
                      <View key={i} style={{ flex: 1, maxWidth: 36, height: 44, borderRadius: 8, borderWidth: 2, borderColor: pinResetOtp.length > i ? '#6A1B9A' : '#e0d5eb', alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf7fd' }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1c1c' }}>{pinResetOtp[i] ?? ''}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 2, marginTop: 8, letterSpacing: 0.5 }}>NEW PIN</Text>
                  <View style={styles.dotRow}>
                    {[0,1,2,3].map((i) => <View key={i} style={i < pinResetNewPin.length ? styles.dotFilled : styles.dotEmpty} />)}
                  </View>

                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 2, marginTop: 10, letterSpacing: 0.5 }}>CONFIRM PIN</Text>
                  <View style={styles.dotRow}>
                    {[0,1,2,3].map((i) => <View key={i} style={i < pinResetConfirm.length ? styles.dotFilled : styles.dotEmpty} />)}
                  </View>

                  <View style={styles.keypad}>
                    {keypadRows.map((row, rowIndex) => (
                      <View key={`reset-row-${rowIndex}`} style={styles.keypadRow}>
                        {row.map((item, idx) => {
                          if (!item) return <View key={`re-${rowIndex}-${idx}`} style={styles.keypadEmpty} />
                          if (item === 'back') return (
                            <Pressable key="re-back" style={({ pressed }) => [styles.keypadBack, pressed && styles.keypadPressed]} disabled={pinResetLoading}
                              onPress={() => {
                                if (pinResetOtp.length < 6) setPinResetOtp(p => p.slice(0, -1))
                                else if (pinResetNewPin.length < 4) setPinResetNewPin(p => p.slice(0, -1))
                                else setPinResetConfirm(p => p.slice(0, -1))
                              }}
                            >
                              <MaterialIcons name="backspace" size={26} color="#3d4a3e" />
                            </Pressable>
                          )
                          return (
                            <Pressable key={`re-${item}-${rowIndex}`} style={({ pressed }) => [styles.keypadButton, pressed && styles.keypadPressed]} disabled={pinResetLoading}
                              onPress={() => {
                                if (pinResetOtp.length < 6) setPinResetOtp(p => p + item)
                                else if (pinResetNewPin.length < 4) setPinResetNewPin(p => p + item)
                                else if (pinResetConfirm.length < 4) setPinResetConfirm(p => p + item)
                              }}
                            >
                              <Text style={styles.keypadText}>{item}</Text>
                            </Pressable>
                          )
                        })}
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={{ backgroundColor: '#6A1B9A', borderRadius: 10, paddingVertical: 14, marginTop: 4, alignItems: 'center' }}
                    onPress={handleConfirmPinReset}
                    disabled={pinResetLoading}
                    activeOpacity={0.85}
                  >
                    {pinResetLoading
                      ? <ActivityIndicator size="small" color="#ffffff" />
                      : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Reset PIN</Text>}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.modalCancel} onPress={() => { setPinResetModalVisible(false); setPinResetError('') }} disabled={pinResetLoading}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Auto-lock Timeout Modal ─────────────────────────────────────── */}
      <Modal visible={timeoutModalVisible} animationType="fade" transparent onRequestClose={() => setTimeoutModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Auto-lock</Text>
            <ScrollView style={styles.modalScroll}>
              {TIMEOUT_OPTIONS.map((option) => {
                const selected = lockTimeoutMinutes === option.value
                return (
                  <TouchableOpacity key={option.value} style={styles.modalRow} onPress={() => handleLockTimeoutSelect(option.value)}>
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
    gap: 16,
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
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusCopy: {
    flex: 1,
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
    maxWidth: 400,
    alignSelf: 'center',
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
