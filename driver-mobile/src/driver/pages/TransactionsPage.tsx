import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import LoadingOverlay from '../components/LoadingOverlay';
import CustomRefreshScrollView from '../components/CustomRefreshScrollView';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import { driverWalletApi } from '../../core/api';
import { useAuthStore } from '../../core/authStore';
import { useDriverWalletStore } from '../../core/driverWalletStore';

const FILTER_TABS = ['All', 'Earned', 'Payouts', 'Bonuses'];

const formatCurrency = (value?: string | number | null) => {
  if (value === null || value === undefined) return '₦0.00';
  const num = Number(value);
  if (isNaN(num)) return '₦0.00';
  return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function DriverTransactionsPage() {
  const { user } = useAuthStore();
  const { transactions, setTransactions } = useDriverWalletStore();
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(transactions.length === 0);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactionsData = async () => {
    try {
      const txData = await driverWalletApi.getTransactions();
      const txList = Array.isArray(txData?.data) ? txData.data : txData?.data?.results || (txData as any)?.results || [];
      setTransactions(txList);
    } catch (err) {
      console.warn('Failed to fetch transactions:', err);
    }
  };

  useEffect(() => {
    fetchTransactionsData().finally(() => {
      setLoading(false);
    });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactionsData();
    setRefreshing(false);
  };

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
      <CustomRefreshScrollView
        refreshing={refreshing}
        onRefresh={onRefresh}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

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
              <Text style={[styles.filterPillText, activeFilter === tab && styles.filterPillTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.transactionsList}>
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: '#6b7280' }}>Loading transactions...</Text>
            </View>
          ) : filteredTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="receipt-long" size={48} color="#e5e7eb" />
              <Text style={styles.emptyText}>No {activeFilter.toLowerCase()} transactions found</Text>
            </View>
          ) : (
            filteredTransactions.map((tx, i) => {
              const isCredit = ['driver_earning', 'promotion', 'admin_adjustment', 'fund_transfer'].includes(tx.source);
              let amountColor = '#4b5563'; // neutral for debits
              let sign = '-';
              if (isCredit) {
                amountColor = '#6A1B9A';
                sign = '+';
              }
              const iconName = tx.source === 'driver_earning' ? 'directions-car' :
                               tx.source === 'driver_withdrawal' ? 'account-balance' :
                               'payments';
              
              const iconBg = isCredit ? '#f3e8ff' : '#f3f4f6';
              const iconColor = isCredit ? '#7e22ce' : '#4b5563';

              return (
                <TouchableOpacity
                  key={tx.id || i}
                  style={styles.txRow}
                  activeOpacity={0.7}
                  onPress={() => setSelectedTransaction({ ...tx, isCredit, iconName, amountLabel: `${sign}${formatCurrency(tx.amount)}`, statusLabel: tx.status })}
                >
                  <View style={[styles.txIconWrap, { backgroundColor: iconBg }]}>
                    <MaterialIcons name={iconName} size={20} color={iconColor} />
                  </View>
                  <View style={styles.txInfoWrap}>
                    <Text style={styles.txTitle} numberOfLines={1}>{tx.narration || tx.source.replace('_', ' ')}</Text>
                    <Text style={styles.txDate}>{formatDate(tx.created_at)}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: amountColor }]}>
                    {sign}{formatCurrency(tx.amount)}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </CustomRefreshScrollView>

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
    paddingTop: 24,
    paddingBottom: 80, // Extra padding for bottom nav
  },
  pageHeader: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  pageTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#111827',
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 24,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterPillActive: {
    backgroundColor: '#f3e8ff',
    borderColor: '#d8b4fe',
  },
  filterPillText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#6b7280',
  },
  filterPillTextActive: {
    color: '#6A1B9A',
  },
  transactionsList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 40,
    gap: 12,
  },
  emptyText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#9ca3af',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  txIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txInfoWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  txTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#1f2937',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  txDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#9ca3af',
  },
  txAmount: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
  modalOverlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  receiptSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  receiptHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
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
    marginBottom: 4,
  },
  receiptTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  receiptDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 24,
  },
  receiptDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#f3f4f6',
    marginBottom: 24,
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
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#111827',
    textTransform: 'capitalize',
  },
  receiptCloseBtn: {
    width: '100%',
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  receiptCloseText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#374151',
  },
});
