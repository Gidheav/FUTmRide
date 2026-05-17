import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Switch,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import { driverApi } from '../../core/api';

const MAP_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAHSLYYBTZfN5V_LixVPUSXWWiTHmlXYiWaBWKS_taLDmjB2XnjyXXkDVYHQ7gKodc_CWO76AK6wIbuJLuKRQCubY0rCdVZFGTiE5cBS_ol6SbgmF1eYTvdaeLIZ6ffw8aDdSU1SRC4NT0a7DuiHEbptoO5dscWtgHl2zETN0BbHMkqPdAukicQioDf48IJ2TtI3iM6arQexmWd00Va6FeGi8VDcfwS989TGbYOM4fa_jwRVYhPgFlYSpV3AwkHC44AIz3BV_D7Wds';

const FILTERS = [
  { label: 'High Fare', icon: 'payments' as const, active: true },
  { label: 'Short Distance', icon: null, active: false },
  { label: 'Newest', icon: null, active: false },
  { label: 'More', icon: 'tune' as const, active: false },
];

const SEAT_OPTIONS = ['Available Seats', '1 Seat', '2 Seats', '3 Seats', '4 Seats'];

type RideStudent = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  role?: string | null;
};

type RideListItem = {
  id: string;
  status: string;
  requested_seats: number | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  estimated_distance_km: string | number | null;
  total_fare: string | number | null;
  student?: RideStudent | null;
};

const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '₦—';
  const num = Number(value);
  if (Number.isNaN(num)) return '₦—';
  return `₦${num.toFixed(0)}`;
};

const formatDistance = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return `${num.toFixed(1)} km`;
};

const getStudentName = (student?: RideStudent | null) => {
  if (!student) return 'Student';
  return (
    student.full_name ||
    [student.first_name, student.last_name].filter(Boolean).join(' ') ||
    'Student'
  );
};

export default function DriverRidesPage() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isUpdatingOnline, setIsUpdatingOnline] = useState(false);
  const [departure, setDeparture] = useState('Main Gate');
  const [destination, setDestination] = useState('');
  const [price, setPrice] = useState('');
  const [selectedSeats, setSelectedSeats] = useState(0);
  const [activeFilter, setActiveFilter] = useState('High Fare');
  const [marketplaceRequests, setMarketplaceRequests] = useState<RideListItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [acceptingRideId, setAcceptingRideId] = useState<string | null>(null);
  const [driverHasActiveRide, setDriverHasActiveRide] = useState(false);
  const pingAnim = useRef(new Animated.Value(0)).current;
  const pulseDot = useRef(new Animated.Value(1)).current;
  const initialFetchDone = useRef(false);
  const isFetchingRequests = useRef(false);
  const lastRequestsKey = useRef('');
  const errorHoldUntil = useRef<number>(0);

  useEffect(() => {
    // Ping animation for hotspot
    Animated.loop(
      Animated.sequence([
        Animated.timing(pingAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pingAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
    // Pulse for live dot
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseDot, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseDot, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchDriverStatus = async () => {
      try {
        const response = await driverApi.getProfile();
        const status = response?.data?.is_online;
        if (isMounted) {
          setIsOnline(Boolean(status));
        }
      } catch (error: any) {
        if (isMounted) {
          setRequestsError('Unable to load driver status.');
          errorHoldUntil.current = Date.now() + 12000;
        }
      }
    };

    fetchDriverStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchMarketplaceRequests = async () => {
      if (isFetchingRequests.current) return;
      isFetchingRequests.current = true;
      if (!initialFetchDone.current) {
        setLoadingRequests(true);
      }
      try {
        const response = await driverApi.getMarketplaceRequests();
        const data = response?.data;
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        if (isMounted) {
          if (!Array.isArray(data) && typeof data?.driver_has_active_ride === 'boolean') {
            setDriverHasActiveRide(data.driver_has_active_ride);
          } else {
            setDriverHasActiveRide(false);
          }
          const key = list
            .map((ride: RideListItem) => `${ride.id}:${ride.status}:${ride.total_fare ?? ''}`)
            .join('|');
          if (lastRequestsKey.current !== key) {
            setMarketplaceRequests(list as RideListItem[]);
            lastRequestsKey.current = key;
          }
          if (requestsError && Date.now() > errorHoldUntil.current) {
            setRequestsError(null);
          }
        }
      } catch (error: any) {
        if (isMounted) {
          setRequestsError('Unable to load active requests.');
          errorHoldUntil.current = Date.now() + 8000;
        }
      } finally {
        if (isMounted) {
          setLoadingRequests(false);
          initialFetchDone.current = true;
        }
        isFetchingRequests.current = false;
      }
    };

    fetchMarketplaceRequests();
    const interval = setInterval(fetchMarketplaceRequests, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const pingScale = pingAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 3] });
  const pingOpacity = pingAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  const handleAcceptRide = async (rideId: string) => {
    if (acceptingRideId) return;
    setAcceptingRideId(rideId);
    try {
      await driverApi.acceptRideRequest(rideId);
      setRequestsError(null);
      setMarketplaceRequests((prev) => prev.filter((ride) => ride.id !== rideId));
      setDriverHasActiveRide(true);
    } catch (error: any) {
      const data = error?.response?.data;
      const message =
        data?.error?.message ||
        data?.detail ||
        (typeof data === 'string' ? data : null) ||
        (data ? JSON.stringify(data) : null) ||
        'Unable to accept request.';
      const status = error?.response?.status;
      const statusLabel = status ? `(${status}) ` : '';
      setRequestsError(`${statusLabel}${message}`.trim());
      errorHoldUntil.current = Date.now() + 12000;
    } finally {
      setAcceptingRideId(null);
    }
  };

  const handleToggleOnline = async () => {
    if (isUpdatingOnline || isOnline === null) return;
    const nextStatus = !isOnline;
    setIsUpdatingOnline(true);
    try {
      await driverApi.updateProfile({ is_online: nextStatus });
      setIsOnline(nextStatus);
      setRequestsError(null);
    } catch (error: any) {
      const data = error?.response?.data;
      const message =
        data?.error?.message ||
        data?.detail ||
        (typeof data === 'string' ? data : null) ||
        (data ? JSON.stringify(data) : null) ||
        'Unable to update status.';
      const status = error?.response?.status;
      const statusLabel = status ? `(${status}) ` : '';
      setRequestsError(`${statusLabel}${message}`.trim());
      errorHoldUntil.current = Date.now() + 12000;
    } finally {
      setIsUpdatingOnline(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.onlineStatusRow}>
        <View style={styles.onlineStatusLeft}>
          <View
            style={[
              styles.onlineStatusDot,
              { backgroundColor: isOnline ? COLORS.primaryContainer : COLORS.error },
            ]}
          />
          <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>
            {isOnline === null ? 'Loading…' : isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
        <Switch
          value={Boolean(isOnline)}
          onValueChange={handleToggleOnline}
          disabled={isUpdatingOnline || isOnline === null}
          trackColor={{ false: COLORS.surfaceContainerLow, true: COLORS.primaryContainer }}
          thumbColor={COLORS.surface}
        />
      </View>

      {/* ══════════════════════════════════════════════
          Section 1: Post a Ride Offer
         ══════════════════════════════════════════════ */}
      <View style={styles.sectionWrap}>
        <View style={[styles.card, AMBIENT_SHADOW]}>
          {/* Departure */}
          <View style={styles.inputRow}>
            <MaterialIcons name="my-location" size={20} color={COLORS.outline} />
            <TextInput
              style={[FONTS.bodyMd, styles.textInput]}
              placeholder="Departure Location"
              placeholderTextColor={COLORS.outline}
              value={departure}
              onChangeText={setDeparture}
            />
          </View>

          {/* Destination */}
          <View style={[styles.inputRow, { marginTop: 8 }]}>
            <MaterialIcons name="location-on" size={20} color={COLORS.primary} />
            <TextInput
              style={[FONTS.bodyMd, styles.textInput]}
              placeholder="Destination"
              placeholderTextColor={COLORS.outline}
              value={destination}
              onChangeText={setDestination}
            />
          </View>

          {/* Price + Seats row */}
          <View style={styles.detailsRow}>
            <View style={[styles.inputRow, { flex: 1 }]}>
              <MaterialIcons name="payments" size={20} color={COLORS.outline} />
              <TextInput
                style={[FONTS.bodyMd, styles.textInput]}
                placeholder="Price per Seat (₦)"
                placeholderTextColor={COLORS.outline}
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>

            <View style={[styles.inputRow, { flex: 1 }]}>
              <MaterialIcons name="group" size={20} color={COLORS.outline} />
              <TouchableOpacity
                style={styles.seatSelector}
                activeOpacity={0.7}
                onPress={() => setSelectedSeats((prev) => (prev + 1) % SEAT_OPTIONS.length)}
              >
                <Text
                  style={[
                    FONTS.bodyMd,
                    {
                      color: selectedSeats === 0 ? COLORS.outline : COLORS.onSurface,
                      flex: 1,
                    },
                  ]}
                >
                  {SEAT_OPTIONS[selectedSeats]}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={20} color={COLORS.outline} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity style={styles.postBtn} activeOpacity={0.9}>
            <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Post Ride Offer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══════════════════════════════════════════════
          Section 2: Live Campus Activity Map
         ══════════════════════════════════════════════ */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <View style={styles.liveTitle}>
            <Animated.View style={[styles.liveDot, { opacity: pulseDot }]} />
            <Text style={[FONTS.labelLg, { color: COLORS.onSurfaceVariant }]}>
              Live Campus Activity
            </Text>
          </View>
          <Text style={[FONTS.labelMd, { color: COLORS.outline }]}>Hotspots</Text>
        </View>

        <View style={[styles.mapContainer, AMBIENT_SHADOW]}>
          <Image source={{ uri: MAP_IMAGE }} style={styles.mapImage} resizeMode="cover" />
          {/* Gradient overlay */}
          <View style={styles.mapGradient} />

          {/* Hotspot 1 — with ping */}
          <View style={styles.hotspot1}>
            <View style={styles.hotspotLabel}>
              <MaterialIcons name="group" size={14} color={COLORS.onPrimary} />
              <Text style={[FONTS.labelMd, { color: COLORS.onPrimary, marginLeft: 2 }]}>5</Text>
            </View>
            <View style={styles.hotspotDot} />
            <Animated.View
              style={[
                styles.hotspotPing,
                { transform: [{ scale: pingScale }], opacity: pingOpacity },
              ]}
            />
          </View>

          {/* Hotspot 2 */}
          <View style={styles.hotspot2}>
            <View style={styles.hotspot2Label}>
              <Text style={[FONTS.labelMd, { color: COLORS.onSurface }]}>Library</Text>
            </View>
            <View style={styles.hotspot2Dot} />
          </View>
        </View>
      </View>

      {/* ══════════════════════════════════════════════
          Section 3: Request Marketplace
         ══════════════════════════════════════════════ */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <Text style={[FONTS.labelLg, { color: COLORS.onSurfaceVariant }]}>
            Active Request
          </Text>
          <View style={styles.liveBadge}>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurface }]}>
              {marketplaceRequests.length} Live
            </Text>
          </View>
        </View>

        {driverHasActiveRide && (
          <View style={[styles.card, AMBIENT_SHADOW]}>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant }]}>
              You already have an active ride. Finish it before accepting another.
            </Text>
          </View>
        )}

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.label}
              style={[styles.filterPill, activeFilter === f.label && styles.filterPillActive]}
              onPress={() => setActiveFilter(f.label)}
              activeOpacity={0.8}
            >
              {f.icon && (
                <MaterialIcons
                  name={f.icon}
                  size={16}
                  color={activeFilter === f.label ? COLORS.primary : COLORS.onSurface}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                style={[
                  FONTS.labelMd,
                  {
                    color: activeFilter === f.label ? COLORS.primary : COLORS.onSurface,
                  },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loadingRequests && (
          <View style={[styles.card, AMBIENT_SHADOW]}>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant }]}>
              Loading active requests...
            </Text>
          </View>
        )}
        {!loadingRequests && requestsError && (
          <View style={[styles.card, AMBIENT_SHADOW]}>
            <Text style={[FONTS.bodyMd, { color: COLORS.error }]}>{requestsError}</Text>
          </View>
        )}
        {!loadingRequests && !requestsError && marketplaceRequests.length === 0 && (
          <View style={[styles.card, AMBIENT_SHADOW]}>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant }]}>
              No active requests right now.
            </Text>
          </View>
        )}
        {!loadingRequests && !requestsError &&
          marketplaceRequests.map((ride) => {
            const requestedSeats = ride.requested_seats || 0;
            const passengersLabel = requestedSeats
              ? `${requestedSeats} passenger${requestedSeats > 1 ? 's' : ''}`
              : 'Passengers —';
            return (
              <RequestCard
                key={ride.id}
                name={getStudentName(ride.student)}
                rating="New"
                fare={formatCurrency(ride.total_fare)}
                passengers={passengersLabel}
                from={ride.pickup_address || 'Pickup location'}
                to={ride.dropoff_address || 'Dropoff location'}
                distance={formatDistance(ride.estimated_distance_km)}
                acceptLabel="Accept Request"
                onAccept={() => handleAcceptRide(ride.id)}
                disabled={acceptingRideId === ride.id || driverHasActiveRide}
              />
            );
          })}
      </View>
    </ScrollView>
  );
}

/* ─── Request Card Sub-component ─── */
type RequestCardProps = {
  name: string;
  rating: string;
  fare: string;
  passengers: string;
  from: string;
  to: string;
  distance: string;
  photoUrl?: string | null;
  acceptLabel: string;
  onAccept: () => void;
  disabled?: boolean;
};

function RequestCard({
  name,
  rating,
  photoUrl,
  fare,
  passengers,
  from,
  to,
  distance,
  acceptLabel,
  onAccept,
  disabled,
}: RequestCardProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <View style={[styles.requestCard, AMBIENT_SHADOW]}>
      {/* Top: User + Fare */}
      <View style={styles.reqTop}>
        <View style={styles.reqUser}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.reqAvatar} />
          ) : (
            <View style={styles.reqAvatarFallback}>
              <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>{initials}</Text>
            </View>
          )}
          <View>
            <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>{name}</Text>
            <View style={styles.reqRating}>
              <MaterialIcons name="star" size={14} color={COLORS.primary} />
              <Text style={[FONTS.labelMd, { color: COLORS.outline }]}>{rating}</Text>
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, fontWeight: '700' }]}>
            {fare}
          </Text>
          <Text style={[FONTS.labelMd, { color: COLORS.outline }]}>{passengers}</Text>
        </View>
      </View>

      {/* Route visualization */}
      <View style={styles.routeBox}>
        <View style={styles.routeIndicator}>
          <View style={styles.routeOriginDot} />
          <View style={styles.routeConnector} />
          <View style={styles.routeDestDot} />
        </View>
        <View style={styles.routeLabels}>
          <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]} numberOfLines={1}>
            {from}
          </Text>
          <Text
            style={[FONTS.bodySm, { color: COLORS.onSurface, fontWeight: '600' }]}
            numberOfLines={1}
          >
            {to}
          </Text>
        </View>
        <Text style={[FONTS.labelMd, { color: COLORS.outline }]}>{distance}</Text>
      </View>

      {/* Accept button */}
      <TouchableOpacity
        style={[styles.acceptBtn, disabled && styles.acceptBtnDisabled]}
        activeOpacity={0.85}
        onPress={onAccept}
        disabled={disabled}
      >
        <Text style={[FONTS.labelLg, { color: COLORS.primary }]}>{acceptLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 112,
    gap: 32,
  },

  /* Header */
  headerArea: { gap: 4 },

  onlineStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onlineStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlineStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  /* Sections */
  sectionWrap: { gap: 16 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.14,
    color: COLORS.onSurfaceVariant,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  /* Card base */
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },

  /* Inputs */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  textInput: {
    flex: 1,
    color: COLORS.onSurface,
    padding: 0,
    margin: 0,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  seatSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  postBtn: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },

  /* Live Campus Activity */
  liveTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  mapContainer: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    backgroundColor: 'transparent',
    // RN doesn't support CSS gradients natively; we approximate with a semitransparent overlay
    opacity: 0.4,
  },

  /* Hotspot 1 */
  hotspot1: {
    position: 'absolute',
    top: '20%',
    left: '28%',
    alignItems: 'center',
  },
  hotspotLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 4,
  },
  hotspotDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  hotspotPing: {
    position: 'absolute',
    top: 30,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
  },

  /* Hotspot 2 */
  hotspot2: {
    position: 'absolute',
    bottom: '28%',
    right: '20%',
    alignItems: 'center',
  },
  hotspot2Label: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: COLORS.surfaceVariant,
    marginBottom: 4,
  },
  hotspot2Dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },

  /* Marketplace */
  liveBadge: {
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary + '1A',
    borderColor: COLORS.primary + '33',
  },

  /* Request Card */
  requestCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  reqTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reqUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reqAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceContainer,
  },
  reqAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  /* Route box */
  routeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 8,
    padding: 8,
    gap: 12,
    marginBottom: 12,
  },
  routeIndicator: {
    width: 16,
    alignItems: 'center',
    gap: 2,
  },
  routeOriginDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.outline,
  },
  routeConnector: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.surfaceVariant,
  },
  routeDestDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  routeLabels: {
    flex: 1,
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptBtnDisabled: {
    opacity: 0.6,
  },
});
