import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CustomRefreshScrollView from '../components/CustomRefreshScrollView';
import { COLORS, FONTS } from '../../core/theme';
import { driverApi, driverWalletApi } from '../../core/api';
import { useAuthStore } from '../../core/authStore';
import { useGarageRideStore } from '../../core/garageRideStore';
import { useDriverRidesStore } from '../../core/driverRidesStore';
import {
  getDriverActivityState,
  getActivityDisplay,
  canCreateGarageRide,
} from '../../core/driverActivity';

const ACTIVE_GARAGE_STATUSES = new Set(['open', 'full', 'departed']);

const MODERN_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  android: {
    elevation: 8,
  },
});

const toNumber = (value: any) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (amount: number) => `₦${toNumber(amount).toLocaleString()}`;

const getRouteLabel = (ride: any) => {
  if (!ride) return 'Route unavailable';
  const from = ride.origin_name || ride.pickup_name || ride.route?.from_name || ride.route_name;
  const to = ride.destination_name || ride.dropoff_name || ride.route?.to_name;
  if (from && to) return `${from} -> ${to}`;
  return from || to || 'Route unavailable';
};

const getTodayRevenue = (summary: any) => {
  const dailyGoal = summary?.daily_goal;
  return toNumber(
    dailyGoal?.earned ??
      summary?.today_earnings ??
      summary?.today_revenue ??
      summary?.earnings_today
  );
};

const getGoalData = (summary: any) => {
  const target = toNumber(summary?.daily_goal?.target ?? summary?.daily_goal_target);
  const earned = getTodayRevenue(summary);
  const progress = target > 0 ? Math.min(100, Math.round((earned / target) * 100)) : 0;
  return {
    target,
    earned,
    progress,
    remaining: target > 0 ? Math.max(0, target - earned) : 0,
  };
};

const formatTimeAgo = (iso: string) => {
  if (!iso) return '--';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
};

const getTxnTitle = (tx: any) => {
  if (tx?.source === 'driver_earning') return tx?.ride_reference ? `Ride ${tx.ride_reference}` : 'Ride Earning';
  if (tx?.source === 'driver_withdrawal') return 'Wallet Settlement';
  if (tx?.source === 'promotion') return 'Bonus';
  return tx?.narration || 'Wallet activity';
};

const getTxnSubtitle = (tx: any) => {
  if (tx?.source === 'driver_earning' && (tx?.ride_distance_km || tx?.ride_duration_minutes)) {
    const distance = tx?.ride_distance_km ? `${tx.ride_distance_km} km` : null;
    const duration = tx?.ride_duration_minutes ? `${tx.ride_duration_minutes} min` : null;
    return [distance, duration].filter(Boolean).join(' • ');
  }
  if (tx?.metadata?.bank_name) return `${tx.metadata.bank_name} payout`;
  if (tx?.source === 'driver_withdrawal') return 'Auto-transfer to primary account';
  return tx?.status ? String(tx.status).toUpperCase() : 'Completed';
};

const DashboardScreen = ({ onCreateGarageRide }: { onCreateGarageRide?: () => void }) => {
  const { status, setStatus } = useGarageRideStore();
  const { user } = useAuthStore();
  const { isOnline, driverHasActiveRide, garageRide: storeGarageRide } = useDriverRidesStore();
  const [walletSummary, setWalletSummary] = useState<any>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [garageRes, walletRes] = await Promise.all([
        driverApi.getGarageRides(),
        driverWalletApi.getSummary(),
      ]);
      const list = Array.isArray(garageRes?.data) ? garageRes.data : garageRes?.data?.results || [];
      const active = list.find((ride: any) => ACTIVE_GARAGE_STATUSES.has(ride.status));
      setStatus(active ? 'active' : 'inactive');
      setActiveRide(active || null);
      setWalletSummary(walletRes?.data || null);
    } catch {
      setStatus('inactive');
      setActiveRide(null);
      setWalletSummary(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadInitial = async () => {
      await fetchDashboardData();
    };
    loadInitial();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const goalData = useMemo(() => getGoalData(walletSummary), [walletSummary]);
  const tripsToday = useMemo(
    () =>
      toNumber(
        walletSummary?.today_trips ??
          walletSummary?.trips_today ??
          walletSummary?.stats?.trips_today ??
          walletSummary?.metrics?.trips_completed
      ),
    [walletSummary]
  );
  const scoreValue = useMemo(() => {
    const rating = toNumber(walletSummary?.driver_rating ?? walletSummary?.rating);
    return rating > 0 ? rating.toFixed(1) : '--';
  }, [walletSummary]);
  const onlineHours = useMemo(() => {
    const hours = toNumber(walletSummary?.online_hours_today ?? walletSummary?.hours_online_today);
    return hours > 0 ? `${hours.toFixed(1)}h` : '--';
  }, [walletSummary]);
  const seatInfo = useMemo(() => {
    const total = toNumber(activeRide?.total_seats);
    const booked = toNumber(activeRide?.booked_seats);
    const available = total > 0 ? Math.max(0, total - booked) : toNumber(activeRide?.available_seats);
    return {
      total,
      booked,
      available,
      display: total > 0 ? `${booked}/${total} seats` : `${booked} passengers`,
    };
  }, [activeRide]);
  const recentTransactions = useMemo(() => {
    const list = Array.isArray(walletSummary?.recent_transactions)
      ? walletSummary.recent_transactions
      : Array.isArray(walletSummary?.transactions)
      ? walletSummary.transactions
      : [];
    return list.slice(0, 2);
  }, [walletSummary]);

  const actionLabel = status === 'active' ? 'Resume Current Session' : 'Start Garage Session';
  const revenueToday = getTodayRevenue(walletSummary);

  // ── Activity state for mode indicator & guard ──────────────────────────────
  const activityState = useMemo(
    () => getDriverActivityState(isOnline, storeGarageRide, driverHasActiveRide),
    [isOnline, storeGarageRide, driverHasActiveRide]
  );
  const activityDisplay = useMemo(() => getActivityDisplay(activityState), [activityState]);

  const handleGaragePress = () => {
    const guard = canCreateGarageRide(activityState);
    if (!guard.allowed) {
      Alert.alert(
        'Mode Conflict',
        `${guard.reason}\n\n${guard.suggestion}`,
        [{ text: 'Got it', style: 'default' }],
      );
      return;
    }
    onCreateGarageRide?.();
  };

  return (
    <View style={styles.container}>
      <CustomRefreshScrollView
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Hero Section */}
        <View
          style={[styles.heroCard, { backgroundColor: COLORS.primary }]}
        >
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroLabel}>Revenue Today</Text>
              <Text style={styles.heroAmount}>{formatCurrency(revenueToday)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <TouchableOpacity style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>LIVE</Text>
              </TouchableOpacity>
              <View style={[styles.modeBadge, { backgroundColor: activityDisplay.bgColor }]}>
                <MaterialIcons name={activityDisplay.icon as any} size={12} color={activityDisplay.color} />
                <Text style={[styles.modeBadgeText, { color: activityDisplay.color }]}>{activityDisplay.label}</Text>
              </View>
            </View>
          </View>

          <View style={styles.goalWrap}>
            <View style={styles.goalMetaRow}>
              <Text style={styles.goalMetaText}>Daily Goal</Text>
              {goalData.target > 0 ? (
                <Text style={styles.goalMetaText}>{goalData.progress}%</Text>
              ) : (
                <Text style={styles.goalMetaText}>Not set</Text>
              )}
            </View>
            <View style={styles.goalTrack}>
              <View style={[styles.goalFill, { width: `${goalData.progress}%` }]} />
            </View>
            <Text style={styles.goalHint}>
              {goalData.target > 0
                ? `${formatCurrency(goalData.remaining)} remaining`
                : 'Set a daily goal in wallet settings'}
            </Text>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{tripsToday.toString().padStart(2, '0')}</Text>
              <Text style={styles.heroStatLabel}>Trips</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{scoreValue}</Text>
              <Text style={styles.heroStatLabel}>Rating</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{onlineHours}</Text>
              <Text style={styles.heroStatLabel}>Online</Text>
            </View>
          </View>
        </View>

        {/* Primary Action */}
        {status === 'active' && activeRide ? (
          <View style={styles.activeSessionCard}>
            <View style={styles.activeSessionHeader}>
              <Text style={styles.activeSessionTitle}>Active Garage Session</Text>
              <View style={styles.activeSessionBadge}>
                <MaterialIcons name="event-seat" size={14} color={COLORS.primary} />
                <Text style={styles.activeSessionBadgeText}>{seatInfo.display}</Text>
              </View>
            </View>

            <Text style={styles.activeRouteLabel}>{getRouteLabel(activeRide)}</Text>

            <View style={styles.activeSessionMetaRow}>
              <View style={styles.metaPill}>
                <MaterialIcons name="people" size={14} color={COLORS.onSurfaceVariant} />
                <Text style={styles.metaPillText}>{seatInfo.available} seats left</Text>
              </View>
              <View style={styles.metaPill}>
                <MaterialIcons name="schedule" size={14} color={COLORS.onSurfaceVariant} />
                <Text style={styles.metaPillText}>{String(activeRide?.status || 'open').toUpperCase()}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.resumeSessionBtn} onPress={handleGaragePress} activeOpacity={0.85}>
              <MaterialIcons name="qr-code-scanner" size={18} color={COLORS.onPrimary} />
              <Text style={styles.resumeSessionBtnText}>Resume Session</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.mainAction}
            onPress={handleGaragePress}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#ffffff', '#f8f9fa']}
              style={styles.mainActionGradient}
            >
              <View style={styles.actionIconBg}>
                <MaterialIcons
                  name={status === 'active' ? 'play-circle-filled' : 'add-circle'}
                  size={32}
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.actionTextContent}>
                <Text style={styles.actionTitle}>{actionLabel}</Text>
                <Text style={styles.actionSub}>Enable QR scanning and passenger boarding</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={COLORS.outline} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Stats Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Performance Insights</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={[styles.statIconWrap, { backgroundColor: '#e8f5e9' }]}>
              <MaterialIcons name="star" size={20} color="#2e7d32" />
            </View>
            <Text style={styles.statValue}>{scoreValue}</Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
          <View style={styles.statBox}>
            <View style={[styles.statIconWrap, { backgroundColor: '#e3f2fd' }]}>
              <MaterialIcons name="account-balance-wallet" size={20} color="#1565c0" />
            </View>
            <Text style={styles.statValue}>
              {user?.wallet_balance ? `₦${Number(user.wallet_balance).toLocaleString()}` : '₦0'}
            </Text>
            <Text style={styles.statLabel}>Wallet</Text>
          </View>
        </View>

        {/* Quick Utilities */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Utilities</Text>
        </View>
        <View style={styles.utilsRow}>
          {[
            { icon: 'insights', label: 'Analytics', color: '#6A1B9A' },
            { icon: 'support-agent', label: 'Support', color: '#C62828' },
            { icon: 'directions-car', label: 'Vehicle', color: '#1565C0' },
          ].map((item, idx) => (
            <TouchableOpacity key={idx} style={styles.utilBtn}>
              <View style={[styles.utilIcon, { backgroundColor: item.color + '15' }]}>
                <MaterialIcons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={styles.utilLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Registry</Text>
          <TouchableOpacity><Text style={styles.seeAll}>History</Text></TouchableOpacity>
        </View>
        <View style={styles.activityCard}>
          {recentTransactions.length === 0 ? (
            <View style={styles.emptyActivityWrap}>
              <MaterialIcons name="history" size={18} color={COLORS.onSurfaceVariant} />
              <Text style={styles.emptyActivityText}>No recent wallet activity yet</Text>
            </View>
          ) : (
            recentTransactions.map((tx: any, idx: number) => {
              const color = tx?.source === 'driver_withdrawal' ? '#1565c0' : COLORS.primary;
              return (
                <React.Fragment key={tx?.id || `${tx?.source}-${idx}`}>
                  <View style={styles.activityItem}>
                    <View style={[styles.activityIndicator, { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityName}>{getTxnTitle(tx)}</Text>
                      <Text style={styles.activityLoc}>{getTxnSubtitle(tx)}</Text>
                    </View>
                    <Text style={styles.activityTime}>{formatTimeAgo(tx?.created_at)}</Text>
                  </View>
                  {idx < recentTransactions.length - 1 ? <View style={styles.historyDivider} /> : null}
                </React.Fragment>
              );
            })
          )}
        </View>
      </CustomRefreshScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 100,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    marginVertical: 10,
    ...MODERN_SHADOW,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 4,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#81c784',
  },
  onlineText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
  },
  goalWrap: {
    marginTop: -8,
    marginBottom: 16,
    gap: 6,
  },
  goalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalMetaText: {
    ...FONTS.labelMd,
    color: 'rgba(255,255,255,0.85)',
  },
  goalTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  goalHint: {
    ...FONTS.bodySm,
    color: 'rgba(255,255,255,0.78)',
  },
  heroStat: {
    alignItems: 'center',
    flex: 1,
  },
  heroStatValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  heroDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  mainAction: {
    marginVertical: 12,
    borderRadius: 20,
    ...MODERN_SHADOW,
    overflow: 'hidden',
  },
  mainActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  activeSessionCard: {
    marginVertical: 12,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12,
    ...MODERN_SHADOW,
  },
  activeSessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeSessionTitle: {
    ...FONTS.labelLg,
    color: '#1A1C1C',
  },
  activeSessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeSessionBadgeText: {
    ...FONTS.labelMd,
    color: COLORS.primary,
  },
  activeRouteLabel: {
    ...FONTS.bodyMd,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  activeSessionMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaPillText: {
    ...FONTS.labelMd,
    color: COLORS.onSurfaceVariant,
  },
  resumeSessionBtn: {
    marginTop: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resumeSessionBtnText: {
    ...FONTS.labelLg,
    color: COLORS.onPrimary,
  },
  actionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1C1C',
  },
  actionSub: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1C1C',
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    ...MODERN_SHADOW,
    shadowRadius: 10,
    elevation: 4,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1C1C',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    marginTop: 4,
    fontWeight: '500',
  },
  utilsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  utilBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...MODERN_SHADOW,
    shadowRadius: 8,
  },
  utilIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  utilLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1C1C',
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    ...MODERN_SHADOW,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  activityIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1C1C',
  },
  activityLoc: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 11,
    color: COLORS.outline,
    fontWeight: '500',
  },
  emptyActivityWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
  },
  emptyActivityText: {
    ...FONTS.bodySm,
    color: COLORS.onSurfaceVariant,
  },
  historyDivider: {
    height: 1,
    backgroundColor: '#F1F3F5',
    marginHorizontal: 12,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default DashboardScreen;
