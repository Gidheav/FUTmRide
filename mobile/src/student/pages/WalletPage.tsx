import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'


import Reanimated, { FadeInUp, useAnimatedSensor, SensorType, useAnimatedStyle, withTiming, interpolate } from 'react-native-reanimated'
// MeshGradient removed — clean premium background
import GlassCard from '../components/premium/GlassCard'
import PremiumBottomSheet from '../components/premium/PremiumBottomSheet'
import AnimatedCounter from '../components/premium/AnimatedCounter'
import { ReceiveModal } from '../components/wallet/modals/ReceiveModal'
import { FundWalletModal } from '../components/wallet/modals/FundWalletModal'
import { TransferIdModal } from '../components/wallet/modals/TransferIdModal'
import { CompleteTransferModal } from '../components/wallet/modals/CompleteTransferModal'
import { TransferConfirmModal } from '../components/wallet/modals/TransferConfirmModal'
import { GatewayModal } from '../components/wallet/modals/GatewayModal'
import { TransactionReceiptModal } from '../components/wallet/modals/TransactionReceiptModal'

import { MaterialIcons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { WebView } from 'react-native-webview'
import LoadingOverlay from '../components/LoadingOverlay'
import api from '../../core/api'
import { PAYMENT_CALLBACK_URL } from '../../../config/apiConfig'
import useWalletStore from '../../core/walletStore'
import { useToastStore } from '../../core/toastStore'
import { useAuthStore } from '../../core/authStore'
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

const ReanimatedPressable = Reanimated.createAnimatedComponent(Pressable)

export default function StudentWalletPage({ 
  onNavigateToMap,
  onDisputeTransaction,
  onViewAllTransactions,
}: { 
  onNavigateToMap?: () => void
  onDisputeTransaction?: (tx: any) => void
  onViewAllTransactions?: () => void
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

  // Store reference during WebView session without triggering polls
  const [webviewReference, setWebviewReference] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const authUser = useAuthStore((state) => state.user)
  const showToast = useToastStore((state) => state.showToast)
  const { walletBalance, setWalletBalance } = useWalletStore()
  const walletActivityRefreshKey = useWalletStore((state) => state.walletActivityRefreshKey)
  const walletFlashAt = useWalletStore((state) => state.walletFlashAt)
  const hasTransactionPin = useSecurityStore((state) => state.hasTransactionPin)
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
      showToast('Unable to load wallet data.', 'error')
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
        showToast('Top-up failed. Please try again.', 'error')
      }
      // 'pending' / 'abandoned' — keep polling, payment may still be processing
    } catch (err) {
      showToast('Unable to verify top-up status.', 'error')
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
      showToast('Minimum top-up amount is NGN 100.', 'error')
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
      const message = String(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to initiate top-up. Please try again.'
      )
      showToast(message, 'error')
    } finally {
      setTopupLoading(false)
    }
  }, [callbackUrl, topupAmount])

  const handleTopUpSubmit = useCallback((amount: string) => {
    const amountValue = Number(amount)
    if (!amountValue || amountValue < 100) {
      setTopupError('Minimum top-up amount is NGN 100.')
      return
    }
    setTopupAmount(amount)
    setFundModalVisible(false)
    setGatewayModalVisible(true)
  }, [])

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

  const lookupRecipient = useCallback(async (recipientCode: string): Promise<boolean> => {
    const code = recipientCode.trim()
    if (!code) {
      setTransferError('Recipient code is required.')
      return false
    }

    setRecipientLookupLoading(true)
    setTransferError(null)
    setTransferSuccess(null)
    try {
      const res = await api.post('payments/wallet/transfer/lookup/', { recipient_code: code })
      const nextRecipient = res.data?.recipient as TransferRecipient | undefined
      if (!nextRecipient) {
        setTransferError('Recipient was not found.')
        return false
      }
      setRecipient(nextRecipient)
      return true
    } catch (err: any) {
      const message = String(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Unable to fetch recipient details.'
      )
      setTransferError(message)
      return false
    } finally {
      setRecipientLookupLoading(false)
    }
  }, [])

  const handleLookupSubmit = useCallback(async (candidate: string) => {
    const trimmed = candidate.trim()
    if (!trimmed) {
      setTransferError('Enter a valid student ID.')
      return
    }
    const success = await lookupRecipient(trimmed)
    if (success) {
      setTransferIdModalVisible(false)
    }
  }, [lookupRecipient])

  const openRecipientScanner = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission()
      if (!permission.granted) {
        showToast('Camera permission is required to scan recipient barcode.', 'error')
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

    const pendingTx = {
      id: 'pending',
      transaction_type: 'debit',
      amount: amountValue,
      created_at: new Date().toISOString(),
      reference: 'Processing...',
      narration: `Transfer to ${recipient?.full_name || 'student'}`,
      source: 'student_transfer',
      status: 'processing'
    }
    setSelectedTransaction(pendingTx)
    resetTransferState()
    
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
      const transferRef = res.data?.transfer_reference
      setSelectedTransaction((prev: any) => prev ? {
        ...prev,
        status: 'successful',
        reference: transferRef || 'Success',
      } : null)
      
      const recipientName = recipient.full_name || 'student'
      const msg = transferRef
        ? `Transfer successful to ${recipientName}. Ref: ${transferRef}`
        : `Transfer successful to ${recipientName}.`
      
      showToast(msg, 'success')
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
      
      setSelectedTransaction((prev: any) => prev ? {
        ...prev,
        status: 'failed',
        error_message: String(message),
      } : null)
    } finally {
      setTransferLoading(false)
    }
  }, [formatAmount, recipient, refreshTransactions, transferAmount, walletBalance, setWalletBalance, showToast, resetTransferState])

  const [transferPinLoading, setTransferPinLoading] = useState(false)

  const handleTransferPinConfirm = useCallback(async (pin: string) => {
    if (transferPinLoading) return
    setTransferPinError('')
    setTransferConfirmVisible(false)
    setTransferPinLoading(true)
    try {
      await api.post('auth/settings/pin/verify/', { pin })
      setTransferPinError('')
      await sendTransferRequest()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || 'Incorrect Transaction PIN.'
      setTransferPinError(String(msg))
      setTransferConfirmVisible(true)
    } finally {
      setTransferPinLoading(false)
    }
  }, [sendTransferRequest, transferPinLoading])

  const handleTransferSubmit = useCallback((amount: string) => {
    if (transferLoading) return
    const amountValue = Number(amount)
    if (!amountValue || amountValue < 50) {
      setTransferError('Minimum transfer amount is NGN 50.')
      return
    }
    if (walletBalance !== null && Number(walletBalance) < amountValue) {
      setTransferError(`Insufficient wallet balance. You have ${formatAmount(walletBalance)}.`)
      return
    }
    setTransferAmount(amount)
    if (!hasTransactionPin) {
      setTransferError('Set up a Transaction PIN in Security settings before making transfers.')
      return
    }
    setTransferConfirmVisible(true)
  }, [transferLoading, walletBalance, formatAmount, hasTransactionPin])

  return (
        <View style={styles.page}>
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <ReceiveModal 
        visible={receiveModalVisible} 
        onClose={() => setReceiveModalVisible(false)} 
        matricNumber={profile?.matric_number || null}
        qrUrl={transferQrUrl}
      />
      <FundWalletModal
        visible={fundModalVisible}
        onClose={() => setFundModalVisible(false)}
        onTopUp={handleTopUpSubmit}
        loading={topupLoading}
        error={topupError}
        clearError={() => setTopupError(null)}
      />
      <TransferIdModal
        visible={transferIdModalVisible}
        onClose={() => setTransferIdModalVisible(false)}
        onContinue={handleLookupSubmit}
        loading={recipientLookupLoading}
        error={transferError}
        clearError={() => setTransferError(null)}
      />
      <CompleteTransferModal
        visible={!!recipient}
        onClose={resetTransferState}
        onSend={handleTransferSubmit}
        loading={transferLoading || transferPinLoading}
        recipient={recipient}
        error={transferError}
        clearError={() => setTransferError(null)}
      />
      <Modal
        visible={scannerVisible}
        animationType="fade"
        onRequestClose={() => setScannerVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.scannerFull}>
          <CameraView
            onBarcodeScanned={scannerLocked ? undefined : handleRecipientScan}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrameBox}>
              <View style={styles.scannerCornerTL} />
              <View style={styles.scannerCornerTR} />
              <View style={styles.scannerCornerBL} />
              <View style={styles.scannerCornerBR} />
            </View>
          </View>
          <SafeAreaView style={styles.scannerSafeTop}>
            <View style={styles.scannerTopBar}>
              <TouchableOpacity style={styles.scannerClose} onPress={() => setScannerVisible(false)}>
                <MaterialIcons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.scannerTitle}>Scan Recipient</Text>
              <View style={styles.scannerSpacer} />
            </View>
          </SafeAreaView>
          <SafeAreaView style={styles.scannerSafeBottom}>
            <View style={styles.scannerHintWrap}>
              <View style={styles.scannerHintPill}>
                <MaterialIcons name="qr-code-scanner" size={18} color="#ffffff" />
                <Text style={styles.scannerHint}>Align QR code inside the frame</Text>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
      <TransferConfirmModal
        visible={transferConfirmVisible}
        onClose={() => {
          setTransferConfirmVisible(false)
          setTransferPinInput('')
          setTransferPinError('')
        }}
        onConfirm={handleTransferPinConfirm}
        loading={transferPinLoading}
        error={transferPinError}
        clearError={() => setTransferPinError('')}
      />
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
      <GatewayModal
        visible={gatewayModalVisible}
        onClose={() => setGatewayModalVisible(false)}
        onSelectGateway={(gw: 'paystack' | 'flutterwave') => {
          setGatewayModalVisible(false)
          startTopUp(gw)
        }}
        loading={topupLoading}
      />

      <TransactionReceiptModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onDispute={onDisputeTransaction}
      />

      <View style={styles.walletCard}>
        <View style={styles.walletGlow} />
        <View style={styles.walletGlowBottom} />
        <View style={styles.walletBody}>
          <View style={styles.walletHeader}>
            <View>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
                <Text style={styles.balanceCurrency}>₦</Text>
                <Text style={styles.balanceValue}>
                  {hideBalance ? '••••••' : (walletBalance !== null ? formatAmount(walletBalance) : '—')}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.walletIconWrap}
              onPress={() => setUIHideBalance(!hideBalance)}
              activeOpacity={0.7}
            >
              <MaterialIcons name={hideBalance ? 'visibility-off' : 'visibility'} size={20} color="rgba(255,255,255,0.8)" />
              {walletFlashVisible ? <View style={styles.walletFlashBadge} /> : null}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.quickActionRow}>
        <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.7} onPress={() => setFundModalVisible(true)}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#EDE7F6' }]}>
            <MaterialIcons name="add" size={22} color="#6A1B9A" />
          </View>
          <Text style={styles.quickActionText}>Fund</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.7} onPress={() => setTransferIdModalVisible(true)}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#E8F5E9' }]}>
            <MaterialIcons name="arrow-upward" size={22} color="#2E7D32" />
          </View>
          <Text style={styles.quickActionText}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.7} onPress={() => setReceiveModalVisible(true)}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#E3F2FD' }]}>
            <MaterialIcons name="qr-code" size={22} color="#1565C0" />
          </View>
          <Text style={styles.quickActionText}>Receive</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.7} onPress={openRecipientScanner}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#FFF3E0' }]}>
            <MaterialIcons name="qr-code-scanner" size={22} color="#E65100" />
          </View>
          <Text style={styles.quickActionText}>Scan</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity activeOpacity={0.7} onPress={loadWallet} style={styles.iconButtonWrap}>
            <MaterialIcons name="refresh" size={20} color="#6A1B9A" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={onViewAllTransactions} style={styles.iconButtonWrap}>
            <MaterialIcons name="receipt-long" size={20} color="#6A1B9A" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.activityList}>
        {loading ? (
          <View style={styles.activityLoadingWrap}>
            <LoadingOverlay visible={true} inline size={32} message="Loading transactions..." />
          </View>
        ) : activityItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <MaterialIcons name="receipt-long" size={32} color="#d1d5db" />
            </View>
            <Text style={styles.emptyStateTitle}>No transactions yet</Text>
            <Text style={styles.emptyStateSubtitle}>Your activity will appear here once you start using your wallet</Text>
          </View>
        ) : (
          activityItems.slice(0, 10).map((tx, index) => (
            <TouchableOpacity 
              style={[styles.activityItem, index === 0 && styles.activityItemFirst, index === Math.min(activityItems.length - 1, 9) && styles.activityItemLast]} 
              key={tx.id}
              activeOpacity={0.6}
              onPress={() => setSelectedTransaction(tx)}
            >
              <View style={[styles.activityLeft, { flex: 1 }]}>
                <View style={tx.transaction_type === 'credit' ? styles.activityIconAccent : styles.activityIconMuted}>
                  <MaterialIcons
                    name={getTransactionIcon(tx)}
                    size={18}
                    color={tx.transaction_type === 'credit' ? '#6A1B9A' : '#6b7280'}
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
                {tx.transaction_type === 'credit' ? '+₦' : '-₦'}{formatAmount(tx.amount)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>

        </View>
  )
}

const pinStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    width: '100%',
    alignItems: 'center',
  },
})

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 20,
  },

  walletCard: {
    backgroundColor: '#6A1B9A',
    borderRadius: 22,
    padding: 24,
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    overflow: 'hidden',
  },
  walletGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#ffffff',
    opacity: 0.12,
    top: -100,
    right: -80,
  },
  walletGlowBottom: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#ffffff',
    opacity: 0.08,
    bottom: -60,
    left: -40,
  },
  walletBody: {
    gap: 16,
  },
  quickActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    zIndex: 10,
  },
  quickActionBtn: {
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 0.2,
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
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  balanceCurrency: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  walletIconWrap: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 14,
    position: 'relative',
  },
  walletFlashBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#1C1C1E',
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
  scannerSafeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  scannerSafeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  scannerTopBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0)',
  },
  scannerTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 17,
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  scannerClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerSpacer: {
    width: 40,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrameBox: {
    width: 280,
    height: 280,
    borderRadius: 24,
    position: 'relative',
  },
  scannerCornerTL: {
    position: 'absolute', top: -2, left: -2, width: 40, height: 40,
    borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#ffffff',
    borderTopLeftRadius: 24,
  },
  scannerCornerTR: {
    position: 'absolute', top: -2, right: -2, width: 40, height: 40,
    borderTopWidth: 3, borderRightWidth: 3, borderColor: '#ffffff',
    borderTopRightRadius: 24,
  },
  scannerCornerBL: {
    position: 'absolute', bottom: -2, left: -2, width: 40, height: 40,
    borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#ffffff',
    borderBottomLeftRadius: 24,
  },
  scannerCornerBR: {
    position: 'absolute', bottom: -2, right: -2, width: 40, height: 40,
    borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#ffffff',
    borderBottomRightRadius: 24,
  },
  scannerHintWrap: {
    paddingBottom: 24,
    alignItems: 'center',
  },
  scannerHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  scannerHint: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#ffffff',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  sectionAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  activityList: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  activityLoadingWrap: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityItem: {
    backgroundColor: '#ffffff',
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  activityItemFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  activityItemLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 0,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIconMuted: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconAccent: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconGift: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FDF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.1,
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  activityAmountPositive: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2E7D32',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
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
    padding: 6,
    backgroundColor: 'rgba(106, 27, 154, 0.08)',
    borderRadius: 10,
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
