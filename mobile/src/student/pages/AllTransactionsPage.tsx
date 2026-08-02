import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { FlashList } from '@shopify/flash-list'
import { MaterialIcons } from '@expo/vector-icons'
import Animated, { FadeInDown, FadeInUp, SlideInRight, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import api from '../../core/api'

type TransactionFilter = 'all' | 'credit' | 'debit' | 'transfer'

type Transaction = {
  id: string
  amount: number | string
  transaction_type: 'credit' | 'debit'
  narration: string
  reference: string
  source: string
  created_at: string
  has_dispute?: boolean
  dispute_status?: string
}

const PAGE_SIZE = 15

const FILTERS: { key: TransactionFilter; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'receipt-long' },
  { key: 'credit', label: 'Credits', icon: 'arrow-downward' },
  { key: 'debit', label: 'Debits', icon: 'arrow-upward' },
  { key: 'transfer', label: 'Transfers', icon: 'swap-horiz' },
]

const formatAmount = (value: number | string) => {
  const numeric = Number(value || 0)
  return numeric.toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatNarration = (narration: string) => {
  if (!narration) return 'Wallet transaction'
  return narration.replace(/(PS-|FW-|TX-|CR-|DR-)([A-Z0-9]{4})[A-Z0-9]+([A-Z0-9]{2,4})/, '$1$2...$3')
}

const getTransactionIcon = (tx: Transaction): keyof typeof MaterialIcons.glyphMap => {
  const source = String(tx?.source || '')
  const isTransfer = source.startsWith('student_transfer')
  if (isTransfer) {
    return tx?.transaction_type === 'credit' ? 'call-received' : 'call-made'
  }
  return tx?.transaction_type === 'credit' ? 'add-circle' : 'directions-car'
}

// Skeleton placeholder row
const SkeletonRow = React.memo(() => (
  <Animated.View entering={FadeInDown.duration(300)} style={styles.skeletonRow}>
    <View style={styles.skeletonIcon} />
    <View style={{ flex: 1, gap: 8 }}>
      <View style={[styles.skeletonBar, { width: '65%' }]} />
      <View style={[styles.skeletonBar, { width: '40%', height: 10 }]} />
    </View>
    <View style={[styles.skeletonBar, { width: 70, height: 16 }]} />
  </Animated.View>
))

// Transaction row component
const TransactionRow = React.memo(({ tx, onPress }: { tx: Transaction; onPress: (tx: Transaction) => void }) => {
  const isCredit = tx.transaction_type === 'credit'
  const source = String(tx?.source || '')
  const isTransfer = source.startsWith('student_transfer')

  return (
    <TouchableOpacity
      style={styles.txRow}
      activeOpacity={0.7}
      onPress={() => onPress(tx)}
    >
      <View style={styles.txRowLeft}>
        <View style={[styles.txIconWrap, isCredit ? styles.txIconCredit : (isTransfer ? styles.txIconTransfer : styles.txIconDebit)]}>
          <MaterialIcons
            name={getTransactionIcon(tx)}
            size={20}
            color={isCredit ? '#6A1B9A' : isTransfer ? '#0369a1' : '#374151'}
          />
        </View>
        <View style={styles.txRowTextWrap}>
          <Text style={styles.txRowTitle} numberOfLines={1} ellipsizeMode="tail">
            {formatNarration(tx.narration)}
          </Text>
          <Text style={styles.txRowDate}>{formatDate(tx.created_at)}</Text>
        </View>
      </View>
      <Text style={isCredit ? styles.txRowAmountPositive : styles.txRowAmount}>
        {isCredit ? '+' : '-'} ₦{formatAmount(tx.amount)}
      </Text>
    </TouchableOpacity>
  )
})

interface AllTransactionsPageProps {
  onSelectTransaction: (tx: Transaction) => void
}

export default function AllTransactionsPage({ onSelectTransaction }: AllTransactionsPageProps) {
  const insets = useSafeAreaInsets()
  const [filter, setFilter] = useState<TransactionFilter>('all')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const isFetching = useRef(false)

  const fetchTransactions = useCallback(async (pageNum: number, isRefresh = false) => {
    if (isFetching.current && !isRefresh) return
    isFetching.current = true

    try {
      if (pageNum === 1 && !isRefresh) setLoading(true)
      if (pageNum > 1) setLoadingMore(true)

      const res = await api.get(`payments/wallet/transactions/?page=${pageNum}&page_size=${PAGE_SIZE}`)
      const results: Transaction[] = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : []
      const hasNext = !!res.data?.next

      if (pageNum === 1) {
        setTransactions(results)
      } else {
        setTransactions(prev => [...prev, ...results])
      }
      setHasMore(hasNext)
      setPage(pageNum)
    } catch {
      // Silently fail on pagination errors
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
      isFetching.current = false
    }
  }, [])

  useEffect(() => {
    fetchTransactions(1)
  }, [fetchTransactions])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    fetchTransactions(1, true)
  }, [fetchTransactions])

  const handleEndReached = useCallback(() => {
    if (!hasMore || loadingMore || loading) return
    fetchTransactions(page + 1)
  }, [hasMore, loadingMore, loading, page, fetchTransactions])

  const filteredTransactions = useMemo(() => {
    if (filter === 'all') return transactions
    if (filter === 'transfer') {
      return transactions.filter(tx => String(tx.source || '').startsWith('student_transfer'))
    }
    return transactions.filter(tx => tx.transaction_type === filter)
  }, [transactions, filter])

  const renderItem = useCallback(({ item }: { item: Transaction }) => (
    <TransactionRow tx={item} onPress={onSelectTransaction} />
  ), [onSelectTransaction])

  const keyExtractor = useCallback((item: Transaction) => item.id, [])

  const ListFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerWrap}>
          <ActivityIndicator size="small" color="#6A1B9A" />
        </View>
      )
    }
    if (!hasMore && transactions.length > 0) {
      return (
        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>You've reached the end</Text>
        </View>
      )
    }
    return null
  }, [loadingMore, hasMore, transactions.length])

  const ListEmpty = useMemo(() => {
    if (loading) return null
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconWrap}>
          <MaterialIcons name="receipt-long" size={48} color="#d1d5db" />
        </View>
        <Text style={styles.emptyTitle}>No transactions found</Text>
        <Text style={styles.emptySubtitle}>
          {filter === 'all'
            ? 'Your transaction history will appear here.'
            : `No ${filter} transactions to display.`}
        </Text>
      </View>
    )
  }, [loading, filter])

  return (
    <View style={styles.page}>


      {/* Sticky Filter Bar */}
      <View style={styles.filterBar}>
        {FILTERS.map((f) => {
          const active = filter === f.key
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={f.icon}
                size={16}
                color={active ? '#ffffff' : '#6b7280'}
              />
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Transaction count */}
      {!loading && (
        <Animated.View entering={FadeInUp.duration(200)} style={styles.countRow}>
          <Text style={styles.countText}>
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
          </Text>
        </Animated.View>
      )}

      {/* Skeleton loading */}
      {loading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3, 4, 5, 6].map(i => <SkeletonRow key={i} />)}
        </View>
      ) : (
        <FlashList
          data={filteredTransactions}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={72}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={ListEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#6A1B9A']}
              tintColor="#6A1B9A"
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // Sticky Filter Bar
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#6A1B9A',
    borderColor: '#6A1B9A',
  },
  filterChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#6b7280',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },

  // Count Row
  countRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
  },
  countText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#9ca3af',
  },

  // Transaction Rows
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  txRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    marginRight: 12,
  },
  txIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconCredit: {
    backgroundColor: '#F3E8FF',
  },
  txIconDebit: {
    backgroundColor: '#F3F4F6',
  },
  txIconTransfer: {
    backgroundColor: '#E0F2FE',
  },
  txRowTextWrap: {
    flex: 1,
  },
  txRowTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#1a1c1c',
    letterSpacing: -0.1,
  },
  txRowDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 3,
  },
  txRowAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: '#1a1c1c',
  },
  txRowAmountPositive: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: '#2e7d32',
  },

  // Skeleton
  skeletonWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  skeletonIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
  },
  skeletonBar: {
    height: 14,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },

  // Footer
  footerWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#9ca3af',
  },

  // Empty State
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
})
