import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';

const FILTER_TABS = ['All', 'Earned', 'Payouts', 'Bonuses'];

const CHART_DATA = [
  { day: 'M', height: 40 },
  { day: 'T', height: 60 },
  { day: 'W', height: 90, active: true },
  { day: 'T', height: 50 },
  { day: 'F', height: 75 },
  { day: 'S', height: 30 },
  { day: 'S', height: 10 },
];

export default function DriverWalletPage() {
  const [activeFilter, setActiveFilter] = useState('All');

  return (
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
        <Text style={styles.balanceAmount}>₦45,250.00</Text>

        <TouchableOpacity style={styles.cashOutBtn} activeOpacity={0.9}>
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
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>₦15,000</Text>
        </View>
        <View style={styles.goalValues}>
          <Text style={[FONTS.headlineMd, { color: COLORS.primaryContainer }]}>₦12,450</Text>
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>83%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '83%' }]} />
        </View>
        <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, fontSize: 12 }]}>
          Just ₦2,550 to reach today's target!
        </Text>
      </View>

      {/* ── Earnings Analytics ── */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionLabel}>Earnings Analytics (This Week)</Text>
        <View style={[styles.card, AMBIENT_SHADOW]}>
          <View style={styles.analyticsTop}>
            <View>
              <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Total Earned</Text>
              <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>₦128,400</Text>
            </View>
            <View style={styles.trendBadge}>
              <MaterialIcons name="arrow-upward" size={14} color={COLORS.surfaceTint} />
              <Text style={[FONTS.labelMd, { color: COLORS.surfaceTint }]}>12%</Text>
            </View>
          </View>

          {/* Mini Bar Chart */}
          <View style={styles.chartRow}>
            {CHART_DATA.map((bar, idx) => (
              <View key={idx} style={styles.chartCol}>
                <View style={styles.chartBarWrap}>
                  <View
                    style={[
                      styles.chartBar,
                      { height: `${bar.height}%` },
                      bar.active && styles.chartBarActive,
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.chartLabel,
                    bar.active && { color: COLORS.primary, fontWeight: '700' },
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
                <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>Gold Driver</Text>
                <Text style={[FONTS.labelMd, { color: '#d97706' }]}>Active Tier</Text>
              </View>
            </View>
            <Text style={styles.rewardsPoints}>
              2,450<Text style={styles.rewardsPtsSuffix}>pts</Text>
            </Text>
          </View>
          <View style={styles.rewardsFooter}>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant, fontSize: 12 }]}>
              Next tier: Platinum (5,000 pts)
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
            <MaterialIcons name="edit" size={18} color={COLORS.primaryContainer} />
          </View>
          <View style={styles.gridCellBody}>
            <View style={styles.gridCellIcon}>
              <MaterialIcons name="account-balance" size={16} color={COLORS.onSurfaceVariant} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[FONTS.labelMd, { color: COLORS.onSurface }]} numberOfLines={1}>
                Access Bank
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant }}>**** 1234</Text>
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
              <Text style={[FONTS.labelMd, { color: COLORS.onSurface }]}>Statements</Text>
              <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant }}>Oct 2024</Text>
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

        {/* Transaction: Ride Earnings */}
        <View style={[styles.txnCard, AMBIENT_SHADOW]}>
          <View style={styles.txnRow}>
            <View style={styles.txnLeft}>
              <View style={[styles.txnIcon, { backgroundColor: COLORS.primaryContainer + '1A' }]}>
                <MaterialIcons name="directions-car" size={20} color={COLORS.primaryContainer} />
              </View>
              <View>
                <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Ride #LR-9823</Text>
                <Text style={styles.txnDate}>Today, 14:30</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[FONTS.labelLg, { color: COLORS.primaryContainer }]}>+₦1,250</Text>
              <View style={styles.statusBadgeGreen}>
                <Text style={styles.statusBadgeGreenText}>Completed</Text>
              </View>
            </View>
          </View>
          <View style={styles.txnMeta}>
            <View style={styles.txnMetaItem}>
              <MaterialIcons name="route" size={14} color={COLORS.onSurfaceVariant} />
              <Text style={styles.txnMetaText}>4.2 km</Text>
            </View>
            <View style={styles.txnMetaItem}>
              <MaterialIcons name="schedule" size={14} color={COLORS.onSurfaceVariant} />
              <Text style={styles.txnMetaText}>18 min</Text>
            </View>
            <View style={styles.txnMetaItem}>
              <MaterialIcons name="favorite" size={14} color={COLORS.primary} />
              <Text style={[styles.txnMetaText, { color: COLORS.primary }]}>₦200 Tip</Text>
            </View>
          </View>
        </View>

        {/* Transaction: Bank Transfer */}
        <View style={[styles.txnCard, AMBIENT_SHADOW]}>
          <View style={styles.txnRow}>
            <View style={styles.txnLeft}>
              <View style={[styles.txnIcon, { backgroundColor: COLORS.surfaceContainerHighest }]}>
                <MaterialIcons name="account-balance-wallet" size={20} color={COLORS.onSurfaceVariant} />
              </View>
              <View>
                <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Bank Transfer</Text>
                <Text style={styles.txnDate}>Yesterday, 09:15</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>-₦20,000</Text>
              <View style={styles.statusBadgeGrey}>
                <Text style={styles.statusBadgeGreyText}>Completed</Text>
              </View>
            </View>
          </View>
          <View style={styles.txnMeta}>
            <View style={styles.txnMetaItem}>
              <MaterialIcons name="account-balance" size={14} color={COLORS.onSurfaceVariant} />
              <Text style={styles.txnMetaText}>Access Bank ending 1234</Text>
            </View>
            <View style={styles.txnMetaItem}>
              <MaterialIcons name="receipt-long" size={14} color={COLORS.onSurfaceVariant} />
              <Text style={styles.txnMetaText}>Fee: ₦50</Text>
            </View>
          </View>
        </View>

        {/* Transaction: Weekly Bonus */}
        <View style={[styles.txnCard, AMBIENT_SHADOW]}>
          <View style={styles.txnRow}>
            <View style={styles.txnLeft}>
              <View style={[styles.txnIcon, { backgroundColor: '#fef3c7' }]}>
                <MaterialIcons name="stars" size={20} color="#d97706" />
              </View>
              <View>
                <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Weekly Bonus</Text>
                <Text style={styles.txnDate}>Oct 24, 2024</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[FONTS.labelLg, { color: COLORS.primaryContainer }]}>+₦2,500</Text>
              <View style={styles.statusBadgePending}>
                <Text style={styles.statusBadgePendingText}>Pending</Text>
              </View>
            </View>
          </View>
          <View style={styles.txnMeta}>
            <View style={styles.txnMetaItem}>
              <MaterialIcons name="flag" size={14} color={COLORS.onSurfaceVariant} />
              <Text style={styles.txnMetaText}>10/10 Rides Goal Reached</Text>
            </View>
          </View>
        </View>

        {/* View All */}
        <TouchableOpacity style={styles.viewAllBtn} activeOpacity={0.8}>
          <Text style={[FONTS.labelMd, { color: COLORS.primaryContainer }]}>
            View All Transactions
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  viewAllBtn: {
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHigh,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
});
