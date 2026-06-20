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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import LoadingOverlay from '../components/LoadingOverlay';
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

export default function DriverWalletPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

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

  useEffect(() => {
    let isMounted = true;

    const loadWallet = async () => {
      try {
        setLoading(true);
        const [summaryRes, txRes, payoutRes, docsRes] = await Promise.all([
          driverWalletApi.getSummary(),
          driverWalletApi.getTransactions(),
          driverWalletApi.getPayoutMethod(),
          verificationApi.getMyDocuments(),
        ]);

        if (!isMounted) return;
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
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadWallet();
    return () => {
      isMounted = false;
    };
  }, [patchUser, setDocuments, setPayoutMethod, setSummary, setTransactions]);

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

  const chartSeries = useMemo(() => {
    const series = summary?.weekly_analytics?.series ?? [];
    const amounts = series.map((item) => Number(item.amount || 0));
    const max = Math.max(1, ...amounts);
    return series.map((item) => ({
      day: item.day_label,
      amount: Number(item.amount || 0),
      height: Math.max(12, Math.round((Number(item.amount || 0) / max) * 100)),
    }));
  }, [summary?.weekly_analytics?.series]);

  const latestDocument = useMemo(() => {
    if (!documents?.length) return null;
    return [...documents].sort((a, b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''))[0];
  }, [documents]);

  const filteredTransactions = useMemo(() => {
    if (!transactions?.length) return [];
    switch (activeFilter) {
      case 'Earned':
        return transactions.filter((tx) => tx.source === 'driver_earning');
      case 'Payouts':
        return transactions.filter((tx) => tx.source === 'driver_withdrawal');
      case 'Bonuses':
        return transactions.filter((tx) => ['promotion', 'admin_adjustment'].includes(tx.source));
      default:
        return transactions;
    }
  }, [activeFilter, transactions]);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      {/* ── Premium Balance Header Card ── */}
      <LinearGradient
        colors={[COLORS.primaryContainer, COLORS.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.balanceCard, AMBIENT_SHADOW]}
      >
        {/* Decorative blobs */}
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        <Text style={styles.balanceLabel}>Total Wallet Balance</Text>
        <Text style={styles.balanceAmount}>
          {formatCurrency(summary?.wallet_balance ?? user?.wallet_balance ?? 0)}
        </Text>

        <TouchableOpacity style={styles.cashOutBtn} activeOpacity={0.9} onPress={handleCashOut}>
          <MaterialIcons name="account-balance" size={18} color={COLORS.primary} />
          <Text style={[FONTS.labelLg, { color: COLORS.primary }]}>Cash Out to Bank</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Financial Goals Card ── */}
      <View style={[styles.card, AMBIENT_SHADOW]}>
        <View style={styles.goalHeader}>
          <View style={styles.goalTitleRow}>
            <MaterialIcons name="track-changes" size={18} color={COLORS.primaryContainer} />
            <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Daily Goal</Text>
          </View>
          <View style={styles.goalActionRow}>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}
            >{formatShortCurrency(summary?.daily_goal?.target ?? 0)}</Text>
            <TouchableOpacity style={styles.goalEditBtn} onPress={openGoalModal} activeOpacity={0.8}>
              <MaterialIcons name="edit" size={14} color={COLORS.primary} />
              <Text style={styles.goalEditText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.goalValues}>
          <Text style={[FONTS.headlineMd, { color: COLORS.primaryContainer }]}
          >{formatShortCurrency(summary?.daily_goal?.earned ?? 0)}</Text>
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}
          >{Math.round(summary?.daily_goal?.progress_percent ?? 0)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, Math.max(0, summary?.daily_goal?.progress_percent ?? 0))}%` },
            ]}
          />
        </View>
        <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, fontSize: 12 }]}>
          {summary?.daily_goal?.remaining
            ? `Just ${formatShortCurrency(summary.daily_goal.remaining)} to reach today's target!`
            : 'Set a goal to track your earnings.'}
        </Text>
      </View>

      {/* ── Earnings Analytics ── */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionLabel}>Earnings Analytics (This Week)</Text>
        <View style={[styles.card, AMBIENT_SHADOW]}>
          <View style={styles.analyticsTop}>
            <View>
              <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Total Earned</Text>
              <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>
                {formatShortCurrency(summary?.weekly_analytics?.total_earned ?? 0)}
              </Text>
            </View>
            <View style={styles.trendBadge}>
              <MaterialIcons
                name={(summary?.weekly_analytics?.change_percent ?? 0) >= 0 ? 'arrow-upward' : 'arrow-downward'}
                size={14}
                color={COLORS.surfaceTint}
              />
              <Text style={[FONTS.labelMd, { color: COLORS.surfaceTint }]}>
                {Math.abs(Math.round(summary?.weekly_analytics?.change_percent ?? 0))}%
              </Text>
            </View>
          </View>

          {/* Mini Bar Chart */}
          <View style={styles.chartRow}>
            {(chartSeries.length ? chartSeries : [
              { day: 'M', height: 12 },
              { day: 'T', height: 12 },
              { day: 'W', height: 12 },
              { day: 'T', height: 12 },
              { day: 'F', height: 12 },
              { day: 'S', height: 12 },
              { day: 'S', height: 12 },
            ]).map((bar, idx) => (
              <View key={idx} style={styles.chartCol}>
                <View style={styles.chartBarWrap}>
                  <View
                    style={[
                      styles.chartBar,
                      { height: `${bar.height}%` },
                      bar.height >= 80 && styles.chartBarActive,
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.chartLabel,
                    bar.height >= 80 && { color: COLORS.primary, fontWeight: '700' },
                  ]}
                >
                  {bar.day}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── Rewards & Status ── */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionLabel}>Rewards & Status</Text>
        <View style={[styles.rewardsCard, AMBIENT_SHADOW]}>
          <View style={styles.rewardsTop}>
            <View style={styles.rewardsLeft}>
              <View style={styles.rewardsIcon}>
                <MaterialIcons name="military-tech" size={28} color="#d97706" />
              </View>
              <View>
                <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}
                >{summary?.rewards?.tier ?? 'Driver'}</Text>
                <Text style={[FONTS.labelMd, { color: '#d97706' }]}>Active Tier</Text>
              </View>
            </View>
            <Text style={styles.rewardsPoints}>
              {(summary?.rewards?.points ?? 0).toLocaleString()}
              <Text style={styles.rewardsPtsSuffix}>pts</Text>
            </Text>
          </View>
          <View style={styles.rewardsFooter}>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant, fontSize: 12 }]}>
              Next tier: {summary?.rewards?.next_tier ?? 'Gold'} ({(summary?.rewards?.next_tier_points ?? 0).toLocaleString()} pts)
            </Text>
            <TouchableOpacity style={styles.viewPerksBtn} activeOpacity={0.7}>
              <Text style={[FONTS.labelMd, { color: COLORS.primaryContainer, fontSize: 12 }]}>
                View Perks
              </Text>
              <MaterialIcons name="chevron-right" size={14} color={COLORS.primaryContainer} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Payout Method & Tax Docs Grid ── */}
      <View style={styles.gridRow}>
        {/* Bank Account */}
        <View style={[styles.gridCell, AMBIENT_SHADOW]}>
          <View style={styles.gridCellHeader}>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Bank Account</Text>
            <TouchableOpacity onPress={openPayoutModal} activeOpacity={0.7}>
              <MaterialIcons name="edit" size={18} color={COLORS.primaryContainer} />
            </TouchableOpacity>
          </View>
          <View style={styles.gridCellBody}>
            <View style={styles.gridCellIcon}>
              <MaterialIcons name="account-balance" size={16} color={COLORS.onSurfaceVariant} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[FONTS.labelMd, { color: COLORS.onSurface }]} numberOfLines={1}>
                {effectivePayoutMethod?.bank_name || 'Add bank account'}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant }}>
                {effectivePayoutMethod?.account_number_masked || (effectivePayoutMethod?.account_last4 ? `**** ${effectivePayoutMethod.account_last4}` : 'No account on file')}
              </Text>
            </View>
          </View>
        </View>

        {/* Tax & Docs */}
        <View style={[styles.gridCell, AMBIENT_SHADOW]}>
          <View style={styles.gridCellHeader}>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Tax & Docs</Text>
            <MaterialIcons name="download" size={18} color={COLORS.onSurfaceVariant} />
          </View>
          <View style={styles.gridCellBody}>
            <View style={styles.gridCellIcon}>
              <MaterialIcons name="description" size={16} color={COLORS.onSurfaceVariant} />
            </View>
            <View>
              <Text style={[FONTS.labelMd, { color: COLORS.onSurface }]}>
                {latestDocument ? latestDocument.document_type.replace(/_/g, ' ') : 'Statements'}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant }}>
                {latestDocument ? new Date(latestDocument.uploaded_at).toLocaleDateString() : 'No statements yet'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Recent Transactions ── */}
      <View style={styles.sectionWrap}>
        <View style={styles.txnHeader}>
          <Text style={[FONTS.labelLg, { color: COLORS.onSurfaceVariant }]}>
            Recent Transactions
          </Text>
          <MaterialIcons name="search" size={20} color={COLORS.onSurfaceVariant} />
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterPill, activeFilter === tab && styles.filterPillActive]}
              onPress={() => setActiveFilter(tab)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  FONTS.labelMd,
                  {
                    color:
                      activeFilter === tab
                        ? COLORS.onPrimaryContainer
                        : COLORS.onSurfaceVariant,
                  },
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingRow}>
            <LoadingOverlay visible={true} inline size={40} />
            <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant }]}>Loading wallet activity...</Text>
          </View>
        ) : filteredTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="inbox" size={32} color={COLORS.outline} />
            <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 8 }]}>No transactions yet.</Text>
          </View>
        ) : (
          <View style={{ gap: 2 }}>
            {filteredTransactions.map((tx) => {
              const isCredit = tx.transaction_type === 'credit';
            const amountLabel = `${isCredit ? '+' : '-'}${formatShortCurrency(tx.amount)}`;
            const statusLabel = tx.status ? tx.status[0].toUpperCase() + tx.status.slice(1) : 'Completed';
            const statusStyle =
              tx.status === 'pending'
                ? styles.statusBadgePending
                : tx.status === 'failed'
                ? styles.statusBadgeFailed
                : isCredit
                ? styles.statusBadgeGreen
                : styles.statusBadgeGrey;
            const statusTextStyle =
              tx.status === 'pending'
                ? styles.statusBadgePendingText
                : tx.status === 'failed'
                ? styles.statusBadgeFailedText
                : isCredit
                ? styles.statusBadgeGreenText
                : styles.statusBadgeGreyText;

            const title =
              tx.source === 'driver_earning' && tx.ride_reference
                ? `Ride ${tx.ride_reference}`
                : tx.source === 'driver_withdrawal'
                ? 'Bank Transfer'
                : tx.source === 'promotion'
                ? 'Bonus'
                : tx.narration || 'Wallet activity';

            const metaItems: Array<{ icon: keyof typeof MaterialIcons.glyphMap; label: string; highlight?: boolean }>
              = [];
            if (tx.ride_distance_km) {
              metaItems.push({ icon: 'route', label: `${tx.ride_distance_km} km` });
            }
            if (tx.ride_duration_minutes) {
              metaItems.push({ icon: 'schedule', label: `${tx.ride_duration_minutes} min` });
            }
            if (tx.metadata?.bank_name || tx.metadata?.account_last4) {
              const bankLabel = tx.metadata?.bank_name
                ? `${tx.metadata.bank_name}${tx.metadata?.account_last4 ? ` ending ${tx.metadata.account_last4}` : ''}`
                : `Account ending ${tx.metadata.account_last4}`;
              metaItems.push({ icon: 'account-balance', label: bankLabel });
            }

            const iconName =
              tx.source === 'driver_earning'
                ? 'directions-car'
                : tx.source === 'driver_withdrawal'
                ? 'account-balance-wallet'
                : tx.source === 'promotion'
                ? 'stars'
                : 'payments';

            const iconBg =
              tx.source === 'driver_earning'
                ? COLORS.primaryContainer + '1A'
                : tx.source === 'promotion'
                ? '#fef3c7'
                : COLORS.surfaceContainerHighest;

            const iconColor =
              tx.source === 'driver_earning'
                ? COLORS.primaryContainer
                : tx.source === 'promotion'
                ? '#d97706'
                : COLORS.onSurfaceVariant;

            return (
              <TouchableOpacity
                key={tx.id}
                style={[styles.txnCard, AMBIENT_SHADOW]}
                activeOpacity={0.8}
                onPress={() => setSelectedTransaction({
                  ...tx,
                  title,
                  isCredit,
                  amountLabel,
                  statusLabel,
                  iconName,
                  iconColor,
                  iconBg,
                })}
              >
                <View style={styles.txnRow}>
                  <View style={styles.txnLeft}>
                    <View style={[styles.txnIcon, { backgroundColor: iconBg }]}>
                      <MaterialIcons name={iconName as any} size={20} color={iconColor} />
                    </View>
                    <View>
                      <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>{title}</Text>
                      <Text style={styles.txnDate}>{formatDate(tx.created_at)}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[FONTS.labelLg, { color: isCredit ? COLORS.primaryContainer : COLORS.onSurface }]}>
                      {amountLabel}
                    </Text>
                    <View style={statusStyle}>
                      <Text style={statusTextStyle}>{statusLabel}</Text>
                    </View>
                  </View>
                </View>
                {metaItems.length ? (
                  <View style={styles.txnMeta}>
                    {metaItems.map((item, idx) => (
                      <View key={`${tx.id}-meta-${idx}`} style={styles.txnMetaItem}>
                        <MaterialIcons name={item.icon} size={14} color={item.highlight ? COLORS.primary : COLORS.onSurfaceVariant} />
                        <Text style={[styles.txnMetaText, item.highlight && { color: COLORS.primary }]}> {item.label}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
            })}
          </View>
        )}

        {/* View All */}
        <TouchableOpacity style={styles.viewAllBtn} activeOpacity={0.8}>
          <Text style={[FONTS.labelMd, { color: COLORS.primaryContainer }]}>
            View All Transactions
          </Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

      <Modal
        visible={showPayoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPayoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, AMBIENT_SHADOW]}>
            <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>Payout Method</Text>
            <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 4 }]}
            >Add or update your bank account.</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Bank name</Text>
              <TextInput
                style={styles.modalInput}
                value={bankName}
                onChangeText={setBankName}
                placeholder="Access Bank"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Bank code (optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={bankCode}
                onChangeText={setBankCode}
                placeholder="044"
                placeholderTextColor={COLORS.outline}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Account name</Text>
              <TextInput
                style={styles.modalInput}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Account holder"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Account number</Text>
              <TextInput
                style={styles.modalInput}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="0123456789"
                placeholderTextColor={COLORS.outline}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowPayoutModal(false)}
              >
                <Text style={[FONTS.labelLg, { color: COLORS.onSurfaceVariant }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={savePayoutMethod}
                disabled={savingPayout}
              >
                <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
          <LoadingOverlay visible={savingPayout} />
        </View>
      </Modal>

      <Modal
        visible={showGoalModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, AMBIENT_SHADOW]}>
            <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>Daily Goal</Text>
            <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 4 }]}
            >Set your daily earnings target.</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Target amount (NGN)</Text>
              <TextInput
                style={styles.modalInput}
                value={goalInput}
                onChangeText={setGoalInput}
                placeholder="15000"
                placeholderTextColor={COLORS.outline}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowGoalModal(false)}
              >
                <Text style={[FONTS.labelLg, { color: COLORS.onSurfaceVariant }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={saveDailyGoal}
                disabled={savingGoal}
              >
                <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
          <LoadingOverlay visible={savingGoal} />
        </View>
      </Modal>

      {/* ── Transaction Details Modal ── */}
      <Modal
        visible={!!selectedTransaction}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTransaction(null)}
      >
        <View style={styles.modalOverlay}>
          {selectedTransaction && (
            <View style={[styles.receiptCard, AMBIENT_SHADOW]}>
              <View style={styles.receiptHeader}>
                <MaterialIcons
                  name={
                    selectedTransaction.source === 'driver_earning' ? 'check-circle' :
                    selectedTransaction.source === 'driver_withdrawal' ? 'account-balance' :
                    selectedTransaction.iconName as any
                  }
                  size={48}
                  color={selectedTransaction.isCredit ? '#2e7d32' : (selectedTransaction.source === 'driver_withdrawal' ? '#b91c1c' : selectedTransaction.iconColor)}
                />
                <Text style={[styles.receiptAmount, { color: selectedTransaction.isCredit ? '#2e7d32' : '#b91c1c' }]}>
                  {selectedTransaction.amountLabel}
                </Text>
                <Text style={styles.receiptTitle}>{selectedTransaction.title}</Text>
                <Text style={styles.receiptDate}>{formatDate(selectedTransaction.created_at)}</Text>
              </View>

              <View style={styles.receiptDivider} />

              <ScrollView style={styles.receiptBody} showsVerticalScrollIndicator={false}>
                {selectedTransaction.source === 'driver_earning' && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Passenger / Sender</Text>
                    <Text style={styles.receiptValue}>{selectedTransaction.ride_passenger_name || 'Student'}</Text>
                  </View>
                )}

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Details</Text>
                  <Text style={styles.receiptValue}>{selectedTransaction.narration || 'Wallet activity'}</Text>
                </View>

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Status</Text>
                  <Text style={styles.receiptValue}>{selectedTransaction.statusLabel}</Text>
                </View>

                {selectedTransaction.source === 'driver_earning' && (
                  <>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Ride Reference</Text>
                      <Text style={styles.receiptValue}>{selectedTransaction.ride_reference}</Text>
                    </View>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Distance</Text>
                      <Text style={styles.receiptValue}>{selectedTransaction.ride_distance_km ? `${selectedTransaction.ride_distance_km} km` : 'N/A'}</Text>
                    </View>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Duration</Text>
                      <Text style={styles.receiptValue}>{selectedTransaction.ride_duration_minutes ? `${selectedTransaction.ride_duration_minutes} min` : 'N/A'}</Text>
                    </View>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Pickup</Text>
                      <Text style={styles.receiptValue}>{selectedTransaction.ride_pickup_address || 'N/A'}</Text>
                    </View>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Dropoff</Text>
                      <Text style={styles.receiptValue}>{selectedTransaction.ride_dropoff_address || 'N/A'}</Text>
                    </View>
                  </>
                )}

                {selectedTransaction.source === 'driver_withdrawal' && selectedTransaction.metadata && (
                  <>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Destination Bank</Text>
                      <Text style={styles.receiptValue}>{selectedTransaction.metadata.bank_name || 'N/A'}</Text>
                    </View>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Account Details</Text>
                      <Text style={styles.receiptValue}>
                        {selectedTransaction.metadata.account_name || 'N/A'} 
                        {selectedTransaction.metadata.account_last4 ? ` (**** ${selectedTransaction.metadata.account_last4})` : ''}
                      </Text>
                    </View>
                  </>
                )}
                
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Transaction Reference</Text>
                  <Text style={[styles.receiptValue, { fontSize: 12, color: COLORS.onSurfaceVariant }]}>{selectedTransaction.reference}</Text>
                </View>
              </ScrollView>

              <View style={styles.receiptDivider} />

              <TouchableOpacity
                style={styles.receiptCloseButton}
                onPress={() => setSelectedTransaction(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.receiptCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 112,
    gap: 24,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 16,
  },

  /* ── Balance Card ── */
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  blob2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.24,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
    zIndex: 1,
  },
  balanceAmount: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.8,
    marginBottom: 24,
    zIndex: 1,
  },
  cashOutBtn: {
    width: '100%',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 1,
    ...AMBIENT_SHADOW,
  },

  /* ── Card base ── */
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },

  /* ── Daily Goal ── */
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  goalEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goalValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 5,
  },

  /* ── Sections ── */
  sectionWrap: { gap: 12 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.14,
    color: COLORS.onSurfaceVariant,
    paddingHorizontal: 4,
  },

  /* ── Earnings Analytics ── */
  analyticsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.primaryFixedDim + '33',
    borderWidth: 1,
    borderColor: COLORS.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 96,
    gap: 4,
    marginTop: 8,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    height: '100%',
  },
  chartBarWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    backgroundColor: COLORS.surfaceContainer,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  chartBarActive: {
    backgroundColor: COLORS.primaryContainer,
  },
  chartLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },

  /* ── Rewards ── */
  rewardsCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.3)',
  },
  rewardsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rewardsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rewardsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardsPoints: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.24,
    color: '#d97706',
  },
  rewardsPtsSuffix: {
    fontSize: 14,
    fontWeight: '400',
  },
  rewardsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceContainer,
    paddingTop: 12,
    marginTop: 4,
  },
  viewPerksBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  /* ── Grid ── */
  gridRow: {
    flexDirection: 'row',
    gap: 16,
  },
  gridCell: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    gap: 12,
  },
  gridCellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridCellBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  gridCellIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Transactions ── */
  txnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: COLORS.surfaceContainer,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHighest,
  },
  filterPillActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primaryContainer,
  },
  txnCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    gap: 12,
  },
  txnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  txnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnDate: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
  },
  txnMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceContainerLow,
    paddingTop: 8,
  },
  txnMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  txnMetaText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.24,
    color: COLORS.onSurfaceVariant,
  },
  statusBadgeGreen: {
    backgroundColor: COLORS.primaryFixedDim + '33',
    borderWidth: 1,
    borderColor: COLORS.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  statusBadgeGreenText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.surfaceTint,
  },
  statusBadgeGrey: {
    backgroundColor: COLORS.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: COLORS.surfaceDim,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  statusBadgeGreyText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  statusBadgePending: {
    backgroundColor: COLORS.surfaceContainer,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  statusBadgePendingText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  statusBadgeFailed: {
    backgroundColor: COLORS.errorContainer,
    borderWidth: 1,
    borderColor: COLORS.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  statusBadgeFailedText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.error,
  },
  viewAllBtn: {
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHigh,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalField: {
    gap: 6,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHigh,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHigh,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  modalSave: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    maxHeight: '90%',
  },
  receiptHeader: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  receiptAmount: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
    textAlign: 'center',
    marginTop: 4,
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
    paddingRight: 4,
  },
  receiptRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 16,
  },
  receiptLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  receiptValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
    lineHeight: 20,
  },
  receiptCloseButton: {
    backgroundColor: '#f5effb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  receiptCloseText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 15,
  },
});
