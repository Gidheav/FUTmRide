import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { WebView } from 'react-native-webview'
import api from '../../core/api'

export default function StudentWalletPage() {
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
  const [activeTab, setActiveTab] = useState<'fund' | 'transfer'>('fund')
  const [receiveModalVisible, setReceiveModalVisible] = useState(false)
  const [transferIdModalVisible, setTransferIdModalVisible] = useState(false)
  const [transferStudentId, setTransferStudentId] = useState('')

  const callbackUrl =
    process.env.EXPO_PUBLIC_PAYMENT_CALLBACK_URL ||
    'https://alpha-paroxysmic-revertively.ngrok-free.dev'

  const formatAmount = useCallback((value: number | string) => {
    const numeric = Number(value || 0)
    return `NGN ${numeric.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
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

  const loadWallet = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, txRes] = await Promise.all([
        api.get('users/me/student-profile/'),
        api.get('payments/wallet/transactions/?page=1&page_size=10'),
      ])
      setProfile(profileRes.data)
      const list = Array.isArray(txRes.data?.results) ? txRes.data.results : txRes.data || []
      setTransactions(Array.isArray(list) ? list : [])
    } catch (err) {
      setTopupError('Unable to load wallet data.')
    } finally {
      setLoading(false)
    }
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
        await loadWallet()
      } else if (status === 'failed' || status === 'abandoned') {
        setPendingReference(null)
        setTopupError('Top-up failed or was cancelled.')
      }
    } catch (err) {
      setTopupError('Unable to verify top-up status.')
    }
  }, [loadWallet])

  useEffect(() => {
    loadWallet()
  }, [loadWallet])

  useEffect(() => {
    if (!pendingReference) return
    const interval = setInterval(() => {
      checkTopupStatus(pendingReference)
    }, 5000)
    return () => clearInterval(interval)
  }, [pendingReference, checkTopupStatus])

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
      if (reference) setPendingReference(reference)
      if (paymentUrl) {
        setWebviewUrl(paymentUrl)
        setWebviewVisible(true)
      }
    } catch (err) {
      setTopupError('Failed to initiate top-up. Please try again.')
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

  const handleWebViewNavigation = useCallback((url: string) => {
    if (!url) return
    if (url.startsWith(callbackUrl)) {
      setWebviewVisible(false)
      const reference = parseReferenceFromUrl(url)
      if (reference) {
        setPendingReference(reference)
        checkTopupStatus(reference)
      }
    }
  }, [callbackUrl, checkTopupStatus, parseReferenceFromUrl])

  const activityItems = useMemo(() => {
    if (!Array.isArray(transactions)) return []
    return transactions
  }, [transactions])

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
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
              <View style={styles.barcodeLines}>
                <View style={styles.barcodeLine} />
                <View style={styles.barcodeLineShort} />
                <View style={styles.barcodeLine} />
                <View style={styles.barcodeLineShort} />
                <View style={styles.barcodeLine} />
              </View>
              <Text style={styles.barcodeValue}>LR-REC-2406-AB12</Text>
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
        visible={transferIdModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setTransferIdModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Transfer to student ID</Text>
            <Text style={styles.modalSubtitle}>Enter the recipient student ID to continue.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Student ID"
              value={transferStudentId}
              onChangeText={setTransferStudentId}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.primaryAction} activeOpacity={0.9}>
              <MaterialIcons name="send" size={18} color="#ffffff" />
              <Text style={styles.primaryActionText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setTransferIdModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={webviewVisible}
        animationType="slide"
        onRequestClose={() => setWebviewVisible(false)}
        statusBarTranslucent={false}
      >
        <SafeAreaView style={styles.webviewContainer}>
          <View style={styles.webviewHeader}>
            <Text style={styles.webviewTitle}>Complete Payment</Text>
            <TouchableOpacity onPress={() => setWebviewVisible(false)}>
              <MaterialIcons name="close" size={22} color="#1a1c1c" />
            </TouchableOpacity>
          </View>
          {webviewUrl ? (
            <WebView
              style={{ flex: 1 }}
              source={{ uri: webviewUrl }}
              originWhitelist={['https://*', 'http://*']}
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
                  <ActivityIndicator size="small" color="#6A1B9A" />
                  <Text style={styles.activityTime}>Loading checkout...</Text>
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
      <View style={styles.walletCard}>
        <View style={styles.walletGlow} />
        <View style={styles.walletBody}>
          <View style={styles.walletHeader}>
            <View>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <Text style={styles.balanceValue}>
                {profile ? formatAmount(profile.wallet_balance) : '--'}
              </Text>
            </View>
            <View style={styles.walletIconWrap}>
              <MaterialIcons name="account-balance-wallet" size={22} color="#6A1B9A" />
            </View>
          </View>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'fund' && styles.tabButtonActive]}
              onPress={() => setActiveTab('fund')}
            >
              <Text style={[styles.tabLabel, activeTab === 'fund' && styles.tabLabelActive]}>Fund</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'transfer' && styles.tabButtonActive]}
              onPress={() => setActiveTab('transfer')}
            >
              <Text style={[styles.tabLabel, activeTab === 'transfer' && styles.tabLabelActive]}>Transfer</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'fund' ? (
            <View style={styles.tabContent}>
              <View style={styles.topupRow}>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Amount (NGN)"
                  keyboardType="numeric"
                  value={topupAmount}
                  onChangeText={setTopupAmount}
                />
                <View style={styles.fundActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.primaryAction,
                      (topupLoading || Number(topupAmount) < 100) && styles.primaryActionDisabled,
                    ]}
                    activeOpacity={0.9}
                    onPress={handleTopUp}
                    disabled={topupLoading || Number(topupAmount) < 100}
                  >
                    {topupLoading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <MaterialIcons name="add-circle" size={18} color="#ffffff" />
                    )}
                    <Text style={styles.primaryActionText}>Top Up</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryAction}
                    activeOpacity={0.9}
                    onPress={() => setReceiveModalVisible(true)}
                  >
                    <MaterialIcons name="qr-code" size={18} color="#1a1c1c" />
                    <Text style={styles.secondaryActionText}>Receive</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {topupError ? <Text style={styles.errorText}>{topupError}</Text> : null}

            </View>
          ) : (
            <View style={styles.tabContent}>
              <View style={styles.transferCard}>
                <Text style={styles.transferTitle}>Send to another student</Text>
                <Text style={styles.transferSubtitle}>Use student ID or scan their barcode.</Text>
              </View>
              <View style={styles.walletActions}>
                <TouchableOpacity
                  style={styles.secondaryAction}
                  activeOpacity={0.9}
                  onPress={() => setTransferIdModalVisible(true)}
                >
                  <MaterialIcons name="badge" size={18} color="#1a1c1c" />
                  <Text style={styles.secondaryActionText}>Enter Student ID</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryAction} activeOpacity={0.9}>
                  <MaterialIcons name="qr-code-scanner" size={18} color="#1a1c1c" />
                  <Text style={styles.secondaryActionText}>Scan Recipient</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={styles.bonusBanner}>
        <View style={styles.bonusPattern} />
        <View style={styles.bonusContent}>
          <View style={styles.bonusLeft}>
            <View style={styles.bonusIcon}>
              <MaterialIcons name="redeem" size={18} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.bonusTitle}>Earn N500 Bonus</Text>
              <Text style={styles.bonusSubtitle}>Refer a friend to LR Ride</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.bonusButton} activeOpacity={0.9}>
            <Text style={styles.bonusButtonText}>Invite</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={loadWallet}>
          <Text style={styles.sectionAction}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.activityList}>
        {loading ? (
          <View style={styles.activityItem}>
            <ActivityIndicator size="small" color="#6A1B9A" />
            <Text style={styles.activityTime}>Loading transactions...</Text>
          </View>
        ) : activityItems.length === 0 ? (
          <View style={styles.activityItem}>
            <Text style={styles.activityTime}>No transactions yet.</Text>
          </View>
        ) : (
          activityItems.map((tx) => (
            <View style={styles.activityItem} key={tx.id}>
              <View style={styles.activityLeft}>
                <View style={tx.transaction_type === 'credit' ? styles.activityIconAccent : styles.activityIconMuted}>
                  <MaterialIcons
                    name={tx.transaction_type === 'credit' ? 'add-circle' : 'directions-car'}
                    size={20}
                    color={tx.transaction_type === 'credit' ? '#6A1B9A' : '#3d4a3e'}
                  />
                </View>
                <View>
                  <Text style={styles.activityTitle}>{tx.narration || 'Wallet transaction'}</Text>
                  <Text style={styles.activityTime}>{formatDate(tx.created_at)}</Text>
                </View>
              </View>
              <Text style={tx.transaction_type === 'credit' ? styles.activityAmountPositive : styles.activityAmount}>
                {tx.transaction_type === 'credit' ? '+' : '-'}{formatAmount(tx.amount)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 24,
  },
  walletCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f3f3f3',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    overflow: 'hidden',
  },
  walletGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#6A1B9A',
    opacity: 0.08,
    top: -48,
    right: -48,
  },
  walletBody: {
    gap: 16,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f3f3',
    borderRadius: 999,
    padding: 4,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#6A1B9A',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5e5e5e',
  },
  tabLabelActive: {
    color: '#ffffff',
  },
  tabContent: {
    gap: 12,
    minHeight: 150,
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
  barcodeWrap: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
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
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5e5e5e',
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1c1c',
    marginTop: 4,
  },
  walletIconWrap: {
    backgroundColor: '#f3e5f5',
    padding: 8,
    borderRadius: 10,
  },
  walletActions: {
    flexDirection: 'row',
    gap: 12,
  },
  transferCard: {
    backgroundColor: '#f7f2fb',
    borderRadius: 12,
    padding: 12,
    gap: 4,
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
    gap: 12,
  },
  activityItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f3f3',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
})
