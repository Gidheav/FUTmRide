import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  TextInput,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import LoadingOverlay from '../components/LoadingOverlay';
import CustomRefreshScrollView from '../components/CustomRefreshScrollView';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import { driverApi, driverWalletApi, verificationApi } from '../../core/api';
import { useAuthStore } from '../../core/authStore';
import { useDriverWalletStore } from '../../core/driverWalletStore';

const FILTER_TABS = ['All', 'Earned', 'Payouts', 'Bonuses'];

const formatCurrency = (value?: string | number | null) => {
  if (value === null || value === undefined) return '₦0.00';
  const num = Number(value);
  if (Number.isNaN(num)) return '₦0.00';
  return `₦${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatShortCurrency = (value?: string | number | null) => {
  if (value === null || value === undefined) return '₦0';
  const num = Number(value);
  if (Number.isNaN(num)) return '₦0';
  return `₦${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function DriverWalletPage({ onNavigateToAllTransactions }: { onNavigateToAllTransactions?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [isBalanceHidden, setIsBalanceHidden] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('hideDriverBalance').then((val) => {
      if (val !== null) setIsBalanceHidden(val === 'true');
    });
  }, []);

  const toggleBalance = () => {
    const nextVal = !isBalanceHidden;
    setIsBalanceHidden(nextVal);
    AsyncStorage.setItem('hideDriverBalance', String(nextVal));
  };
  const [goalInput, setGoalInput] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { user, patchUser } = useAuthStore();
  const {
    summary,
    transactions,
    payoutMethod,
    documents,
    setSummary,
    setTransactions,
    setPayoutMethod,
    setDocuments,
  } = useDriverWalletStore();

  const effectivePayoutMethod = payoutMethod || summary?.payout_method || null;
  const availableBalance = Number(summary?.wallet_balance ?? user?.wallet_balance ?? 0);

  const fetchWalletData = async () => {
    try {
      const [summaryRes, txRes, payoutRes, docsRes] = await Promise.all([
        driverWalletApi.getSummary(),
        driverWalletApi.getTransactions(),
        driverWalletApi.getPayoutMethod(),
        verificationApi.getMyDocuments(),
      ]);

      setSummary(summaryRes?.data ?? null);
      if (summaryRes?.data?.wallet_balance !== undefined) {
        patchUser({ wallet_balance: summaryRes.data.wallet_balance });
      }

      const txList = Array.isArray(txRes?.data) ? txRes.data : txRes?.data?.results || [];
      setTransactions(txList);

      setPayoutMethod(payoutRes?.data?.payout_method ?? null);

      const docList = Array.isArray(docsRes?.data) ? docsRes.data : docsRes?.data?.results || [];
      setDocuments(docList);
    } catch (error) {
      console.warn('[DriverWallet] load failed:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadWallet = async () => {
      setLoading(true);
      await fetchWalletData();
      if (isMounted) setLoading(false);
    };
    loadWallet();
    return () => {
      isMounted = false;
    };
  }, [patchUser, setDocuments, setPayoutMethod, setSummary, setTransactions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWalletData();
    setRefreshing(false);
  };

  const openPayoutModal = () => {
    setBankName(effectivePayoutMethod?.bank_name ?? '');
    setBankCode(effectivePayoutMethod?.bank_code ?? '');
    setAccountName(effectivePayoutMethod?.account_name ?? '');
    setAccountNumber('');
    setShowPayoutModal(true);
  };

  const openGoalModal = () => {
    const currentTarget = summary?.daily_goal?.target ?? '';
    setGoalInput(currentTarget ? String(currentTarget) : '');
    setShowGoalModal(true);
  };

  const savePayoutMethod = async () => {
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      Alert.alert('Missing details', 'Bank name, account name, and account number are required.');
      return;
    }
    setSavingPayout(true);
    try {
      const response = await driverWalletApi.updatePayoutMethod({
        bank_name: bankName.trim(),
        bank_code: bankCode.trim(),
        account_name: accountName.trim(),
        account_number: accountNumber.trim(),
      });
      setPayoutMethod(response?.data?.payout_method ?? null);
      setShowPayoutModal(false);
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.detail ||
        'Failed to save payout method.';
      Alert.alert('Error', message);
    } finally {
      setSavingPayout(false);
    }
  };

  const saveDailyGoal = async () => {
    const cleaned = goalInput.replace(/,/g, '').trim();
    if (cleaned) {
      const value = Number(cleaned);
      if (Number.isNaN(value) || value <= 0) {
        Alert.alert('Invalid amount', 'Enter a daily goal greater than zero.');
        return;
      }
    }
    setSavingGoal(true);
    try {
      await driverApi.updateProfile({
        daily_goal_target: cleaned ? Number(cleaned) : null,
      });
      const summaryRes = await driverWalletApi.getSummary();
      setSummary(summaryRes?.data ?? null);
      setShowGoalModal(false);
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.detail ||
        'Failed to update daily goal.';
      Alert.alert('Error', message);
    } finally {
      setSavingGoal(false);
    }
  };

  const handleCashOut = () => {
    if (!effectivePayoutMethod) {
      Alert.alert('Add payout method', 'Please add your bank account before withdrawing.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add now', onPress: openPayoutModal },
      ]);
      return;
    }
    if (!availableBalance || availableBalance <= 0) {
      Alert.alert('No balance', 'You have no available balance to withdraw.');
      return;
    }
    Alert.alert(
      'Confirm cash out',
      `Withdraw ${formatCurrency(availableBalance)} to ${effectivePayoutMethod.bank_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: async () => {
            try {
              await driverWalletApi.requestWithdrawal({ amount: availableBalance });
              const summaryRes = await driverWalletApi.getSummary();
              setSummary(summaryRes?.data ?? null);
              if (summaryRes?.data?.wallet_balance !== undefined) {
                patchUser({ wallet_balance: summaryRes.data.wallet_balance });
              }
              const txRes = await driverWalletApi.getTransactions();
              const txList = Array.isArray(txRes?.data) ? txRes.data : txRes?.data?.results || [];
              setTransactions(txList);
              Alert.alert('Withdrawal requested', 'Your cash out request is pending.');
            } catch (error: any) {
              const msg =
                error?.response?.data?.error?.message ||
                error?.response?.data?.detail ||
                'Withdrawal request failed.';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const latestDocument = useMemo(() => {
    if (!documents?.length) return null;
    return [...documents].sort((a, b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''))[0];
  }, [documents]);

  const recentTransactions = useMemo(() => {
    if (!transactions?.length) return [];
    return transactions.slice(0, 5);
  }, [transactions]);

  return (
    <>
      <CustomRefreshScrollView
        refreshing={refreshing}
        onRefresh={onRefresh}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Premium Header ── */}
        <View style={styles.headerCard}>
          <View style={styles.headerCardGlow} />
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={styles.headerCardLabel}>Available Balance</Text>
              <Text style={styles.headerCardBalance}>
                {isBalanceHidden ? '₦****' : formatCurrency(summary?.wallet_balance ?? user?.wallet_balance ?? 0)}
              </Text>
            </View>
            <TouchableOpacity onPress={toggleBalance} style={{ padding: 4, marginTop: -4 }}>
              <MaterialIcons name={isBalanceHidden ? 'visibility-off' : 'visibility'} size={24} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cashOutBtn} activeOpacity={0.8} onPress={handleCashOut}>
              <Text style={styles.cashOutBtnText}>Cash Out</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#0f0a1a" />
            </TouchableOpacity>
        </View>


        {/* ── Daily Goal Inline ── */}
        <View style={styles.inlineGoal}>
          <View style={styles.inlineGoalTop}>
            <Text style={styles.inlineGoalTitle}>Daily Goal Progress</Text>
            <TouchableOpacity onPress={openGoalModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.inlineGoalEdit}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, Math.max(0, summary?.daily_goal?.progress_percent ?? 0))}%` },
              ]}
            />
          </View>
          <View style={styles.inlineGoalBottom}>
            <Text style={styles.inlineGoalText}>
              {summary?.daily_goal?.remaining
                ? `Need ${formatShortCurrency(summary.daily_goal.remaining)} to hit your goal`
                : 'Goal reached! Incredible job.'}
            </Text>
            <Text style={styles.inlineGoalTarget}>
              {formatShortCurrency(summary?.daily_goal?.target ?? 0)}
            </Text>
          </View>
        </View>

        {/* ── Settings Stack ── */}
        <View style={styles.settingsStack}>
          <TouchableOpacity style={styles.settingRow} onPress={openPayoutModal} activeOpacity={0.7}>
            <View style={styles.settingIconWrap}>
              <MaterialIcons name="account-balance" size={18} color="#4b5563" />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Bank Account</Text>
              <Text style={styles.settingSub} numberOfLines={1}>
                {effectivePayoutMethod?.bank_name
                  ? `${effectivePayoutMethod.bank_name} •••• ${effectivePayoutMethod.account_last4 || ''}`
                  : 'Add your bank details to cash out'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
            <View style={styles.settingIconWrap}>
              <MaterialIcons name="receipt-long" size={18} color="#4b5563" />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Tax & Documents</Text>
              <Text style={styles.settingSub} numberOfLines={1}>
                {latestDocument ? `Latest: ${new Date(latestDocument.uploaded_at).toLocaleDateString()}` : 'No statements available'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* ── Transactions ── */}
        <View style={styles.transactionsHeader}>
          <Text style={styles.transactionsTitle}>Recent Transactions</Text>
          {onNavigateToAllTransactions && (
            <TouchableOpacity onPress={onNavigateToAllTransactions} style={{ padding: 4 }}>
              <MaterialIcons name="receipt-long" size={22} color="#6A1B9A" />
            </TouchableOpacity>
          )}
        </View>


        <View style={styles.transactionList}>
          {loading ? (
            <View style={styles.loadingRow}>
              <LoadingOverlay visible={true} inline size={40} />
            </View>
          ) : recentTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="receipt" size={32} color="#e5e7eb" />
              <Text style={styles.emptyStateText}>No recent activity.</Text>
            </View>
          ) : (
            recentTransactions.map((tx, index) => {
              const isCredit = tx.transaction_type === 'credit';
              const amountLabel = `${isCredit ? '+' : '-'}${formatShortCurrency(tx.amount)}`;
              const statusLabel = tx.status ? tx.status[0].toUpperCase() + tx.status.slice(1) : 'Completed';
              
              const title = tx.source === 'driver_earning' && tx.ride_reference
                ? `Ride ${tx.ride_reference}`
                : tx.source === 'driver_withdrawal'
                ? 'Cash Out'
                : tx.source === 'promotion'
                ? 'Bonus'
                : tx.narration || 'Wallet activity';

              const iconName = tx.source === 'driver_earning'
                ? 'local-taxi'
                : tx.source === 'driver_withdrawal'
                ? 'account-balance'
                : tx.source === 'promotion'
                ? 'redeem'
                : 'payments';

              return (
                <View key={tx.id}>
                  {index > 0 && <View style={styles.txnDivider} />}
                  <TouchableOpacity
                    style={styles.txnRow}
                    activeOpacity={0.7}
                    onPress={() => setSelectedTransaction({
                      ...tx, title, isCredit, amountLabel, statusLabel, iconName
                    })}
                  >
                    <View style={[styles.txnIconCircle, !isCredit && styles.txnIconCircleDebit]}>
                      <MaterialIcons name={iconName as any} size={18} color={isCredit ? '#6A1B9A' : '#4b5563'} />
                    </View>
                    <View style={styles.txnDetails}>
                      <Text style={styles.txnTitle} numberOfLines={1}>{title}</Text>
                      <Text style={styles.txnDate}>{formatDate(tx.created_at)}</Text>
                    </View>
                    <View style={styles.txnAmounts}>
                      <Text style={[styles.txnAmount, !isCredit && styles.txnAmountDebit]}>
                        {amountLabel}
                      </Text>
                      {tx.status !== 'completed' && (
                        <Text style={[styles.txnStatus, tx.status === 'failed' && { color: '#ef4444' }]}>
                          {statusLabel}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        <TouchableOpacity style={styles.viewAllBtn} activeOpacity={0.8}>
          <Text style={styles.viewAllBtnText}>See All Transactions</Text>
        </TouchableOpacity>
      </CustomRefreshScrollView>

      {/* ── Modals ── */}
      <Modal visible={showPayoutModal} transparent animationType="fade" onRequestClose={() => setShowPayoutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Payout Method</Text>
            <Text style={styles.modalSubtitle}>Link your bank account to cash out.</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Bank name</Text>
              <TextInput style={styles.modalInput} value={bankName} onChangeText={setBankName} placeholder="Access Bank" placeholderTextColor="#9ca3af" />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Account name</Text>
              <TextInput style={styles.modalInput} value={accountName} onChangeText={setAccountName} placeholder="John Doe" placeholderTextColor="#9ca3af" />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Account number</Text>
              <TextInput style={styles.modalInput} value={accountNumber} onChangeText={setAccountNumber} placeholder="0123456789" placeholderTextColor="#9ca3af" keyboardType="numeric" />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Bank code (optional)</Text>
              <TextInput style={styles.modalInput} value={bankCode} onChangeText={setBankCode} placeholder="044" placeholderTextColor="#9ca3af" keyboardType="numeric" />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPayoutModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={savePayoutMethod} disabled={savingPayout}>
                <Text style={styles.modalSaveText}>Save Bank</Text>
              </TouchableOpacity>
            </View>
          </View>
          <LoadingOverlay visible={savingPayout} />
        </View>
      </Modal>

      <Modal visible={showGoalModal} transparent animationType="fade" onRequestClose={() => setShowGoalModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Daily Goal</Text>
            <Text style={styles.modalSubtitle}>Set a target to keep yourself motivated.</Text>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Target amount (NGN)</Text>
              <TextInput style={styles.modalInput} value={goalInput} onChangeText={setGoalInput} placeholder="15000" placeholderTextColor="#9ca3af" keyboardType="numeric" />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowGoalModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveDailyGoal} disabled={savingGoal}>
                <Text style={styles.modalSaveText}>Set Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
          <LoadingOverlay visible={savingGoal} />
        </View>
      </Modal>

      <Modal visible={!!selectedTransaction} transparent animationType="slide" onRequestClose={() => setSelectedTransaction(null)}>
        <Pressable style={styles.modalOverlayBottom} onPress={() => setSelectedTransaction(null)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
          {selectedTransaction && (
            <View style={styles.receiptSheet}>
              <View style={styles.receiptHandle} />
              <View style={styles.receiptIconWrap}>
                <MaterialIcons name={selectedTransaction.iconName} size={28} color={selectedTransaction.isCredit ? '#6A1B9A' : '#4b5563'} />
              </View>
              <Text style={[styles.receiptAmount, !selectedTransaction.isCredit && { color: '#111827' }]}>
                {selectedTransaction.amountLabel}
              </Text>
              <Text style={styles.receiptTitle}>{selectedTransaction.title}</Text>
              <Text style={styles.receiptDate}>{formatDate(selectedTransaction.created_at)}</Text>

              <View style={styles.receiptDivider} />

              <View style={styles.receiptDetails}>
                <View style={styles.receiptRowItem}>
                  <Text style={styles.receiptLabel}>Status</Text>
                  <Text style={styles.receiptValue}>{selectedTransaction.statusLabel}</Text>
                </View>
                <View style={styles.receiptRowItem}>
                  <Text style={styles.receiptLabel}>Reference</Text>
                  <Text style={styles.receiptValue}>{selectedTransaction.reference}</Text>
                </View>
                
                {selectedTransaction.source === 'driver_earning' && (
                  <>
                    <View style={styles.receiptRowItem}>
                      <Text style={styles.receiptLabel}>Distance</Text>
                      <Text style={styles.receiptValue}>{selectedTransaction.ride_distance_km ? `${selectedTransaction.ride_distance_km} km` : 'N/A'}</Text>
                    </View>
                    <View style={styles.receiptRowItem}>
                      <Text style={styles.receiptLabel}>Duration</Text>
                      <Text style={styles.receiptValue}>{selectedTransaction.ride_duration_minutes ? `${selectedTransaction.ride_duration_minutes} min` : 'N/A'}</Text>
                    </View>
                  </>
                )}
              </View>

              <TouchableOpacity style={styles.receiptCloseBtn} onPress={() => setSelectedTransaction(null)}>
                <Text style={styles.receiptCloseText}>Close Receipt</Text>
              </TouchableOpacity>
            </View>
          )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  headerCard: {
    backgroundColor: '#4A148C',
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    shadowColor: '#6A1B9A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  headerCardGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#6A1B9A',
    opacity: 0.2,
  },
  headerCardInner: {
    zIndex: 1,
  },
  headerCardLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#a78bfa',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerCardBalance: {
    fontFamily: 'Inter-Bold',
    fontSize: 36,
    color: '#ffffff',
    letterSpacing: -1,
    marginBottom: 20,
  },
  cashOutBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  cashOutBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#0f0a1a',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    marginBottom: 12,
  },
  statChipLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  statChipValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#111827',
  },
  inlineGoal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  inlineGoalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inlineGoalTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#111827',
  },
  inlineGoalEdit: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#6A1B9A',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6A1B9A',
    borderRadius: 3,
  },
  inlineGoalBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inlineGoalText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#6b7280',
  },
  inlineGoalTarget: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#374151',
  },
  settingsStack: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextWrap: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#111827',
  },
  settingSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 60,
  },
  transactionsHeader: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionsTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#111827',
  },
  filterRow: {
    gap: 8,
    paddingBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterPillActive: {
    backgroundColor: '#6A1B9A',
    borderColor: '#6A1B9A',
  },
  filterPillText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#4b5563',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  transactionList: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
  },
  txnDivider: {
    height: 1,
    backgroundColor: '#f9fafb',
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  txnIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5effb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnIconCircleDebit: {
    backgroundColor: '#f3f4f6',
  },
  txnDetails: {
    flex: 1,
  },
  txnTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#111827',
    marginBottom: 2,
  },
  txnDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#9ca3af',
  },
  txnAmounts: {
    alignItems: 'flex-end',
  },
  txnAmount: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#6A1B9A',
  },
  txnAmountDebit: {
    color: '#111827',
  },
  txnStatus: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  viewAllBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  viewAllBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#6A1B9A',
  },
  loadingRow: {
    padding: 32,
    alignItems: 'center',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#111827',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  modalField: {
    marginBottom: 16,
  },
  modalLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  modalCancelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#4b5563',
  },
  modalSave: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#0f0a1a',
  },
  modalSaveText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#ffffff',
  },
  modalOverlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  receiptSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  receiptHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    marginBottom: 24,
  },
  receiptIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  receiptAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 32,
    color: '#6A1B9A',
    marginBottom: 4,
  },
  receiptTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#374151',
  },
  receiptDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  receiptDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#e5e7eb',
    borderStyle: 'dashed',
    marginVertical: 24,
  },
  receiptDetails: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  receiptRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#6b7280',
  },
  receiptValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#111827',
  },
  receiptCloseBtn: {
    width: '100%',
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: 'center',
  },
  receiptCloseText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#111827',
  },
});
