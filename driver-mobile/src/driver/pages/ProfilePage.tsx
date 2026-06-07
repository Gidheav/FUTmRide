import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import { useAuthStore } from '../../core/authStore';
import { driverApi } from '../../core/api';
import { useDriverProfileStore } from '../../core/driverProfileStore';

type ProfileProps = {
  onNavigateToSettings?: () => void;
  onEditProfile?: () => void;
};

const DEFAULT_DRIVER_PROFILE = {
  vehicle_type: 'sedan',
  vehicle_make: 'Unknown',
  vehicle_model: 'Unknown',
  vehicle_year: 2020,
  vehicle_color: 'Unknown',
  plate_number: 'PENDING',
};

const formatPercent = (value?: string | number | null) => {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return '-';
  return `${num.toFixed(0)}%`;
};

const formatCurrency = (value?: string | number | null) => {
  if (value === null || value === undefined) return 'NGN -';
  const num = Number(value);
  if (Number.isNaN(num)) return 'NGN -';
  return `NGN ${num.toFixed(0)}`;
};

export default function DriverProfilePage({ onNavigateToSettings, onEditProfile }: ProfileProps) {
  const { user } = useAuthStore();
  const { profile: cachedProfile, setProfile: setCachedProfile } = useDriverProfileStore();
  const [profile, setProfile] = useState<any>(cachedProfile);
  const [loading, setLoading] = useState(!cachedProfile);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!cachedProfile) setLoading(true);
      try {
        const response = await driverApi.getProfile();
        if (!isMounted) return;
        setProfile(response?.data ?? null);
        setCachedProfile(response?.data ?? null);
      } catch (error: any) {
        if (error?.response?.status === 404) {
          try {
            await driverApi.createProfile(DEFAULT_DRIVER_PROFILE);
            const retry = await driverApi.getProfile();
            if (!isMounted) return;
            setProfile(retry?.data ?? null);
            setCachedProfile(retry?.data ?? null);
          } catch (createErr: any) {
            console.warn('[Profile] driver profile fetch failed:', createErr?.response?.data ?? createErr.message);
          }
        } else {
          console.warn('[Profile] driver profile fetch failed:', error?.response?.data ?? error.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [cachedProfile, setCachedProfile]);

  const initials = useMemo(() => {
    const first = (user?.first_name ?? '').trim()[0] ?? '';
    const last = (user?.last_name ?? '').trim()[0] ?? '';
    return `${first}${last}`.toUpperCase() || 'DR';
  }, [user?.first_name, user?.last_name]);

  const vehicleModel = [profile?.vehicle_make, profile?.vehicle_model, profile?.vehicle_year]
    .filter(Boolean)
    .join(' ');

  const badges = [
    profile?.average_rating && Number(profile.average_rating) >= 4.5 ? 'Top rated' : null,
    profile?.acceptance_rate && Number(profile.acceptance_rate) >= 90 ? 'High acceptance' : null,
    profile?.cancellation_rate && Number(profile.cancellation_rate) <= 5 ? 'Reliable' : null,
  ].filter(Boolean) as string[];

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, marginTop: 12 }]}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        {user?.profile_photo ? (
          <Image source={{ uri: user.profile_photo }} style={styles.profileImage} />
        ) : (
          <View style={styles.initialsAvatar}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
        )}
        <View style={styles.nameContainer}>
          <Text style={[FONTS.headlineXl, styles.nameText]}>{user?.full_name || 'Driver'}</Text>
          <View style={styles.subRow}>
            <MaterialIcons name={user?.is_verified ? 'verified' : 'info'} size={16} color={COLORS.primary} />
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>
              {user?.is_verified ? 'Verified driver' : 'Pending verification'}
            </Text>
          </View>
          {user?.campus?.name ? (
            <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant }]}>{user.campus.name}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statBox, AMBIENT_SHADOW]}>
          <Text style={[FONTS.headlineMd, styles.statValue]}>{profile?.total_trips ?? '-'}</Text>
          <Text style={[FONTS.labelMd, styles.statLabel]}>Total trips</Text>
        </View>
        <View style={[styles.statBox, AMBIENT_SHADOW]}>
          <Text style={[FONTS.headlineMd, styles.statValue]}>{formatCurrency(profile?.total_earnings)}</Text>
          <Text style={[FONTS.labelMd, styles.statLabel]}>Total earnings</Text>
        </View>
        <View style={[styles.statBox, AMBIENT_SHADOW]}>
          <Text style={[FONTS.headlineMd, styles.statValue]}>{formatPercent(profile?.acceptance_rate)}</Text>
          <Text style={[FONTS.labelMd, styles.statLabel]}>Acceptance</Text>
        </View>
        <View style={[styles.statBox, AMBIENT_SHADOW]}>
          <Text style={[FONTS.headlineMd, styles.statValue]}>{formatPercent(profile?.cancellation_rate)}</Text>
          <Text style={[FONTS.labelMd, styles.statLabel]}>Cancellation</Text>
        </View>
      </View>

      <View style={[styles.card, AMBIENT_SHADOW]}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="directions-car" size={20} color={COLORS.primary} />
          <Text style={[FONTS.labelLg, styles.sectionTitle]}>Vehicle</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[FONTS.bodyMd, styles.detailLabel]}>Model</Text>
          <Text style={[FONTS.labelLg, styles.detailValue]}>{vehicleModel || '-'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[FONTS.bodyMd, styles.detailLabel]}>Plate number</Text>
          <Text style={[FONTS.labelLg, styles.detailValue]}>{profile?.plate_number || '-'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[FONTS.bodyMd, styles.detailLabel]}>Color</Text>
          <Text style={[FONTS.labelLg, styles.detailValue]}>{profile?.vehicle_color || '-'}</Text>
        </View>
      </View>

      <View style={[styles.card, AMBIENT_SHADOW]}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="badge" size={20} color={COLORS.primary} />
          <Text style={[FONTS.labelLg, styles.sectionTitle]}>Badges</Text>
        </View>
        {badges.length === 0 ? (
          <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant }]}>No badges yet.</Text>
        ) : (
          <View style={styles.badgeWrap}>
            {badges.map((label) => (
              <View key={label} style={styles.badgeChip}>
                <MaterialIcons name="verified" size={14} color={COLORS.onPrimary} />
                <Text style={[FONTS.labelMd, { color: COLORS.onPrimary }]}>{label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.actionArea}>
        <TouchableOpacity style={styles.primaryButton} onPress={onEditProfile}>
          <MaterialIcons name="edit" size={20} color={COLORS.onPrimary} />
          <Text style={[FONTS.labelLg, styles.primaryButtonText]}>Edit profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onNavigateToSettings}>
          <MaterialIcons name="settings" size={20} color={COLORS.onBackground} />
          <Text style={[FONTS.labelLg, styles.secondaryButtonText]}>App settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  profileImage: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: COLORS.surfaceContainerLowest,
  },
  initialsAvatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.surfaceContainerLowest,
  },
  initialsText: {
    ...FONTS.headlineXl,
    color: COLORS.primary,
  },
  nameContainer: {
    alignItems: 'center',
    gap: 4,
  },
  nameText: {
    color: COLORS.onBackground,
    textAlign: 'center',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...AMBIENT_SHADOW,
    gap: 4,
  },
  statValue: {
    color: COLORS.onBackground,
  },
  statLabel: {
    color: COLORS.onSurfaceVariant,
  },
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    ...AMBIENT_SHADOW,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: COLORS.onSurface,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: COLORS.onSurfaceVariant,
  },
  detailValue: {
    color: COLORS.onSurface,
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  actionArea: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: COLORS.onPrimary,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceContainerLowest,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  secondaryButtonText: {
    color: COLORS.onBackground,
  },
});
