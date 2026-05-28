import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import { driverApi } from '../../core/api';
import { useAuthStore } from '../../core/authStore';
import { useGarageRideStore } from '../../core/garageRideStore';

const ACTIVE_GARAGE_STATUSES = new Set(['open', 'full', 'departed']);

const DashboardScreen = ({ onCreateGarageRide }: { onCreateGarageRide?: () => void }) => {
  const { status, setStatus } = useGarageRideStore();
  const { user } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    const fetchGarageRide = async () => {
      try {
        const response = await driverApi.getGarageRides();
        const list = Array.isArray(response?.data) ? response.data : response?.data?.results || [];
        const active = list.find((ride: any) => ACTIVE_GARAGE_STATUSES.has(ride.status));
        if (isMounted) setStatus(active ? 'active' : 'inactive');
      } catch {
        if (isMounted) setStatus('inactive');
      }
    };

    fetchGarageRide();
    const interval = setInterval(fetchGarageRide, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const actionLabel = status === 'active' ? 'Resume garage ride' : 'Create garage ride';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.heroCard, AMBIENT_SHADOW]}>
        <View style={styles.heroHeader}>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={[FONTS.labelMd, { color: COLORS.onSurface }]}>Status</Text>
            <Text style={[FONTS.labelMd, { color: COLORS.primary, marginLeft: 6 }]}>Online</Text>
          </View>
          <View style={styles.shiftBadge}>
            <MaterialIcons name="schedule" size={16} color={COLORS.onSurfaceVariant} />
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Shift 02:45</Text>
          </View>
        </View>

        <View style={styles.heroBody}>
          <View>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Todays earnings</Text>
            <Text style={[FONTS.headlineXl, { color: COLORS.onSurface }]}>₦12,450</Text>
          </View>
          <View style={styles.heroDivider} />
          <View>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Trips completed</Text>
            <Text style={[FONTS.headlineLg, { color: COLORS.onSurface }]}>8</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, AMBIENT_SHADOW]}>
          <MaterialIcons name="star" size={22} color={COLORS.primary} />
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>4.8</Text>
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Rating</Text>
        </View>
        <View style={[styles.statCard, AMBIENT_SHADOW]}>
          <MaterialIcons name="task-alt" size={22} color={COLORS.primary} />
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>92%</Text>
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Acceptance</Text>
        </View>
        <View style={[styles.statCard, AMBIENT_SHADOW]}>
          <MaterialIcons name="cancel" size={22} color={COLORS.error} />
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>3%</Text>
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Cancellation</Text>
        </View>
        <View style={[styles.statCard, AMBIENT_SHADOW]}>
          <MaterialIcons name="account-balance-wallet" size={22} color={COLORS.primary} />
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>
            {user?.wallet_balance ? `₦${Number(user.wallet_balance).toLocaleString()}` : '₦0'}
          </Text>
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Wallet balance</Text>
        </View>
      </View>

        <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onCreateGarageRide}
            activeOpacity={0.85}
          >
            <MaterialIcons name="qr-code-scanner" size={20} color={COLORS.onPrimary} />
            <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionGhost} activeOpacity={0.85}>
            <MaterialIcons name="support-agent" size={20} color={COLORS.primary} />
            <Text style={[FONTS.labelMd, { color: COLORS.primary }]}>Support</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionGhost} activeOpacity={0.85}>
            <MaterialIcons name="directions-car" size={20} color={COLORS.primary} />
            <Text style={[FONTS.labelMd, { color: COLORS.primary }]}>Vehicle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionGhost} activeOpacity={0.85}>
            <MaterialIcons name="insights" size={20} color={COLORS.primary} />
            <Text style={[FONTS.labelMd, { color: COLORS.primary }]}>Earnings</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Recent activity</Text>
        <View style={[styles.activityCard, AMBIENT_SHADOW]}>
          <View style={styles.activityRow}>
            <View>
              <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Last trip</Text>
              <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant }]}>Engineering Block  South Gate</Text>
            </View>
            <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>₦850</Text>
          </View>
          <View style={styles.activityDivider} />
          <View style={styles.activityRow}>
            <View>
              <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Next payout</Text>
              <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant }]}>Friday, 5:00 PM</Text>
            </View>
            <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>₦12,450</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 20,
  },
  heroCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    gap: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceContainerHigh,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.surfaceContainerHigh,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    gap: 6,
  },
  sectionWrap: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: COLORS.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  actionGhost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHigh,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  activityCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    gap: 14,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityDivider: {
    height: 1,
    backgroundColor: COLORS.surfaceContainerHigh,
  },
});

export default DashboardScreen;
