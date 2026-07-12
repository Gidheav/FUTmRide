import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { WebView } from 'react-native-webview'
import * as LocalAuthentication from 'expo-local-authentication'
import LoadingOverlay from '../components/LoadingOverlay'
import api from '../../core/api'
import { PAYMENT_CALLBACK_URL } from '../../../config/apiConfig'
import useWalletStore from '../../core/walletStore'
import { useAuthStore } from '../../core/authStore'
import { getStoredPinHash, hashPin } from '../../core/security'
import { useSecurityStore } from '../../core/securityStore'
import { useUIPreferencesStore } from '../../core/uiPreferencesStore'

type TransferRecipient = {
  user_id: string
  full_name: string
  first_name: string
  last_name: string
  matric_number: string | null
  department: string
  level: number | null
  campus: { id: string; name: string } | null
  profile_photo: string | null
}

const TRANSFER_QR_PREFIX = 'lrride://wallet/student/'
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export default function StudentWalletPage({ 
  onNavigateToMap,
  onDisputeTransaction 
}: { 
  onNavigateToMap?: () => void
  onDisputeTransaction?: (tx: any) => void
}) {
  const [profile, setProfile] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState('')
  const [gateway, setGateway] = useState<'paystack' | 'flutterwave'>('paystack')
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupError, setTopupError] = useState<string | null>(null)
  const [pendingReference, setPendingReference] = useState<string | null>(null)
  const [webviewVisible, setWebviewVisible] = useState(false)
  const [webviewUrl, setWebviewUrl] = useState<string | null>(null)
  const [gatewayModalVisible, setGatewayModalVisible] = useState(false)
  const [fundModalVisible, setFundModalVisible] = useState(false)
  const [transactionsModalVisible, setTransactionsModalVisible] = useState(false)
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'credit' | 'debit' | 'transfer'>('all')
  const [transferScanModalVisible, setTransferScanModalVisible] = useState(false)
  const [receiveModalVisible, setReceiveModalVisible] = useState(false)
  const [transferIdModalVisible, setTransferIdModalVisible] = useState(false)
  const [transferStudentId, setTransferStudentId] = useState('')
  const [scannerVisible, setScannerVisible] = useState(false)
  const [scannerLocked, setScannerLocked] = useState(false)
  const [recipientLookupLoading, setRecipientLookupLoading] = useState(false)
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null)
  const [transferAmount, setTransferAmount] = useState('')
  const [recipient, setRecipient] = useState<TransferRecipient | null>(null)
  const [walletFlashVisible, setWalletFlashVisible] = useState(false)
  const [transferConfirmVisible, setTransferConfirmVisible] = useState(false)
  const [transferPinInput, setTransferPinInput] = useState('')
  const [transferPinError, setTransferPinError] = useState('')
  // Toast state for short-lived messages
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastOpacity = useRef(new Animated.Value(0)).current
  // Store reference during WebView session without triggering polls
  const [webviewReference, setWebviewReference] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const authUser = useAuthStore((state) => state.user)
  const { walletBalance, setWalletBalance } = useWalletStore()
  const walletActivityRefreshKey = useWalletStore((state) => state.walletActivityRefreshKey)
  const walletFlashAt = useWalletStore((state) => state.walletFlashAt)
  const biometricEnabled = useSecurityStore((state) => state.biometricEnabled)
  const hasPin = useSecurityStore((state) => state.hasPin)
  const hideBalance = useUIPreferencesStore((state) => state.hideBalance)
  const setUIHideBalance = useUIPreferencesStore((state) => state.setHideBalance)

  const callbackUrl = PAYMENT_CALLBACK_URL

  const formatAmount = useCallback((value: number | string) => {
    const numeric = Number(value || 0)
    return numeric.toLocaleString('en-NG', { minimumFractionDigits: 2 })
  }, [])

  const formatDate = useCallback((value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Unknown date'
    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  const getTransferCode = useCallback(() => {
    const userId = authUser?.id
    if (!userId) return ''
    return JSON.stringify({
      type: 'wallet_transfer',
      recipient_id: userId,
      matric_number: profile?.matric_number || null,
    })
  }, [authUser?.id, profile?.matric_number])

  const transferCode = getTransferCode()
  const transferQrUrl = useMemo(() => {
    if (!transferCode) return ''
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(transferCode)}`
  }, [transferCode])

  const transferPinRows = useMemo(() => ([
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'back'],
  ]), [])

  const loadWallet = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, txRes] = await Promise.all([
        api.get('users/me/student-profile/'),
        api.get('payments/wallet/transactions/?page=1&page_size=10'),
      ])
      setProfile(profileRes.data)
      setWalletBalance(profileRes.data?.wallet_balance ?? null)
      const list = Array.isArray(txRes.data?.results) ? txRes.data.results : txRes.data || []
      setTransactions(Array.isArray(list) ? list : [])
    } catch (err) {
      setTopupError('Unable to load wallet data.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshTransactions = useCallback(async () => {
    const txRes = await api.get('payments/wallet/transactions/?page=1&page_size=10')
    const list = Array.isArray(txRes.data?.results) ? txRes.data.results : txRes.data || []
    setTransactions(Array.isArray(list) ? list : [])
  }, [])

  const parseReferenceFromUrl = useCallback((url: string) => {
    const query = url.split('?')[1] || ''
    if (!query) return ''
    const pairs = query.split('&').map((item) => item.split('='))
    const params: Record<string, string> = {}
    for (const [key, value] of pairs) {
      if (!key) continue
      params[decodeURIComponent(key)] = decodeURIComponent(value || '')
    }
    return params.reference || params.tx_ref || ''
  }, [])

  const checkTopupStatus = useCallback(async (reference: string) => {
    try {
      const res = await api.get(`payments/wallet/topup/status/${reference}/`)
      const status = res.data?.status
      if (status === 'success') {
        setPendingReference(null)
        setTopupError(null)
        setTopupAmount('')
        await loadWallet()
      } else if (status === 'failed') {
        setPendingReference(null)
        setTopupError('Top-up failed. Please try again.')
      }
      // 'pending' / 'abandoned' — keep polling, payment may still be processing
    } catch (err) {
      setTopupError('Unable to verify top-up status.')
    }
  }, [loadWallet])

  useEffect(() => {
    loadWallet()
  }, [loadWallet])

  useEffect(() => {
    if (!walletActivityRefreshKey) return
    refreshTransactions().catch(() => {
      // Ignore refresh errors for background updates.
    })
  }, [walletActivityRefreshKey, refreshTransactions])

  useEffect(() => {
    if (!walletFlashAt) return
    setWalletFlashVisible(true)
    const timer = setTimeout(() => setWalletFlashVisible(false), 1500)
    return () => clearTimeout(timer)
  }, [walletFlashAt])

  useEffect(() => {
    if (!pendingReference || webviewVisible) return
    // Immediately verify once, then poll every 5s
    checkTopupStatus(pendingReference)
    const interval = setInterval(() => {
      checkTopupStatus(pendingReference)
    }, 5000)
    return () => clearInterval(interval)
  }, [pendingReference, webviewVisible, checkTopupStatus])

  const startTopUp = useCallback(async (selectedGateway: 'paystack' | 'flutterwave') => {
    const amountValue = Number(topupAmount)
    if (!amountValue || amountValue < 100) {
      setTopupError('Minimum top-up amount is NGN 100.')
      return
    }
    setTopupLoading(true)
    setTopupError(null)
    setGateway(selectedGateway)
    try {
      const res = await api.post(
        'payments/wallet/topup/',
        {
          amount: amountValue,
          gateway: selectedGateway,
          callback_url: callbackUrl,
        },
        { headers: { 'Idempotency-Key': Math.random().toString(36).slice(2) } },
      )
      const paymentUrl = res.data?.payment_url
      const reference = res.data?.reference
      // Store reference but DON'T start polling yet — user is still on checkout
      if (reference) setWebviewReference(reference)
      if (paymentUrl) {
        setWebviewUrl(paymentUrl)
        setWebviewVisible(true)
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to initiate top-up. Please try again.'
      setTopupError(String(message))
    } finally {
      setTopupLoading(false)
    }
  }, [callbackUrl, topupAmount])

  const handleTopUp = useCallback(() => {
    const amountValue = Number(topupAmount)
    if (!amountValue || amountValue < 100) {
      setTopupError('Minimum top-up amount is NGN 100.')
      return
    }
    setGatewayModalVisible(true)
  }, [topupAmount])

  // Called when user closes WebView manually (X button)
  const handleWebViewClose = useCallback(() => {
    setWebviewVisible(false)
    // Transfer stored reference to pending to start polling now
    if (webviewReference) {
      setPendingReference(webviewReference)
      setWebviewReference(null)
    }
  }, [webviewReference])

  const handleWebViewNavigation = useCallback((url: string) => {
    if (!url) return
    if (url.startsWith(callbackUrl)) {
      setWebviewVisible(false)
      // Paystack redirected back — payment likely complete
      const reference = parseReferenceFromUrl(url) || webviewReference
      if (reference) {
        setPendingReference(reference)
        setWebviewReference(null)
      }
    }
  }, [callbackUrl, parseReferenceFromUrl, webviewReference])

  const activityItems = useMemo(() => {
    return transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    if (transactionFilter === 'all') return activityItems
    if (transactionFilter === 'transfer') return activityItems.filter(tx => String(tx?.source || '').startsWith('student_transfer'))
    return activityItems.filter(tx => tx.transaction_type === transactionFilter)
  }, [activityItems, transactionFilter])

  const formatNarration = useCallback((narration: string) => {
    if (!narration) return 'Wallet transaction'
    // Pattern to catch PS- or FW- followed by hex chars, keeping first 4 and last 2
    return narration.replace(/(PS-|FW-|TX-|CR-|DR-)([A-Z0-9]{4})[A-Z0-9]+([A-Z0-9]{2,4})/, '$1$2...$3')
  }, [])

  const getTransactionIcon = useCallback((tx: any): keyof typeof MaterialIcons.glyphMap => {
    const source = String(tx?.source || '')
    const isTransfer = source.startsWith('student_transfer')
    if (isTransfer) {
      return tx?.transaction_type === 'credit' ? 'call-received' : 'call-made'
    }
    return tx?.transaction_type === 'credit' ? 'add-circle' : 'directions-car'
  }, [])

  const resetTransferState = useCallback(() => {
    setTransferAmount('')
    setTransferError(null)
    setTransferSuccess(null)
    setRecipient(null)
  }, [])

  const parseRecipientCodeFromScan = useCallback((rawData: string) => {
    const data = (rawData || '').trim()
    if (!data) return ''

    if (data.startsWith('{')) {
      try {
        const payload = JSON.parse(data)
        const fromPayload = payload?.recipient_id || payload?.user_id || payload?.matric_number || payload?.recipient_code
        if (fromPayload) return String(fromPayload).trim()
      } catch {
        // Fall through to other parsing strategies.
      }
    }

    if (data.toLowerCase().startsWith(TRANSFER_QR_PREFIX)) {
      const trailing = data.slice(TRANSFER_QR_PREFIX.length).trim()
      if (trailing) return trailing
    }

    const uuidMatch = data.match(UUID_PATTERN)
    if (uuidMatch?.[0]) return uuidMatch[0]

    return data
  }, [])

  const lookupRecipient = useCallback(async (recipientCode: string) => {
    const code = recipientCode.trim()
    if (!code) {
      setTransferError('Recipient code is required.')
      return
    }

    setRecipientLookupLoading(true)
    setTransferError(null)
    setTransferSuccess(null)
    try {
      const res = await api.post('payments/wallet/transfer/lookup/', { recipient_code: code })
      const nextRecipient = res.data?.recipient as TransferRecipient | undefined
      if (!nextRecipient) {
        setTransferError('Recipient was not found.')
        return
      }
      setRecipient(nextRecipient)
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Unable to fetch recipient details.'
      setTransferError(String(message))
    } finally {
      setRecipientLookupLoading(false)
    }
  }, [])

  const handleLookupFromStudentId = useCallback(async () => {
    const candidate = transferStudentId.trim()
    if (!candidate) {
      setTransferError('Enter a valid student ID.')
      return
    }
    await lookupRecipient(candidate)
    setTransferIdModalVisible(false)
  }, [lookupRecipient, transferStudentId])

  const openRecipientScanner = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission()
      if (!permission.granted) {
        setTransferError('Camera permission is required to scan recipient barcode.')
        return
      }
    }
    setScannerLocked(false)
    setScannerVisible(true)
  }, [cameraPermission?.granted, requestCameraPermission])

  const handleRecipientScan = useCallback(async ({ data }: { data: string }) => {
    if (scannerLocked) return
    setScannerLocked(true)
    setScannerVisible(false)

    const recipientCode = parseRecipientCodeFromScan(data)
    if (!recipientCode) {
      Alert.alert('Invalid Barcode', 'This barcode is not a valid transfer barcode.')
      setScannerLocked(false)
      return
    }

    await lookupRecipient(recipientCode)
    setScannerLocked(false)
  }, [lookupRecipient, parseRecipientCodeFromScan, scannerLocked])

  const sendTransferRequest = useCallback(async () => {
    if (!recipient?.user_id) {
      setTransferError('Choose a valid recipient first.')
      return
    }

    const amountValue = Number(transferAmount)
    if (!amountValue || amountValue < 50) {
      setTransferError('Minimum transfer amount is NGN 50.')
      return
    }

    if (walletBalance !== null && Number(walletBalance) < amountValue) {
      setTransferError(`Insufficient wallet balance. You have ${formatAmount(walletBalance)}.`)
      return
    }

    setTransferLoading(true)
    setTransferError(null)
    setTransferSuccess(null)
    try {
      const res = await api.post('payments/wallet/transfer/', {
        recipient_code: recipient.user_id,
        amount: amountValue,
      })
      const nextBalance = res.data?.sender_balance_after
      if (nextBalance !== undefined && nextBalance !== null) {
        setWalletBalance(nextBalance)
      }
      const recipientName = recipient.full_name || 'student'
      const transferRef = res.data?.transfer_reference
      setTransferSuccess(
        transferRef
          ? `Transfer successful to ${recipientName}. Ref: ${transferRef}`
          : `Transfer successful to ${recipientName}.`,
      )
      setTransferAmount('')
      try {
        await refreshTransactions()
      } catch {
        // Ignore transaction refresh errors; balance already updated.
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Transfer failed. Please try again.'
      setTransferError(String(message))
    } finally {
      setTransferLoading(false)
    }
  }, [formatAmount, recipient, refreshTransactions, transferAmount, walletBalance, setWalletBalance])

  const handleTransferPinDigit = useCallback(async (digit: string) => {
    if (!digit) return
    if (digit === 'back') {
      setTransferPinInput((prev) => prev.slice(0, -1))
      return
    }
    setTransferPinError('')
    setTransferPinInput((prev) => {
      if (prev.length >= 4) return prev
      const next = `${prev}${digit}`
      if (next.length === 4) {
        void (async () => {
          try {
            const storedHash = await getStoredPinHash()
            if (!storedHash) {
              setTransferPinError('No PIN is set. Enable PIN or biometrics in Security settings.')
              setTransferPinInput('')
              return
            }
            const currentHash = await hashPin(next)
            if (currentHash !== storedHash) {
              setTransferPinError('Incorrect PIN.')
              setTransferPinInput('')
              return
            }
            setTransferConfirmVisible(false)
            setTransferPinInput('')
            await sendTransferRequest()
          } catch {
            setTransferPinError('Unable to verify PIN.')
            setTransferPinInput('')
          }
        })()
      }
      return next
    })
  }, [sendTransferRequest])

  // Show toast helper — fades in then auto-hides after 3s
  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
    setToastMessage(message)
    setToastVisible(true)
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setToastVisible(false)
        setToastMessage(null)
      })
      toastTimeoutRef.current = null
    }, 3000)
  }, [toastOpacity])

  // Auto show toasts for various error states and clear them
  useEffect(() => {
    if (topupError) {
      showToast(topupError)
      setTopupError(null)
    }
  }, [topupError, showToast])

  useEffect(() => {
    if (transferError) {
      showToast(transferError)
      setTransferError(null)
    }
  }, [transferError, showToast])

  useEffect(() => {
    if (transferPinError) {
      showToast(transferPinError)
      setTransferPinError('')
    }
  }, [transferPinError, showToast])

  const handleTransferConfirm = useCallback(async () => {
    if (transferLoading) return
    if (biometricEnabled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm transfer',
        cancelLabel: 'Cancel',
        fallbackLabel: hasPin ? 'Use PIN' : undefined,
      })
      if (result.success) {
        await sendTransferRequest()
        return
      }
      if (!hasPin) {
        setTransferError('Biometric verification failed. Enable PIN in Security settings to continue.')
        return
      }
      setTransferPinInput('')
      setTransferPinError('')
      setTransferConfirmVisible(true)
      return
    }

    if (hasPin) {
      setTransferPinInput('')
      setTransferPinError('')
      setTransferConfirmVisible(true)
      return
    }

    setTransferError('Set up a PIN or biometrics in Security settings to confirm transfers.')
  }, [biometricEnabled, hasPin, sendTransferRequest, transferLoading])

  return (
    <View style={styles.page}>
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <Modal
        visible={receiveModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setReceiveModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Receive via barcode</Text>
            <Text style={styles.modalSubtitle}>Show this barcode to the sender.</Text>
            <View style={styles.barcodeWrap}>
              {transferQrUrl ? (
                <Image source={{ uri: transferQrUrl }} style={styles.qrImage} />
              ) : (
                <View style={styles.barcodeFallback}>
                  <Text style={styles.barcodeFallbackText}>Unable to load barcode.</Text>
                </View>
              )}
              <Text style={styles.barcodeValue}>{profile?.matric_number || 'Student barcode'}</Text>
            </View>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setReceiveModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={fundModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setFundModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Fund Wallet</Text>
            <Text style={styles.modalSubtitle}>Enter the amount you want to add to your wallet.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Amount (NGN)"
              keyboardType="numeric"
              value={topupAmount}
              onChangeText={setTopupAmount}
            />
            {/* Errors are shown as toasts */}
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.primaryActionCompact, (topupLoading || Number(topupAmount) < 100) && styles.primaryActionDisabled]}
                activeOpacity={0.9}
                onPress={() => {
                  setFundModalVisible(false)
                  handleTopUp()
                }}
                disabled={topupLoading || Number(topupAmount) < 100}
              >
                <MaterialIcons name="add-circle" size={18} color="#ffffff" />
                <Text style={styles.primaryActionText}>Top Up</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setFundModalVisible(false)
                setTopupError(null)
                setTopupAmount('')
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={transferIdModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setTransferIdModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Send to Student</Text>
            <Text style={styles.modalSubtitle}>Enter the recipient student ID to continue.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Student ID"
              value={transferStudentId}
              onChangeText={setTransferStudentId}
              autoCapitalize="characters"
              editable={!recipientLookupLoading}
            />
            {/* Errors are shown as toasts */}
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.primaryActionCompact, (!transferStudentId.trim() || recipientLookupLoading) && styles.primaryActionDisabled]}
                activeOpacity={0.9}
                onPress={handleLookupFromStudentId}
                disabled={!transferStudentId.trim() || recipientLookupLoading}
              >
                <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
                <Text style={styles.primaryActionText}>Continue</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setTransferIdModalVisible(false)
                setTransferError(null)
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
        <LoadingOverlay visible={recipientLookupLoading} />
      </Modal>

      <Modal
        visible={!!recipient}
        animationType="fade"
        transparent
        onRequestClose={resetTransferState}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Complete Transfer</Text>
            <Text style={styles.modalSubtitle}>Sending to:</Text>
            {recipient && (
              <View style={styles.recipientCardCompact}>
                <Text style={styles.recipientName}>{recipient.full_name}</Text>
                <Text style={styles.recipientMeta}>{recipient.matric_number || 'No matric'} {recipient.campus ? `• ${recipient.campus.name}` : ''}</Text>
              </View>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="Amount (NGN)"
              keyboardType="numeric"
              value={transferAmount}
              onChangeText={setTransferAmount}
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[
                  styles.primaryActionCompact,
                  (transferLoading || Number(transferAmount) < 50) && styles.primaryActionDisabled,
                ]}
                onPress={handleTransferConfirm}
                disabled={transferLoading || Number(transferAmount) < 50}
              >
                <MaterialIcons name="send" size={18} color="#ffffff" />
                <Text style={styles.primaryActionText}>Send</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.modalCancel} onPress={resetTransferState}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={scannerVisible}
        animationType="fade"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerFull}>
          <CameraView
            onBarcodeScanned={scannerLocked ? undefined : handleRecipientScan}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrameBox} />
          </View>
          <View style={styles.scannerTopBar}>
            <TouchableOpacity style={styles.scannerClose} onPress={() => setScannerVisible(false)}>
              <MaterialIcons name="close" size={20} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scan Recipient</Text>
            <View style={styles.scannerSpacer} />
          </View>
          <View style={styles.scannerHintWrap}>
            <Text style={styles.scannerHint}>Align recipient barcode inside the frame</Text>
          </View>
        </View>
      </Modal>
      <Modal
        visible={transferConfirmVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setTransferConfirmVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm transfer</Text>
            <Text style={styles.modalSubtitle}>Enter your 4-digit PIN to continue.</Text>
            <View style={styles.pinDotsRow}>
              {[0, 1, 2, 3].map((idx) => (
                <View
                  key={`pin-dot-${idx}`}
                  style={[styles.pinDot, transferPinInput.length > idx && styles.pinDotFilled]}
                />
              ))}
            </View>
            {/* Errors are shown as toasts */}
            <View style={styles.pinPad}>
              {transferPinRows.map((row, rowIndex) => (
                <View key={`pin-row-${rowIndex}`} style={styles.pinRow}>
                  {row.map((digit, colIndex) => (
                    <TouchableOpacity
                      key={`pin-${rowIndex}-${colIndex}`}
                      style={[styles.pinKey, !digit && styles.pinKeyDisabled]}
                      activeOpacity={0.85}
                      onPress={() => handleTransferPinDigit(digit)}
                      disabled={!digit}
                    >
                      {digit === 'back' ? (
                        <MaterialIcons name="backspace" size={20} color="#1a1c1c" />
                      ) : (
                        <Text style={styles.pinKeyText}>{digit}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setTransferConfirmVisible(false)
                setTransferPinInput('')
                setTransferPinError('')
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
        <LoadingOverlay visible={transferLoading} />
      </Modal>
      <Modal
        visible={webviewVisible}
        animationType="slide"
        onRequestClose={handleWebViewClose}
        statusBarTranslucent={false}
      >
        <SafeAreaView style={styles.webviewContainer}>
          <View style={styles.webviewHeader}>
            <Text style={styles.webviewTitle}>Complete Payment</Text>
            <TouchableOpacity onPress={handleWebViewClose}>
              <MaterialIcons name="close" size={22} color="#1a1c1c" />
            </TouchableOpacity>
          </View>
          {webviewUrl ? (
            <WebView
              style={{ flex: 1 }}
              source={{ uri: webviewUrl }}
              originWhitelist={['*']}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              injectedJavaScript={`
                (function(){
                  try{
                    window.open = function(url){ window.location.href = url; };
                    Array.from(document.querySelectorAll('a[target="_blank"]')).forEach(a=>a.removeAttribute('target'));
                  }catch(e){}
                  true;
                })();
              `}
              onShouldStartLoadWithRequest={(req) => {
                const url = req?.url || '';
                if (!url) return true;
                const lc = url.toLowerCase();
                const isCallback = lc.startsWith((callbackUrl || '').toLowerCase())
                  || lc.includes('trxref=')
                  || lc.includes('reference=')
                  || lc.includes('/student/wallet');
                if (isCallback) {
                  // Handle in-app and prevent external navigation
                  handleWebViewNavigation(url);
                  return false;
                }
                return true;
              }}
              onNavigationStateChange={(state) => handleWebViewNavigation(state.url)}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webviewLoading}>
                  <LoadingOverlay visible={true} inline size={40} message="Loading checkout..." />
                </View>
              )}
            />
          ) : (
            <View style={styles.webviewLoading}>
              <Text style={styles.activityTime}>Payment link unavailable.</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
      <Modal visible={gatewayModalVisible} animationType="fade" transparent onRequestClose={() => setGatewayModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose payment gateway</Text>
            <Text style={styles.modalSubtitle}>Select Paystack or Flutterwave to continue.</Text>
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => {
                setGatewayModalVisible(false)
                startTopUp('paystack')
              }}
              disabled={topupLoading}
            >
              <View style={styles.radioOuter}>
                <View style={styles.radioInner} />
              </View>
              <Text style={styles.radioLabel}>Paystack</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => {
                setGatewayModalVisible(false)
                startTopUp('flutterwave')
              }}
              disabled={topupLoading}
            >
              <View style={styles.radioOuter}>
                <View style={styles.radioInnerMuted} />
              </View>
              <Text style={styles.radioLabel}>Flutterwave</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setGatewayModalVisible(false)}
              disabled={topupLoading}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedTransaction}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedTransaction(null)}
      >
        <TouchableOpacity style={styles.modalBackdropReceipt} activeOpacity={1} onPress={() => setSelectedTransaction(null)}>
          <TouchableOpacity style={styles.receiptCard} activeOpacity={1}>
            <View style={styles.receiptHeader}>
              <MaterialIcons 
                name={selectedTransaction?.transaction_type === 'credit' ? 'check-circle' : 'receipt'} 
                size={40} 
                color={selectedTransaction?.transaction_type === 'credit' ? '#2e7d32' : '#6A1B9A'} 
              />
              <Text style={styles.receiptTitle}>Transaction Receipt</Text>
              <Text style={styles.receiptDate}>{selectedTransaction ? formatDate(selectedTransaction.created_at) : ''}</Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptBody}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Amount</Text>
                <Text style={[styles.receiptValue, selectedTransaction?.transaction_type === 'credit' ? styles.receiptAmountPositive : undefined]}>
                  {selectedTransaction?.transaction_type === 'credit' ? '+ NGN ' : '- NGN '}
                  {selectedTransaction ? formatAmount(selectedTransaction.amount) : ''}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Type</Text>
                <Text style={styles.receiptValue}>
                  {selectedTransaction?.transaction_type === 'credit' ? 'Credit' : 'Debit'}
                  {selectedTransaction?.source ? ` • ${selectedTransaction.source.replace(/_/g, ' ')}` : ''}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Description</Text>
                <Text style={styles.receiptValue}>{selectedTransaction?.narration}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Reference</Text>
                <Text style={styles.receiptValue}>{selectedTransaction?.reference || 'N/A'}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Status</Text>
                <Text style={[styles.receiptValue, { color: '#2e7d32' }]}>Successful</Text>
              </View>
              
              {selectedTransaction?.has_dispute && (
                <View style={[styles.receiptRow, { marginTop: 8 }]}>
                  <Text style={styles.receiptLabel}>Dispute Status</Text>
                  <Text style={[styles.receiptValue, { color: '#b91c1c' }]}>
                    {selectedTransaction.dispute_status ? selectedTransaction.dispute_status.replace('_', ' ').toUpperCase() : 'IN PROGRESS'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.receiptDivider} />
            
            {/* Dispute Button */}
            {selectedTransaction?.transaction_type === 'debit' && !selectedTransaction?.has_dispute && (
              (() => {
                const txDate = new Date(selectedTransaction.created_at)
                const hoursDiff = (Date.now() - txDate.getTime()) / (1000 * 60 * 60)
                if (hoursDiff <= 72) {
                  return (
                    <TouchableOpacity 
                      style={styles.receiptDisputeButton}
                      onPress={() => {
                        setSelectedTransaction(null)
                        onDisputeTransaction?.(selectedTransaction)
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.receiptDisputeText}>Dispute Transaction</Text>
                    </TouchableOpacity>
                  )
                }
                return null
              })()
            )}
            
            <TouchableOpacity 
              style={styles.receiptCloseButton}
              onPress={() => setSelectedTransaction(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.receiptCloseText}>Close Receipt</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <View style={styles.walletCard}>
        <View style={styles.walletGlow} />
        <View style={styles.walletBody}>
          <View style={styles.walletHeader}>
            <View>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
                <Text style={styles.balanceCurrency}>NGN</Text>
                <Text style={styles.balanceValue}>
                  {hideBalance ? '●●●●●●' : (walletBalance !== null ? formatAmount(walletBalance) : '--')}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.walletIconWrap}
              onPress={() => setUIHideBalance(!hideBalance)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="account-balance-wallet" size={22} color={hideBalance ? '#9ca3af' : '#ffffff'} />
              {walletFlashVisible ? <View style={styles.walletFlashBadge} /> : null}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.quickActionRow}>
        <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.8} onPress={() => setFundModalVisible(true)}>
          <View style={styles.quickActionIcon}>
            <MaterialIcons name="add" size={28} color="#6A1B9A" />
          </View>
          <Text style={styles.quickActionText}>Fund</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.8} onPress={() => setTransferIdModalVisible(true)}>
          <View style={styles.quickActionIcon}>
            <MaterialIcons name="send" size={24} color="#6A1B9A" />
          </View>
          <Text style={styles.quickActionText}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.8} onPress={() => setReceiveModalVisible(true)}>
          <View style={styles.quickActionIcon}>
            <MaterialIcons name="qr-code" size={24} color="#6A1B9A" />
          </View>
          <Text style={styles.quickActionText}>Receive</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.8} onPress={openRecipientScanner}>
          <View style={styles.quickActionIcon}>
            <MaterialIcons name="qr-code-scanner" size={24} color="#6A1B9A" />
          </View>
          <Text style={styles.quickActionText}>Scan</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <TouchableOpacity activeOpacity={0.8} onPress={loadWallet} style={styles.iconButtonWrap}>
            <MaterialIcons name="refresh" size={22} color="#6A1B9A" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setTransactionsModalVisible(true)} style={styles.iconButtonWrap}>
            <MaterialIcons name="receipt-long" size={22} color="#6A1B9A" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.activityList}>
        {loading ? (
          <View style={styles.activityLoadingWrap}>
            <LoadingOverlay visible={true} inline size={32} message="Loading transactions..." />
          </View>
        ) : activityItems.length === 0 ? (
          <View style={styles.activityItem}>
            <Text style={styles.activityTime}>No transactions yet.</Text>
          </View>
        ) : (
          activityItems.slice(0, 10).map((tx) => (
            <TouchableOpacity 
              style={styles.activityItem} 
              key={tx.id}
              activeOpacity={0.7}
              onPress={() => setSelectedTransaction(tx)}
            >
              <View style={[styles.activityLeft, { flex: 1 }]}>
                <View style={tx.transaction_type === 'credit' ? styles.activityIconAccent : styles.activityIconMuted}>
                  <MaterialIcons
                    name={getTransactionIcon(tx)}
                    size={20}
                    color={tx.transaction_type === 'credit' ? '#6A1B9A' : '#3d4a3e'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle} numberOfLines={1} ellipsizeMode="tail">
                    {formatNarration(tx.narration)}
                  </Text>
                  <Text style={styles.activityTime}>{formatDate(tx.created_at)}</Text>
                </View>
              </View>
              <Text style={tx.transaction_type === 'credit' ? styles.activityAmountPositive : styles.activityAmount}>
                {tx.transaction_type === 'credit' ? '+ NGN ' : '- NGN '}{formatAmount(tx.amount)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
    <Modal
      visible={transactionsModalVisible}
      animationType="slide"
      onRequestClose={() => setTransactionsModalVisible(false)}
    >
      <SafeAreaView style={styles.page}>
        <View style={styles.transactionsModalHeader}>
          <Text style={styles.transactionsModalTitle}>All Transactions</Text>
          <TouchableOpacity onPress={() => setTransactionsModalVisible(false)}>
            <MaterialIcons name="close" size={24} color="#1a1c1c" />
          </TouchableOpacity>
        </View>
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <TouchableOpacity style={[styles.filterChip, transactionFilter === 'all' && styles.filterChipActive]} onPress={() => setTransactionFilter('all')}>
              <Text style={[styles.filterChipText, transactionFilter === 'all' && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, transactionFilter === 'credit' && styles.filterChipActive]} onPress={() => setTransactionFilter('credit')}>
              <Text style={[styles.filterChipText, transactionFilter === 'credit' && styles.filterChipTextActive]}>Credits</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, transactionFilter === 'debit' && styles.filterChipActive]} onPress={() => setTransactionFilter('debit')}>
              <Text style={[styles.filterChipText, transactionFilter === 'debit' && styles.filterChipTextActive]}>Debits</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, transactionFilter === 'transfer' && styles.filterChipActive]} onPress={() => setTransactionFilter('transfer')}>
              <Text style={[styles.filterChipText, transactionFilter === 'transfer' && styles.filterChipTextActive]}>Transfers</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.activityList}>
            {filteredTransactions.length === 0 ? (
              <View style={styles.emptyFilterState}>
                <MaterialIcons name="receipt-long" size={48} color="#e5e7eb" />
                <Text style={styles.emptyFilterTitle}>No transactions found</Text>
                <Text style={styles.emptyFilterSubtitle}>There are no {transactionFilter === 'all' ? '' : transactionFilter + ' '}transactions to display.</Text>
              </View>
            ) : (
              filteredTransactions.map((tx) => (
                <TouchableOpacity 
                style={styles.activityItem} 
                key={tx.id}
                activeOpacity={0.7}
                onPress={() => setSelectedTransaction(tx)}
              >
                <View style={[styles.activityLeft, { flex: 1 }]}>
                  <View style={tx.transaction_type === 'credit' ? styles.activityIconAccent : styles.activityIconMuted}>
                    <MaterialIcons
                      name={getTransactionIcon(tx)}
                      size={20}
                      color={tx.transaction_type === 'credit' ? '#6A1B9A' : '#3d4a3e'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle} numberOfLines={1} ellipsizeMode="tail">
                      {formatNarration(tx.narration)}
                    </Text>
                    <Text style={styles.activityTime}>{formatDate(tx.created_at)}</Text>
                  </View>
                </View>
                <Text style={tx.transaction_type === 'credit' ? styles.activityAmountPositive : styles.activityAmount}>
                  {tx.transaction_type === 'credit' ? '+ NGN ' : '- NGN '}{formatAmount(tx.amount)}
                </Text>
              </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
    {toastVisible ? (
      <Animated.View style={[styles.toastWrap, { opacity: toastOpacity }]} pointerEvents="box-none">
        <View style={styles.toast}>
          <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>{toastMessage}</Text>
        </View>
      </Animated.View>
    ) : null}
    <LoadingOverlay visible={topupLoading || transferLoading || recipientLookupLoading} />
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  pageContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 22,
    gap: 24,
  },

  walletCard: {
    backgroundColor: '#6A1B9A',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    overflow: 'hidden',
    marginBottom: 20,
  },
  walletGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#ffffff',
    opacity: 0.1,
    top: -80,
    right: -60,
  },
  walletBody: {
    gap: 16,
  },
  quickActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  quickActionBtn: {
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3e5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  requirementsCard: {
    backgroundColor: '#f7f2fb',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  requirementsItem: {
    fontSize: 12,
    color: '#5e5e5e',
  },
  topupRow: {
    gap: 12,
  },
  fundActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  amountInput: {
    height: 59,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  gatewayRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gatewayPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
  },
  gatewayPillActive: {
    backgroundColor: '#6A1B9A',
  },
  gatewayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5e5e5e',
  },
  gatewayTextActive: {
    color: '#ffffff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    zIndex: 1000,
  },
  modalButtonRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6A1B9A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6A1B9A',
  },
  radioInnerMuted: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d6c1e3',
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  modalCancelText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  pinDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  pinDotFilled: {
    backgroundColor: '#1a1c1c',
    borderColor: '#1a1c1c',
  },
  pinPad: {
    gap: 10,
    paddingTop: 4,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pinKey: {
    width: 70,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  pinKeyDisabled: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  pinKeyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  barcodeWrap: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#f3f3f3',
  },
  barcodeFallback: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeFallbackText: {
    fontSize: 12,
    color: '#5e5e5e',
  },
  barcodeLines: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  barcodeLine: {
    width: '80%',
    height: 8,
    borderRadius: 6,
    backgroundColor: '#1a1c1c',
  },
  barcodeLineShort: {
    width: '60%',
    height: 8,
    borderRadius: 6,
    backgroundColor: '#1a1c1c',
  },
  barcodeValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  primaryActionDisabled: {
    opacity: 0.7,
  },
  pendingText: {
    fontSize: 12,
    color: '#5e5e5e',
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
  },
  successText: {
    fontSize: 12,
    color: '#2e7d32',
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  balanceCurrency: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 44,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 0,
    lineHeight: 44,
  },
  walletIconWrap: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 12,
    position: 'relative',
  },
  walletFlashBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#6A1B9A',
  },
  recipientCardCompact: {
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  transferTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  transferSubtitle: {
    fontSize: 12,
    color: '#5e5e5e',
  },
  recipientCard: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e6d6f2',
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  recipientMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#5e5e5e',
  },
  recipientReset: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  recipientResetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  transferForm: {
    gap: 12,
  },
  webviewHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  webviewLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  toastWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 36,
    alignItems: 'center',
    zIndex: 20000,
  },
  toast: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    maxWidth: '92%',
  },
  primaryAction: {
    flex: 1,
    backgroundColor: '#6A1B9A',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryActionCompact: {
    backgroundColor: '#6A1B9A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: '#1a1c1c',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  transferPinError: {
    color: '#b91c1c',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  receiptDisputeButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
  },
  receiptDisputeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: '#b91c1c',
  },
  transactionsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#ffffff',
  },
  transactionsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  scannerFull: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  scannerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerSpacer: {
    width: 36,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrameBox: {
    width: 320,
    height: 320,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 20,
  },
  scannerHintWrap: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  scannerHint: {
    textAlign: 'center',
    fontSize: 13,
    color: '#ffffff',
  },
  bonusBanner: {
    backgroundColor: '#6A1B9A',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  bonusPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
    backgroundColor: 'transparent',
  },
  bonusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bonusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bonusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonusTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  bonusSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  bonusButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  bonusButtonText: {
    color: '#6A1B9A',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  sectionAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  activityList: {
    gap: 2,
  },
  activityLoadingWrap: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityItem: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f3f3f3',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#00000079',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIconMuted: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconAccent: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3e5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconGift: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  activityTime: {
    fontSize: 12,
    color: '#5e5e5e',
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  activityAmountPositive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6A1B9A',
  },
  modalBackdropReceipt: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 40,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    elevation: 8,
  },
  receiptHeader: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  receiptDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  receiptDivider: {
    height: 0,
    borderTopWidth: 1,
    borderColor: '#e2e2e2',
    borderStyle: 'dashed',
    marginVertical: 16,
  },
  receiptBody: {
    gap: 16,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  receiptLabel: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  receiptValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
    flex: 2,
    textAlign: 'right',
    textTransform: 'capitalize',
  },
  receiptAmountPositive: {
    color: '#2e7d32',
  },
  receiptCloseButton: {
    backgroundColor: '#f5effb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  receiptCloseText: {
    color: '#6A1B9A',
    fontWeight: '700',
    fontSize: 15,
  },
  iconButtonWrap: {
    padding: 4,
    backgroundColor: 'rgba(106, 27, 154, 0.1)',
    borderRadius: 8,
  },
  filterRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#6A1B9A',
    borderColor: '#6A1B9A',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  emptyFilterState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyFilterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
    marginTop: 8,
  },
  emptyFilterSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
})
