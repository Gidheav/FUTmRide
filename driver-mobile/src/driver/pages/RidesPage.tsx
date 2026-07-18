import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import CustomRefreshFlatList from '../components/CustomRefreshFlatList';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import { API_ROOT_URL, driverApi } from '../../core/api';
import { startDriverLocationTracking, stopDriverLocationTracking } from '../../core/locationSocket';
import { useGarageRideStore } from '../../core/garageRideStore';
import { useDriverRidesStore } from '../../core/driverRidesStore';
import { 
  getDriverActivityState, 
  canGoOnline, 
  canCreateGarageRide,
  getUpcomingScheduledRide,
  formatTimeUntil,
  isScheduledRideLocked
} from '../../core/driverActivity';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';
import locationData from '../locations.json';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const customZoomAnimation = {
  duration: 300,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.scaleXY,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.scaleXY,
  },
};

const FILTERS = [
  { label: 'High Fare', icon: 'payments' as const },
  { label: 'Short Distance', icon: null },
  { label: 'Newest', icon: null },
  { label: 'More', icon: 'tune' as const },
];

const VEHICLE_SEAT_OPTIONS: Record<string, number[]> = {
  bike: [1],
  motorcycle: [1],
  tricycle: [2, 3],
  sedan: [2, 3, 4],
  hatchback: [2, 3, 4],
  suv: [4, 5, 6],
  minivan: [6, 8],
  van: [6, 8, 10, 12],
  bus: [10, 12],
};
const DEFAULT_SEAT_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];

const getSeatOptionsByVehicleType = (vehicleType: string) => {
  const normalized = String(vehicleType || '').trim().toLowerCase();
  return VEHICLE_SEAT_OPTIONS[normalized] || DEFAULT_SEAT_OPTIONS;
};

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const radius = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
};

const DEFAULT_DRIVER_PROFILE = {
  vehicle_type: 'sedan',
  vehicle_color: 'Unknown',
  vehicle_make: 'Unknown',
  vehicle_model: 'Unknown',
  vehicle_year: 2020,
  plate_number: 'PENDING',
};


type DriverMode = 'garage' | 'ondemand';

type RideStudent = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  role?: string | null;
  profile_photo?: string | null;
};

type RideListItem = {
  id: string;
  status: string;
  requested_seats: number | null;
  pickup_address: string | null;
  pickup_latitude?: number | string | null;
  pickup_longitude?: number | string | null;
  dropoff_address: string | null;
  dropoff_latitude?: number | string | null;
  dropoff_longitude?: number | string | null;
  estimated_distance_km: string | number | null;
  estimated_duration_minutes?: number | null;
  estimated_route_geometry?: Array<{ latitude: number | string; longitude: number | string }> | null;
  route_distance_provider?: string | null;
  route_confidence?: string | null;
  route_metadata?: Record<string, unknown> | null;
  total_fare: string | number | null;
  student?: RideStudent | null;
};

type GarageRide = {
  id: string;
  reference: string;
  qr_token: string;
  origin_address: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
  vehicle_type: string;
  total_seats: number;
  booked_seats: number;
  available_seats: number;
  fare_per_seat: string | number;
  status: string;
  driver_note?: string | null;
  is_expired: boolean;
  created_at: string;
  departed_at?: string | null;
  completed_at?: string | null;
};

type GaragePassenger = {
  id: string;
  seats_booked: number;
  amount_paid: string | number;
  student?: {
    id: string;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

type LocationOption = {
  id: string;
  label: string;
  description: string;
  latitude: number;
  longitude: number;
};

const ALL_LOCATIONS: LocationOption[] = (locationData as any[]).map((loc) => ({
  id: loc.id,
  label: loc.name,
  description: loc.description,
  latitude: Number(loc.latitude),
  longitude: Number(loc.longitude),
}));

const filterLocations = (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return ALL_LOCATIONS;
  return ALL_LOCATIONS.filter((item) => {
    const haystack = `${item.label} ${item.description}`.toLowerCase();
    return haystack.includes(normalized);
  });
};

const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '₦—';
  const num = Number(value);
  if (Number.isNaN(num)) return '₦—';
  return `₦${num.toFixed(0)}`;
};

const getStudentName = (student?: RideStudent | null) => {
  if (!student) return 'Student';
  return (
    student.full_name ||
    [student.first_name, student.last_name].filter(Boolean).join(' ') ||
    'Student'
  );
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'S';

const resolveMediaUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  try {
    const apiUrl = new URL(API_ROOT_URL);
    return `${apiUrl.origin}${value.startsWith('/') ? value : `/${value}`}`;
  } catch {
    return value;
  }
};

const formatDistance = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return `${num.toFixed(1)} km`;
};

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

const parseMapCoordinate = (
  latitude: string | number | null | undefined,
  longitude: string | number | null | undefined,
): MapCoordinate | null => {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (
    !Number.isFinite(parsedLatitude) ||
    !Number.isFinite(parsedLongitude) ||
    Math.abs(parsedLatitude) > 90 ||
    Math.abs(parsedLongitude) > 180
  ) {
    return null;
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  };
};

const parseRouteGeometry = (
  geometry: RideListItem['estimated_route_geometry'],
): MapCoordinate[] => {
  if (!Array.isArray(geometry)) return [];

  return geometry
    .map((point) => parseMapCoordinate(point?.latitude, point?.longitude))
    .filter((point): point is MapCoordinate => Boolean(point));
};

const getRideInitialRegion = (coordinates: MapCoordinate[]): Region => {
  if (coordinates.length === 0) {
    return {
      latitude: 9.6171,
      longitude: 6.5492,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    };
  }

  if (coordinates.length === 1) {
    return {
      latitude: coordinates[0].latitude,
      longitude: coordinates[0].longitude,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025,
    };
  }

  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max(maxLatitude - minLatitude, 0.01) + 0.025,
    longitudeDelta: Math.max(maxLongitude - minLongitude, 0.01) + 0.025,
  };
};

const formatCompletedAt = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getVehicleIcon = (size: string): React.ComponentProps<typeof MaterialIcons>['name'] => {
  const s = String(size || '').toLowerCase();
  if (s.includes('sedan') || s.includes('car')) return 'directions-car';
  if (s.includes('minivan') || s.includes('van')) return 'airport-shuttle';
  if (s.includes('minibus')) return 'directions-transit';
  if (s.includes('bus') || s.includes('long_bus') || s.includes('coaster')) return 'directions-bus';
  return 'directions-car';
};

const ScheduledRideCard = React.memo(function ScheduledRideCard({ ride, onExpressInterest, onCancelInterest, isExpressing, isCancelling, disabled }: { 
  ride: any, 
  onExpressInterest: (id: string) => void, 
  onCancelInterest: (id: string) => void,
  isExpressing: boolean,
  isCancelling: boolean,
  disabled?: boolean,
}) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(`${ride.departure_date}T${ride.window_start}`);
  const isInterested = ride.driver_interest_status === 'interested';
  
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => setExpanded(!expanded)} style={styles.premiumCard}>
      {/* Header */}
      <View style={styles.premiumCardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>{ride.reference}</Text>
          {isInterested && (
            <View style={styles.premiumCardInterestedBadge}>
              <MaterialIcons name="check" size={12} color={COLORS.primary} />
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            {Array.isArray(ride.allowed_vehicle_types) ? ride.allowed_vehicle_types.map((vt: string, idx: number) => (
               <MaterialIcons key={idx} name={getVehicleIcon(vt)} size={16} color={COLORS.onSurfaceVariant} />
            )) : <MaterialIcons name={getVehicleIcon(ride.vehicle_size)} size={16} color={COLORS.onSurfaceVariant} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <MaterialIcons name="people" size={16} color={COLORS.onSurfaceVariant} />
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>{ride.passenger_count || 0}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <MaterialIcons name="location-on" size={16} color={COLORS.onSurfaceVariant} />
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>{ride.stops_count || 0}</Text>
          </View>
        </View>
      </View>

      {/* Main Info */}
      <View style={styles.premiumCardBody}>
        <View style={styles.premiumCardTimeCol}>
          <MaterialIcons name="schedule" size={20} color={COLORS.primary} />
          <Text style={[FONTS.bodyLg, { color: COLORS.onSurface, fontWeight: '500' }]} numberOfLines={1} adjustsFontSizeToFit>
            {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant }]} numberOfLines={1}>
            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>

        <View style={styles.premiumCardRouteCol}>
          {/* Vertical Timeline */}
          <View style={styles.timelineRow}>
            <View style={styles.timelineGraphic}>
              <View style={styles.timelineDotTop} />
              <View style={styles.timelineLine} />
            </View>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurface, flex: 1, paddingBottom: 4 }]} numberOfLines={2}>
              {ride.origin_address}
            </Text>
          </View>
          <View style={styles.timelineRow}>
            <View style={styles.timelineGraphic}>
              <View style={styles.timelineDotBottom} />
            </View>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, flex: 1 }]} numberOfLines={2}>
              {ride.destination_address}
            </Text>
          </View>
        </View>

        {/* Action Column */}
        <View style={styles.premiumCardActionCol}>
          {isInterested ? (
            <TouchableOpacity 
              style={[styles.actionColBtn, styles.actionColBtnCancel, disabled && { opacity: 0.5 }]} 
              onPress={() => onCancelInterest(ride.id)} 
              disabled={isCancelling || disabled}
            >
              {isCancelling ? (
                <LoadingOverlay visible={true} inline size={24} />
              ) : (
                <MaterialIcons name="close" size={20} color={COLORS.error} />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.actionColBtn, styles.actionColBtnPrimary, disabled && { opacity: 0.5 }]} 
              onPress={() => onExpressInterest(ride.id)} 
              disabled={isExpressing || disabled}
            >
              {isExpressing ? (
                <LoadingOverlay visible={true} inline size={24} />
              ) : (
                <MaterialIcons name="check" size={20} color={COLORS.onPrimary} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Expanded Info */}
      {expanded && (
        <View style={styles.premiumCardExpandedInfo}>
          <View style={styles.premiumCardInfoGrid}>
            <View style={styles.premiumCardInfoItem}>
              <MaterialIcons name="directions-car" size={16} color={COLORS.outline} />
              <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginLeft: 6 }]}>{String(ride.vehicle_size || '').replace(/_/g, ' ')}</Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {ride.freight_enabled && (
              <View style={{ backgroundColor: COLORS.surfaceContainer, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]}>Freight: {formatCurrency(ride.freight_price)}</Text>
              </View>
            )}
            {ride.premium_enabled && (
              <View style={{ backgroundColor: COLORS.surfaceContainer, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]}>Premium: {formatCurrency(ride.premium_price)}</Text>
              </View>
            )}
            {ride.standard_enabled && (
              <View style={{ backgroundColor: COLORS.surfaceContainer, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]}>Standard: {formatCurrency(ride.standard_price)}</Text>
              </View>
            )}
            {ride.standing_enabled && (
              <View style={{ backgroundColor: COLORS.surfaceContainer, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]}>Standing: {formatCurrency(ride.standing_price)}</Text>
              </View>
            )}
          </View>
        </View>
      )}

    </TouchableOpacity>
  );
});

export default function DriverRidesPage() {
  const insets = useSafeAreaInsets();
  const [driverMode, setDriverMode] = useState<DriverMode>('garage');
  const {
    isOnline: cachedIsOnline,
    marketplaceRequests: cachedRequests,
    driverHasActiveRide: cachedHasActiveRide,
    garageRide: cachedGarageRide,
    garagePassengers: cachedGaragePassengers,
    setIsOnline: setCachedIsOnline,
    setMarketplaceRequests: setCachedRequests,
    setDriverHasActiveRide: setCachedHasActiveRide,
    setGarageRide: setCachedGarageRide,
    setGaragePassengers: setCachedGaragePassengers,
  } = useDriverRidesStore();

  const [isOnline, setIsOnline] = useState<boolean | null>(cachedIsOnline);
  const [isUpdatingOnline, setIsUpdatingOnline] = useState(false);
  const [marketplaceRequests, setMarketplaceRequests] = useState<RideListItem[]>(cachedRequests);
  const [loadingRequests, setLoadingRequests] = useState(cachedRequests.length === 0);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [acceptingRideId, setAcceptingRideId] = useState<string | null>(null);
  const [selectedRideForMap, setSelectedRideForMap] = useState<RideListItem | null>(null);
  const [readyRideMapId, setReadyRideMapId] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const pickupCoordinate = useMemo(
    () => parseMapCoordinate(selectedRideForMap?.pickup_latitude, selectedRideForMap?.pickup_longitude),
    [selectedRideForMap],
  );
  const dropoffCoordinate = useMemo(
    () => parseMapCoordinate(selectedRideForMap?.dropoff_latitude, selectedRideForMap?.dropoff_longitude),
    [selectedRideForMap],
  );
  const storedRouteCoordinates = useMemo(
    () => parseRouteGeometry(selectedRideForMap?.estimated_route_geometry),
    [selectedRideForMap],
  );
  const selectedRideCoordinates = useMemo(
    () => (
      storedRouteCoordinates.length >= 2
        ? storedRouteCoordinates
        : [pickupCoordinate, dropoffCoordinate].filter((coordinate): coordinate is MapCoordinate => Boolean(coordinate))
    ),
    [storedRouteCoordinates, pickupCoordinate, dropoffCoordinate],
  );
  const selectedRideInitialRegion = useMemo(
    () => getRideInitialRegion(selectedRideCoordinates),
    [selectedRideCoordinates],
  );
  const hasRouteCoordinates = selectedRideCoordinates.length > 0;
  const hasFullRouteCoordinates = selectedRideCoordinates.length >= 2;
  const isRideMapReady = Boolean(selectedRideForMap && readyRideMapId === selectedRideForMap.id);
  const selectedStudentName = getStudentName(selectedRideForMap?.student);
  const selectedStudentPhoto = resolveMediaUrl(selectedRideForMap?.student?.profile_photo);

  useEffect(() => {
    setReadyRideMapId(null);
  }, [selectedRideForMap?.id]);

  useEffect(() => {
    if (!isRideMapReady || !mapRef.current || selectedRideCoordinates.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(selectedRideCoordinates, {
        edgePadding: { top: 80, right: 40, bottom: 260, left: 40 },
        animated: true,
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [isRideMapReady, selectedRideCoordinates]);

  const [driverHasActiveRide, setDriverHasActiveRide] = useState(cachedHasActiveRide);
  const [activeFilter, setActiveFilter] = useState('High Fare');
  // Pagination State
  const [scheduledNextUrl, setScheduledNextUrl] = useState<string | null>(null);
  const [marketplaceNextUrl, setMarketplaceNextUrl] = useState<string | null>(null);
  const [loadingMoreScheduled, setLoadingMoreScheduled] = useState(false);
  const [loadingMoreMarketplace, setLoadingMoreMarketplace] = useState(false);
  const [scheduledTotalCount, setScheduledTotalCount] = useState<number>(0);
  const [marketplaceTotalCount, setMarketplaceTotalCount] = useState<number>(0);

  const [garageRide, setGarageRide] = useState<GarageRide | null>(cachedGarageRide);
  const [garagePassengers, setGaragePassengers] = useState<GaragePassenger[]>(cachedGaragePassengers);
  const [loadingGarage, setLoadingGarage] = useState(false);
  const [garageError, setGarageError] = useState<string | null>(null);
  const { setStatus } = useGarageRideStore();

  const [locationQuery, setLocationQuery] = useState('');
  
  // Scheduled Rides Bidding State
  const [availableScheduledRides, setAvailableScheduledRides] = useState<any[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const scheduledFetchedOnce = useRef(false);
  const [expressingInterestId, setExpressingInterestId] = useState<string | null>(null);
  const [scheduledError, setScheduledError] = useState<string | null>(null);

  const errorHoldUntil = useRef<number>(0);
  const initialFetchDone = useRef(cachedRequests.length > 0);
  const isFetchingRequests = useRef(false);

  // Compute upcoming scheduled ride for the awareness banner
  const upcomingScheduledRide = useMemo(() => {
    return getUpcomingScheduledRide(availableScheduledRides);
  }, [availableScheduledRides]);

  // Active On-Demand Ride State
  const [activeOnDemandRide, setActiveOnDemandRide] = useState<any>(null);
  const [loadingActiveOnDemand, setLoadingActiveOnDemand] = useState(false);
  const [advancingRideId, setAdvancingRideId] = useState<string | null>(null);

  const garageIsActive = garageRide && ['open', 'full', 'departed'].includes(garageRide.status);
  const isOfflineBlocked = Boolean(driverHasActiveRide || garageIsActive);

  useEffect(() => {
    const shouldTrack = Boolean(isOnline) || Boolean(driverHasActiveRide) || Boolean(garageIsActive);
    let isMounted = true;

    const updateTracking = async () => {
      if (!shouldTrack) {
        await stopDriverLocationTracking();
        return;
      }
      try {
        await startDriverLocationTracking();
      } catch (error: any) {
        if (isMounted) {
          setRequestsError(error?.message || 'Unable to start location tracking.');
          errorHoldUntil.current = Date.now() + 12000;
        }
      }
    };

    void updateTracking();
    return () => {
      isMounted = false;
      void stopDriverLocationTracking();
    };
  }, [isOnline, driverHasActiveRide, garageIsActive]);

  useEffect(() => {
    let isMounted = true;
    const fetchDriverStatus = async () => {
      try {
        const profile = await ensureDriverProfile();
        if (isMounted) {
          const nextStatus = Boolean(profile?.is_online);
          setIsOnline(nextStatus);
          setCachedIsOnline(nextStatus);
        }
      } catch (error: any) {
        if (isMounted) {
          // Profile may not exist yet — default to offline so toggle works
          setIsOnline(false);
          setCachedIsOnline(false);
        }
      }
    };

    fetchDriverStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Fetch Scheduled Rides (always runs on mount so data is ready for instant tab switch) ──
  useEffect(() => {
    let isMounted = true;

    const fetchScheduled = async () => {
      if (garageRide || isOnline === false) {
        if (isMounted) setLoadingScheduled(false);
        return;
      }
      if (isOnline === null) return; // Wait for status to be determined
      // Only show loading spinner on the very first fetch
      if (!scheduledFetchedOnce.current) setLoadingScheduled(true);
      try {
        const res = await driverApi.getAvailableScheduledRides();
        if (isMounted) {
          const data = res?.data;
          const rawData = Array.isArray(data) ? data : (data?.results ?? []);
          const nextUrl = data?.pagination?.next || data?.next || null;
          const totalCount = data?.pagination?.count ?? rawData.length;
          setScheduledTotalCount(totalCount);
          // On first page poll, replace state (page 1 only). Preserve loaded pages by merging.
          setAvailableScheduledRides((prev) => {
            if (prev.length <= rawData.length || prev.length === 0) {
              setScheduledNextUrl(nextUrl);
              LayoutAnimation.configureNext(customZoomAnimation);
              return rawData;
            }
            // Merge new page-1 data into existing multi-page data
            const uniqueMap = new Map();
            prev.forEach((item: any) => uniqueMap.set(item.id, item));
            rawData.forEach((item: any) => uniqueMap.set(item.id, item));
            return Array.from(uniqueMap.values());
          });
          setScheduledError(null);
          scheduledFetchedOnce.current = true;
        }
      } catch (err: any) {
        if (isMounted) setScheduledError(err?.message || 'Error loading scheduled rides');
      } finally {
        if (isMounted) setLoadingScheduled(false);
      }
    };

    fetchScheduled();
    const interval = setInterval(fetchScheduled, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [garageRide, isOnline]);

  useEffect(() => {
    let isMounted = true;
    let isFirstFetch = true;
    const fetchGarageRide = async () => {
      // Only show loading spinner on the very first fetch
      if (isFirstFetch && !cachedGarageRide) setLoadingGarage(true);
      try {
        const response = await driverApi.getGarageRides();
        const list = Array.isArray(response?.data) ? response.data : response?.data?.results || [];
        const active = list.find((ride: GarageRide) => ['open', 'full', 'departed'].includes(ride.status)) || null;
        if (isMounted) {
          setGarageRide(active || null);
          setGarageError(null);
          setStatus(active ? 'active' : 'inactive');
          setCachedGarageRide(active || null);
        }
        if (active) {
          const passengers = await driverApi.getGaragePassengers(active.id);
          if (isMounted) {
            const pList = Array.isArray(passengers?.data) ? passengers.data : passengers?.data?.results || [];
            setGaragePassengers(pList);
            setCachedGaragePassengers(pList);
          }
        } else if (isMounted) {
          setGaragePassengers([]);
          setCachedGaragePassengers([]);
        }
      } catch (error: any) {
        if (isMounted && isFirstFetch) {
          setGarageError(error?.response?.data?.error?.message || 'Unable to load garage ride.');
        }
      } finally {
        if (isMounted) setLoadingGarage(false);
        isFirstFetch = false;
      }
    };

    fetchGarageRide();
    const interval = setInterval(fetchGarageRide, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchMarketplaceRequests = async () => {
      if (isOnline === false) {
        if (isMounted) setLoadingRequests(false);
        return;
      }
      if (isFetchingRequests.current || isOnline === null) return;
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
            setCachedHasActiveRide(data.driver_has_active_ride);
            
            // If they have an active ride, fetch it
            if (data.driver_has_active_ride) {
              try {
                const activeRes = await driverApi.getActiveRide();
                setActiveOnDemandRide(activeRes.data);
              } catch (err: any) {
                if (err?.response?.status === 404) {
                  setActiveOnDemandRide(null);
                }
              }
            } else {
              setActiveOnDemandRide(null);
            }
          } else {
            setDriverHasActiveRide(false);
            setCachedHasActiveRide(false);
            setActiveOnDemandRide(null);
          }
          if (isMounted) {
            const nextUrl = data?.pagination?.next || data?.next || null;
            const totalCount = data?.pagination?.count ?? list.length;
            setMarketplaceTotalCount(totalCount);
            setMarketplaceRequests((prev) => {
              if (prev.length > list.length && prev.length > 0) {
                const uniqueMap = new Map();
                prev.forEach((item: any) => uniqueMap.set(item.id, item));
                list.forEach((item: any) => uniqueMap.set(item.id, item));
                return Array.from(uniqueMap.values());
              } else {
                setMarketplaceNextUrl(nextUrl);
                LayoutAnimation.configureNext(customZoomAnimation);
                return list as RideListItem[];
              }
            });
            setRequestsError(null);
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
  }, [requestsError, isOnline]);


  const handleAcceptRide = useCallback(async (rideId: string) => {
    if (acceptingRideId) return;
    setAcceptingRideId(rideId);
    try {
      await driverApi.acceptRideRequest(rideId);
      setRequestsError(null);
      setMarketplaceRequests((prev) => {
        const next = prev.filter((ride) => ride.id !== rideId);
        setCachedRequests(next);
        return next;
      });
      setDriverHasActiveRide(true);
      setCachedHasActiveRide(true);
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
  }, [acceptingRideId]);

  const loadMoreScheduled = useCallback(async () => {
    if (!scheduledNextUrl || loadingMoreScheduled) return;
    setLoadingMoreScheduled(true);
    try {
      const res = await driverApi.getAvailableScheduledRides(scheduledNextUrl);
      const data = res?.data;
      const moreData = Array.isArray(data) ? data : (data?.results ?? []);
      setScheduledNextUrl(data?.pagination?.next || data?.next || null);
      setAvailableScheduledRides((prev) => {
        const uniqueMap = new Map();
        [...prev, ...moreData].forEach((item) => {
          if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
        });
        return Array.from(uniqueMap.values());
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMoreScheduled(false);
    }
  }, [scheduledNextUrl, loadingMoreScheduled]);

  const loadMoreMarketplace = useCallback(async () => {
    if (!marketplaceNextUrl || loadingMoreMarketplace) return;
    setLoadingMoreMarketplace(true);
    try {
      const res = await driverApi.getMarketplaceRequests(marketplaceNextUrl);
      const data = res?.data;
      const moreData = Array.isArray(data) ? data : (data?.results ?? []);
      setMarketplaceNextUrl(data?.pagination?.next || data?.next || null);
      setMarketplaceRequests((prev) => {
        const uniqueMap = new Map();
        [...prev, ...moreData].forEach((item) => {
          if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
        });
        return Array.from(uniqueMap.values());
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMoreMarketplace(false);
    }
  }, [marketplaceNextUrl, loadingMoreMarketplace]);

  const handleAdvanceRide = useCallback(async (rideId: string) => {
    if (advancingRideId) return;
    setAdvancingRideId(rideId);
    try {
      const res = await driverApi.advanceRide(rideId);
      setActiveOnDemandRide(res.data);
      if (['completed', 'cancelled'].includes(res.data.status)) {
        setDriverHasActiveRide(false);
        setCachedHasActiveRide(false);
        setActiveOnDemandRide(null);
      }
    } catch (error: any) {
      const data = error?.response?.data;
      const message =
        data?.error?.message ||
        data?.detail ||
        (typeof data === 'string' ? data : null) ||
        (data ? JSON.stringify(data) : null) ||
        'Unable to advance ride.';
      setRequestsError(message);
      errorHoldUntil.current = Date.now() + 12000;
    } finally {
      setAdvancingRideId(null);
    }
  }, [advancingRideId]);

  const handleToggleOnline = async () => {
    if (isUpdatingOnline || isOnline === null) return;
    
    const activityState = getDriverActivityState(isOnline, garageRide, driverHasActiveRide);
    const hasLock = upcomingScheduledRide ? isScheduledRideLocked(upcomingScheduledRide) : false;
    
    // Only apply the guard if they are trying to GO online (not offline)
    if (!isOnline) {
      const guard = canGoOnline(activityState, hasLock);
      if (!guard.allowed) {
        Alert.alert('Action Blocked', `${guard.reason}\n\n${guard.suggestion}`);
        return;
      }
    }

    if (isOnline && isOfflineBlocked) {
      setRequestsError('You cannot go offline while a ride is active.');
      errorHoldUntil.current = Date.now() + 8000;
      return;
    }
    const nextStatus = !isOnline;
    setIsUpdatingOnline(true);
    try {
      await driverApi.updateAvailability({ is_online: nextStatus });
      setIsOnline(nextStatus);
      setCachedIsOnline(nextStatus);
      setRequestsError(null);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        try {
          await ensureDriverProfile();
          await driverApi.updateAvailability({ is_online: nextStatus });
          setIsOnline(nextStatus);
          setCachedIsOnline(nextStatus);
          setRequestsError(null);
        } catch (retryError: any) {
          const data = retryError?.response?.data;
          const message =
            data?.error?.message ||
            data?.detail ||
            (typeof data === 'string' ? data : null) ||
            (data ? JSON.stringify(data) : null) ||
            'Unable to update status.';
          const status = retryError?.response?.status;
          const statusLabel = status ? `(${status}) ` : '';
          setRequestsError(`${statusLabel}${message}`.trim());
          errorHoldUntil.current = Date.now() + 12000;
        }
      } else {
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
      }
    } finally {
      setIsUpdatingOnline(false);
    }
  };

  const ensureDriverProfile = async () => {
    try {
      const response = await driverApi.getProfile();
      return response?.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        try {
          await driverApi.createProfile(DEFAULT_DRIVER_PROFILE);
          const retry = await driverApi.getProfile();
          console.log('[LR-Ride] Auto-created driver profile successfully.');
          return retry?.data;
        } catch (createErr: any) {
          console.error('[LR-Ride] Failed to auto-create profile:', createErr?.response?.data || createErr.message);
          throw createErr;
        }
      }
      throw err;
    }
  };

  const handleDepartGarageRide = async () => {
    if (!garageRide) return;
    try {
      const response = await driverApi.departGarageRide(garageRide.id);
      setGarageRide(response?.data || null);
      setCachedGarageRide(response?.data || null);
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || 'Unable to depart ride.';
      setGarageError(message);
    }
  };

  const handleCompleteGarageRide = async () => {
    if (!garageRide) return;
    try {
      const response = await driverApi.completeGarageRide(garageRide.id);
      setGarageRide(null);
      setGaragePassengers([]);
      setStatus('inactive');
      setCachedGarageRide(null);
      setCachedGaragePassengers([]);
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || 'Unable to complete ride.';
      setGarageError(message);
    }
  };

  const handleCancelGarageRide = async () => {
    if (!garageRide) return;
    try {
      const response = await driverApi.cancelGarageRide(garageRide.id);
      setGarageRide(response?.data || null);
      setGaragePassengers([]);
      setStatus('inactive');
      setCachedGarageRide(response?.data || null);
      setCachedGaragePassengers([]);
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || 'Unable to cancel ride.';
      setGarageError(message);
    }
  };

  const modeLocked = garageIsActive;

  useEffect(() => {
    if (modeLocked && driverMode !== 'garage') {
      setDriverMode('garage');
    }
  }, [modeLocked, driverMode]);

  const [cancellingInterestId, setCancellingInterestId] = useState<string | null>(null);

  const handleExpressInterest = useCallback(async (rideId: string) => {
    setExpressingInterestId(rideId);
    try {
      await driverApi.expressInterestScheduledRide(rideId);
      // Update locally — mark as interested (don't remove)
      setAvailableScheduledRides(prev => prev.map(r => 
        r.id === rideId ? { ...r, driver_interest_status: 'interested' } : r
      ));
    } catch (err: any) {
      setScheduledError(err?.response?.data?.error || err?.message || 'Failed to express interest.');
    } finally {
      setExpressingInterestId(null);
    }
  }, []);

  const handleCancelInterest = useCallback(async (rideId: string) => {
    setCancellingInterestId(rideId);
    try {
      await driverApi.cancelInterestScheduledRide(rideId);
      // Update locally — mark as not interested
      setAvailableScheduledRides(prev => prev.map(r => 
        r.id === rideId ? { ...r, driver_interest_status: null } : r
      ));
    } catch (err: any) {
      setScheduledError(err?.response?.data?.error || err?.message || 'Failed to withdraw interest.');
    } finally {
      setCancellingInterestId(null);
    }
  }, []);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (driverMode === 'garage' && !garageRide) {
        const res = await driverApi.getAvailableScheduledRides();
        const data = res?.data;
        setAvailableScheduledRides(Array.isArray(data) ? data : (data?.results ?? []));
      } else if (driverMode === 'ondemand') {
        const res = await driverApi.getMarketplaceRequests();
        const data = res?.data;
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setMarketplaceRequests(list as RideListItem[]);
        setCachedRequests(list as RideListItem[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  // ── Virtualized list helpers (stable references for FlatList) ──
  const scheduledKeyExtractor = useCallback((item: any) => item.id, []);
  const requestKeyExtractor = useCallback((item: RideListItem) => item.id, []);

  const renderScheduledItem = useCallback(({ item }: { item: any }) => (
    <View style={{ paddingHorizontal: 16 }}>
      <ScheduledRideCard
        ride={item}
        onExpressInterest={handleExpressInterest}
        onCancelInterest={handleCancelInterest}
        isExpressing={expressingInterestId === item.id}
        isCancelling={cancellingInterestId === item.id}
        disabled={false}
      />
    </View>
  ), [expressingInterestId, cancellingInterestId, handleExpressInterest, handleCancelInterest]);

  const renderRequestItem = useCallback(({ item: ride }: { item: RideListItem }) => {
    const requestedSeats = ride.requested_seats || 0;
    const passengersLabel = requestedSeats
      ? `${requestedSeats} passenger${requestedSeats > 1 ? 's' : ''}`
      : 'Passengers —';
    return (
      <View style={{ paddingHorizontal: 16 }}>
        <RequestCard
          name={getStudentName(ride.student)}
          rating="New"
          fare={formatCurrency(ride.total_fare)}
          passengers={passengersLabel}
          from={ride.pickup_address || 'Pickup location'}
          to={ride.dropoff_address || 'Dropoff location'}
          distance={formatDistance(ride.estimated_distance_km)}
          acceptLabel="Accept Request"
          onAccept={() => handleAcceptRide(ride.id)}
          onCardPress={() => {
            setReadyRideMapId(null);
            setSelectedRideForMap(ride);
          }}
          disabled={Boolean(acceptingRideId === ride.id || driverHasActiveRide || modeLocked || !isOnline)}
        />
      </View>
    );
  }, [acceptingRideId, driverHasActiveRide, modeLocked, handleAcceptRide, isOnline]);

  return (
    <View style={styles.container}>
      {/* Scheduled Ride Awareness Banner */}
      {upcomingScheduledRide && (
        <View style={styles.upcomingBanner}>
          <MaterialIcons name="event" size={18} color="#004D40" />
          <Text style={styles.upcomingBannerText}>
            Upcoming scheduled ride to {upcomingScheduledRide.destination_address || 'destination'} {formatTimeUntil(upcomingScheduledRide.departure_date, upcomingScheduledRide.window_start)}.
          </Text>
        </View>
      )}

      {/* Enterprise Status Board */}
      <View style={[styles.enterpriseHeader, AMBIENT_SHADOW]}>
        {/* Status Row */}
        <View style={styles.enterpriseStatusRow}>
          <View style={styles.enterpriseStatusLeft}>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
              System Status
            </Text>
            <View style={styles.enterpriseStatusValue}>
              {isOnline === null ? (
                <View style={{ marginRight: 8 }}><LoadingOverlay visible={true} inline size={24} /></View>
              ) : (
                <View style={[styles.pulseDot, { backgroundColor: isOnline ? COLORS.primaryContainer : COLORS.error }]} />
              )}
              <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>
                {isOnline === null ? 'Connecting...' : isOnline ? 'Online & Active' : 'Offline'}
              </Text>
            </View>
            <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 2 }]}>
              {isOnline ? 'Receiving live matches' : 'Matching paused'}
            </Text>
            {isOnline && isOfflineBlocked && (
              <Text style={[FONTS.labelMd, { color: COLORS.error, marginTop: 4 }]}>Offline locked during active ride</Text>
            )}
          </View>
          <Switch
            value={Boolean(isOnline)}
            onValueChange={handleToggleOnline}
            disabled={Boolean(isUpdatingOnline || isOnline === null || (isOnline && isOfflineBlocked))}
            trackColor={{ false: COLORS.surfaceContainerHigh, true: COLORS.primaryContainer }}
            thumbColor={COLORS.surface}
          />
        </View>
        
        {/* Mode Segmented Control */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, driverMode === 'garage' && styles.segmentBtnActive]}
            onPress={() => setDriverMode('garage')}
          >
            <MaterialIcons name="event-note" size={18} color={driverMode === 'garage' ? COLORS.onPrimary : COLORS.onSurfaceVariant} style={{ marginRight: 6 }} />
            <Text style={driverMode === 'garage' ? styles.segmentTextActive : styles.segmentText}>Scheduled</Text>
            {Boolean(scheduledTotalCount > 0 || availableScheduledRides.length > 0) && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{scheduledTotalCount || availableScheduledRides.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, driverMode === 'ondemand' && styles.segmentBtnActive, modeLocked && styles.segmentBtnDisabled]}
            onPress={() => {
              if (!modeLocked) setDriverMode('ondemand');
            }}
            disabled={Boolean(modeLocked)}
          >
            <MaterialIcons name="bolt" size={18} color={driverMode === 'ondemand' ? COLORS.onPrimary : COLORS.onSurfaceVariant} style={{ marginRight: 6 }} />
            <Text style={driverMode === 'ondemand' ? styles.segmentTextActive : styles.segmentText}>On-Demand</Text>
            {Boolean(marketplaceTotalCount > 0 || marketplaceRequests.length > 0) && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{marketplaceTotalCount || marketplaceRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        {modeLocked && (
          <View style={styles.modeLockedAlert}>
            <MaterialIcons name="lock" size={14} color={COLORS.onSurfaceVariant} />
            <Text style={styles.modeLockedText}>Complete active garage session to switch modes.</Text>
          </View>
        )}
      </View>

      {/* ── Garage / Scheduled Tab ── */}
      <CustomRefreshFlatList
        style={driverMode !== 'garage' ? { display: 'none', position: 'absolute' } : { flex: 1 }}
        data={garageRide || loadingGarage ? [] : availableScheduledRides}
        keyExtractor={scheduledKeyExtractor}
        renderItem={renderScheduledItem}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          (loadingGarage || garageRide || loadingScheduled || scheduledError || availableScheduledRides.length === 0) ? (
          <View style={styles.sectionWrap}>
            {loadingGarage ? (
              <View style={[styles.schedulesListContainer, AMBIENT_SHADOW]}>
                <View style={styles.emptyStateContainer}>
                  <LoadingOverlay visible={true} inline size={60} />
                  <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, marginTop: 12 }]}>Loading garage ride…</Text>
                </View>
              </View>
            ) : garageRide ? (
              <View style={[styles.schedulesListContainer, AMBIENT_SHADOW]}>
                <View style={styles.sectionHeaderEnterprise}>
                  <View style={styles.sectionTitleRow}>
                    <MaterialIcons name="directions-car" size={24} color={COLORS.primary} />
                    <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, marginLeft: 8 }]}>Active Garage Ride</Text>
                  </View>
                  <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 4 }]}>
                    Ref: {garageRide.reference}
                  </Text>
                </View>

                <View style={styles.premiumCard}>
                  <View style={{ padding: 16 }}>
                    <View style={styles.qrWrap}>
                      <QRCode value={garageRide.qr_token} size={180} />
                      <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 8 }]}>QR Token: {garageRide.qr_token}</Text>
                    </View>

                    <View style={styles.rideInfoRow}>
                      <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Seats</Text>
                      <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}> {garageRide.booked_seats}/{garageRide.total_seats} booked </Text>
                    </View>
                    <View style={styles.rideInfoRow}>
                      <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Fare per seat</Text>
                      <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}> {formatCurrency(garageRide.fare_per_seat)} </Text>
                    </View>
                    <View style={styles.rideInfoRow}>
                      <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Route</Text>
                      <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}> {garageRide.origin_address} → {garageRide.destination_address} </Text>
                    </View>

                    <Text style={[FONTS.labelLg, { color: COLORS.onSurfaceVariant, marginTop: 16 }]}>Passengers</Text>
                    {garagePassengers.length === 0 ? (
                      <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 6 }]}>No passengers yet.</Text>
                    ) : (
                      garagePassengers.map((p) => (
                        <View key={p.id} style={styles.passengerRow}>
                          <MaterialIcons name="person" size={16} color={COLORS.primaryContainer} />
                          <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]}> {getStudentName(p.student as any)} </Text>
                          <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant }]}> ({p.seats_booked} seats) </Text>
                        </View>
                      ))
                    )}

                    {garageError ? <Text style={styles.errorText}>{garageError}</Text> : null}

                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelGarageRide}>
                        <Text style={[FONTS.labelLg, { color: COLORS.error }]}>Cancel Ride</Text>
                      </TouchableOpacity>
                      {garageRide.status === 'departed' ? (
                        <TouchableOpacity style={styles.primaryBtn} onPress={handleCompleteGarageRide}>
                          <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Complete</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={styles.primaryBtn} onPress={handleDepartGarageRide}>
                          <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Depart</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            ) : loadingScheduled || scheduledError || availableScheduledRides.length === 0 ? (
              <View style={[styles.schedulesListContainer, AMBIENT_SHADOW]}>
                {loadingScheduled ? (
                  <View style={styles.emptyStateContainer}>
                    <LoadingOverlay visible={true} inline size={60} />
                    <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, marginTop: 12 }]}>Loading schedules...</Text>
                  </View>
                ) : scheduledError ? (
                  <View style={styles.emptyStateContainer}>
                    <MaterialIcons name="error-outline" size={48} color={COLORS.error} />
                    <Text style={[FONTS.bodyMd, { color: COLORS.error, textAlign: 'center', marginTop: 12 }]}>{scheduledError}</Text>
                  </View>
                ) : (
                  <View style={styles.emptyStateContainer}>
                    <MaterialIcons name="event-busy" size={48} color={COLORS.surfaceContainerHigh} />
                    <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, textAlign: 'center', marginTop: 12 }]}>No available schedules right now.</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
          ) : null
        }
        ItemSeparatorComponent={ListItemSeparator}
        onEndReached={loadMoreScheduled}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMoreScheduled ? <LoadingOverlay visible={true} inline size={40} /> : null}
      />

      {/* ── On-Demand Tab ── */}
      <CustomRefreshFlatList
        style={driverMode !== 'ondemand' ? { display: 'none', position: 'absolute' } : { flex: 1 }}
        data={!loadingRequests && !requestsError ? marketplaceRequests : []}
        keyExtractor={requestKeyExtractor}
        renderItem={renderRequestItem}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <>
            {activeOnDemandRide && (
              <View style={[styles.schedulesListContainer, AMBIENT_SHADOW, { marginBottom: 16 }]}>
                <View style={[styles.premiumCard, { borderColor: COLORS.primary, borderWidth: 1, borderRadius: 12 }]}>
                  <View style={[styles.premiumCardHeader, { backgroundColor: 'rgba(0, 109, 54, 0.05)' }]}>
                    <View style={styles.requestUser}>
                      <View style={[styles.avatar, { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary }]}>
                        <Text style={[FONTS.labelMd, { color: COLORS.onPrimary }]}>
                          {(getStudentName(activeOnDemandRide?.student) || 'P').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={[FONTS.labelMd, { color: COLORS.onSurface }]}>{getStudentName(activeOnDemandRide?.student) || 'Passenger'}</Text>
                        <View style={styles.ratingRow}>
                          <MaterialIcons name="trip-origin" size={12} color={COLORS.primary} />
                          <Text style={[FONTS.labelMd, { color: COLORS.primary }]}>ACTIVE RIDE</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.premiumCardBadge, { backgroundColor: COLORS.primaryContainer }]}>
                      <Text style={[styles.premiumCardBadgeText, { color: COLORS.onPrimaryContainer }]}>
                        {activeOnDemandRide.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.premiumCardBody}>
                    <View style={styles.premiumCardTimeCol}>
                      <Text style={[FONTS.titleLg, { color: COLORS.onSurface }]} numberOfLines={1} adjustsFontSizeToFit>
                        {formatCurrency(activeOnDemandRide.total_fare)}
                      </Text>
                      <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 4 }]}>
                        {formatDistance(activeOnDemandRide.estimated_distance_km)}
                      </Text>
                    </View>

                    <View style={styles.premiumCardRouteCol}>
                      <View style={styles.timelineRow}>
                        <View style={styles.timelineGraphic}>
                          <View style={styles.timelineDotTop} />
                          <View style={styles.timelineLine} />
                        </View>
                        <Text style={[FONTS.bodyMd, { color: COLORS.onSurface, flex: 1, paddingBottom: 4 }]} numberOfLines={2}>
                          {activeOnDemandRide.pickup_address || 'Pickup location'}
                        </Text>
                      </View>
                      <View style={styles.timelineRow}>
                        <View style={styles.timelineGraphic}>
                          <View style={styles.timelineDotBottom} />
                        </View>
                        <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, flex: 1 }]} numberOfLines={2}>
                          {activeOnDemandRide.dropoff_address || 'Dropoff location'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    style={{ backgroundColor: COLORS.primary, paddingVertical: 12, alignItems: 'center' }}
                    onPress={() => handleAdvanceRide(activeOnDemandRide.id)}
                    disabled={advancingRideId === activeOnDemandRide.id}
                  >
                    {advancingRideId === activeOnDemandRide.id ? (
                      <LoadingOverlay visible={true} inline size={24} />
                    ) : (
                      <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>
                        {activeOnDemandRide.status === 'accepted' ? 'Confirm Arrival' : activeOnDemandRide.status === 'arrived' ? 'Start Trip' : activeOnDemandRide.status === 'in_progress' ? 'Complete Trip' : 'Advance Status'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {(loadingRequests || requestsError || marketplaceRequests.length === 0) && (
              <View style={[styles.schedulesListContainer, AMBIENT_SHADOW, { marginBottom: 16 }]}>
                {loadingRequests ? (
                  <View style={styles.emptyStateContainer}>
                    <LoadingOverlay visible={true} inline size={60} />
                    <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, marginTop: 12 }]}>Loading requests...</Text>
                  </View>
                ) : requestsError ? (
                  <View style={styles.emptyStateContainer}>
                    <Text style={[FONTS.bodyMd, { color: COLORS.error }]}>{requestsError}</Text>
                  </View>
                ) : (
                  <View style={styles.emptyStateContainer}>
                    <MaterialIcons name="hourglass-empty" size={48} color={COLORS.surfaceContainerHigh} />
                    <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, textAlign: 'center', marginTop: 12 }]}>No active requests right now.</Text>
                  </View>
                )}
              </View>
            )}
          </>
        }
        ItemSeparatorComponent={ListItemSeparator}
        onEndReached={loadMoreMarketplace}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMoreMarketplace ? <LoadingOverlay visible={true} inline size={40} /> : null}
      />

      <Modal
        visible={!!selectedRideForMap}
        animationType="slide"
        onRequestClose={() => setSelectedRideForMap(null)}
      >
        <View style={styles.mapModalContainer}>
          {selectedRideForMap && (
            <>
              <View style={styles.mapModalMapWrap}>
                {hasRouteCoordinates ? (
                  <MapView
                    key={selectedRideForMap.id}
                    ref={mapRef}
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                    style={styles.mapModalMap}
                    initialRegion={selectedRideInitialRegion}
                    onMapReady={() => setReadyRideMapId(selectedRideForMap.id)}
                    onMapLoaded={() => setReadyRideMapId(selectedRideForMap.id)}
                    mapType="standard"
                    zoomEnabled
                    scrollEnabled
                    rotateEnabled={false}
                    pitchEnabled
                    showsCompass
                    showsScale
                    loadingEnabled
                    loadingIndicatorColor={COLORS.primary}
                    loadingBackgroundColor={COLORS.surfaceContainerLowest}
                  >
                    {pickupCoordinate && (
                      <Marker
                        coordinate={pickupCoordinate}
                        title="Pickup"
                        description={selectedRideForMap.pickup_address || ''}
                        pinColor="blue"
                      />
                    )}
                    {dropoffCoordinate && (
                      <Marker
                        coordinate={dropoffCoordinate}
                        title="Dropoff"
                        description={selectedRideForMap.dropoff_address || ''}
                        pinColor="red"
                      />
                    )}
                    {hasFullRouteCoordinates && (
                      <Polyline
                        coordinates={selectedRideCoordinates}
                        strokeColor={COLORS.primary}
                        strokeWidth={4}
                      />
                    )}
                  </MapView>
                ) : (
                  <View style={styles.mapModalUnavailable}>
                    <MaterialIcons name="wrong-location" size={42} color={COLORS.onSurfaceVariant} />
                    <Text style={[FONTS.titleMd, { color: COLORS.onSurface, textAlign: 'center' }]}>
                      Route map unavailable
                    </Text>
                    <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, textAlign: 'center' }]}>
                      This request did not include valid pickup or dropoff coordinates.
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.mapModalCloseBtn, { top: insets.top + 12 }]}
                onPress={() => setSelectedRideForMap(null)}
                activeOpacity={0.85}
              >
                <MaterialIcons name="close" size={24} color={COLORS.onSurface} />
              </TouchableOpacity>

              <View style={[styles.mapModalBottomSheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }, AMBIENT_SHADOW]}>
                <View style={styles.mapSheetHandle} />

                <View style={styles.mapSheetHeader}>
                  <View style={styles.mapSheetStudentRow}>
                    {selectedStudentPhoto ? (
                      <Image source={{ uri: selectedStudentPhoto }} style={styles.mapSheetAvatarImage} />
                    ) : (
                      <View style={styles.mapSheetAvatarFallback}>
                        <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>
                          {getInitials(selectedStudentName)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.mapSheetStudentCopy}>
                      <Text style={[FONTS.titleMd, { color: COLORS.onSurface }]} numberOfLines={1}>
                        {selectedStudentName}
                      </Text>
                      <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant }]} numberOfLines={1}>
                        On-demand request
                      </Text>
                    </View>
                  </View>
                  <View style={styles.mapSheetFarePill}>
                    <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Fare</Text>
                    <Text style={[FONTS.titleMd, { color: COLORS.onSurface }]}>
                      {formatCurrency(selectedRideForMap.total_fare)}
                    </Text>
                  </View>
                </View>

                <View style={styles.mapSheetStatsRow}>
                  <View style={styles.mapSheetStatCard}>
                    <MaterialIcons name="route" size={18} color={COLORS.primary} />
                    <View>
                      <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Distance</Text>
                      <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>
                        {formatDistance(selectedRideForMap.estimated_distance_km)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.mapSheetStatCard}>
                    <MaterialIcons name="event-seat" size={18} color={COLORS.primary} />
                    <View>
                      <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Seats</Text>
                      <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>
                        {selectedRideForMap.requested_seats || 1}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.mapSheetRouteCard}>
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineGraphic}>
                      <View style={styles.timelineDotTop} />
                      <View style={styles.timelineLine} />
                    </View>
                    <View style={styles.mapSheetRouteText}>
                      <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Pickup</Text>
                      <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]} numberOfLines={2}>
                        {selectedRideForMap.pickup_address || 'Pickup location'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineGraphic}>
                      <View style={styles.timelineDotBottom} />
                    </View>
                    <View style={styles.mapSheetRouteText}>
                      <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Dropoff</Text>
                      <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]} numberOfLines={2}>
                        {selectedRideForMap.dropoff_address || 'Dropoff location'}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.mapSheetAcceptButton, acceptingRideId === selectedRideForMap.id && { opacity: 0.7 }]}
                  onPress={() => {
                    handleAcceptRide(selectedRideForMap.id);
                    setSelectedRideForMap(null);
                  }}
                  disabled={acceptingRideId === selectedRideForMap.id}
                  activeOpacity={0.86}
                >
                  {acceptingRideId === selectedRideForMap.id ? (
                    <LoadingOverlay visible={true} inline size={24} />
                  ) : (
                    <Text style={[FONTS.labelLg, { color: COLORS.onPrimary, textAlign: 'center' }]}>Accept Request</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

/* ─── Request Card Sub-component ─── */
const RequestCard = React.memo(function RequestCard({
  name,
  rating,
  fare,
  passengers,
  from,
  to,
  distance,
  acceptLabel,
  onAccept,
  onCardPress,
  disabled,
}: {
  name: string;
  rating: string;
  fare: string;
  passengers: string;
  from: string;
  to: string;
  distance: string;
  acceptLabel: string;
  onAccept: () => void;
  onCardPress: () => void;
  disabled?: boolean;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onCardPress} style={styles.premiumCard}>
      <View style={styles.premiumCardHeader}>
        <View style={[styles.requestUser, { flex: 1 }]}>
          <View style={[styles.avatar, { width: 28, height: 28, borderRadius: 14 }]}>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>{initials}</Text>
          </View>
          <View>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurface }]}>{name}</Text>
            <View style={styles.ratingRow}>
              <MaterialIcons name="star" size={12} color={COLORS.onSurfaceVariant} />
              <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>{rating}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MaterialIcons name="people" size={16} color={COLORS.onSurfaceVariant} />
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>{passengers}</Text>
        </View>
      </View>

      <View style={styles.premiumCardBody}>
        <View style={styles.premiumCardTimeCol}>
          <Text style={[FONTS.bodyLg, { color: COLORS.onSurface, fontWeight: '500' }]} numberOfLines={1} adjustsFontSizeToFit>{fare}</Text>
          <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 4 }]} numberOfLines={1}>{distance}</Text>
        </View>

        <View style={styles.premiumCardRouteCol}>
          <View style={styles.timelineRow}>
            <View style={styles.timelineGraphic}>
              <View style={styles.timelineDotTop} />
              <View style={styles.timelineLine} />
            </View>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurface, flex: 1, paddingBottom: 4 }]} numberOfLines={2}>
              {from}
            </Text>
          </View>
          <View style={styles.timelineRow}>
            <View style={styles.timelineGraphic}>
              <View style={styles.timelineDotBottom} />
            </View>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, flex: 1 }]} numberOfLines={2}>
              {to}
            </Text>
          </View>
        </View>

        <View style={styles.premiumCardActionCol}>
          <TouchableOpacity 
            style={[styles.actionColBtn, styles.actionColBtnPrimary, disabled && { opacity: 0.5 }]} 
            onPress={onAccept} 
            disabled={disabled}
          >
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const ListItemSeparator = () => null;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 140,
  },
  modeToggleWrap: {
    marginBottom: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
  },
  enterpriseHeader: {
    backgroundColor: COLORS.surfaceContainerLowest,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceContainerLow,
    zIndex: 10,
  },
  enterpriseStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  enterpriseStatusLeft: {
    flex: 1,
  },
  enterpriseStatusValue: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
    ...AMBIENT_SHADOW,
  },
  segmentBtnDisabled: {
    opacity: 0.5,
  },
  segmentText: {
    ...FONTS.labelLg,
    color: COLORS.onSurfaceVariant,
  },
  segmentTextActive: {
    ...FONTS.labelLg,
    color: COLORS.onPrimary,
  },
  modeLockedAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerHigh,
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  modalItemText: {
    ...FONTS.labelMd,
    color: COLORS.onSurface,
  },
  upcomingBanner: {
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upcomingBannerText: {
    ...FONTS.bodySm,
    color: '#004D40',
    flex: 1,
    fontWeight: '600',
  },
  modeLockedText: {
    ...FONTS.labelMd,
    color: COLORS.onPrimary,
  },
  tabBadge: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginLeft: 6,
  },
  tabBadgeText: {
    color: COLORS.onPrimaryContainer,
    fontSize: 11,
    fontWeight: 'bold',
  },
  schedulesListContainer: {
    backgroundColor: COLORS.surfaceContainerLowest,
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  schedulesListWrapper: {
    marginTop: 8,
  },
  sectionHeaderEnterprise: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    paddingHorizontal: 24,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    borderStyle: 'dashed',
  },
  premiumCard: {
    backgroundColor: COLORS.surface,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceContainerLow,
    overflow: 'hidden',
  },
  premiumCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
  },
  premiumCardBadge: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  premiumCardBadgeText: {
    ...FONTS.labelLg,
    color: COLORS.onSurfaceVariant,
  },
  premiumCardInterestedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 109, 54, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  premiumCardInterestedText: {
    ...FONTS.labelMd,
    color: COLORS.primary,
  },
  premiumCardBody: {
    flexDirection: 'row',
    padding: 12,
    paddingTop: 0,
    alignItems: 'center',
  },
  premiumCardTimeCol: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: COLORS.surfaceContainerLow,
  },
  premiumCardRouteCol: {
    flex: 1,
    paddingLeft: 16,
  },
  premiumCardActionCol: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.surfaceContainerLow,
    marginLeft: 8,
  },
  actionColBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionColBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  actionColBtnCancel: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineGraphic: {
    width: 16,
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDotTop: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  timelineDotBottom: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.onSurfaceVariant,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.surfaceContainerHigh,
    marginVertical: 4,
  },
  premiumCardExpandToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceContainerLow,
  },
  premiumCardExpandedInfo: {
    padding: 16,
    backgroundColor: COLORS.surfaceBright,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceContainerLow,
  },
  premiumCardInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  premiumCardInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  premiumCardActionBar: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
  },
  premiumCardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  premiumCardActionBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  premiumCardActionBtnCancel: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  modeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F4F3',
    borderRadius: 12,
    padding: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: COLORS.primary,
  },
  modeTabDisabled: {
    opacity: 0.5,
  },
  modeTabText: {
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  modeHint: {
    color: COLORS.onSurfaceVariant,
    fontSize: 12,
  },
  onlineHintText: {
    ...FONTS.bodySm,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  onlineStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlineStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectionWrap: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E8ECEA',
    gap: 12,
  },
  qrWrap: {
    alignItems: 'center',
    marginTop: 12,
  },
  rideInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  farePreviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE7E1',
    backgroundColor: '#F7FBF9',
    padding: 12,
    gap: 8,
  },
  farePreviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  farePreviewTitle: {
    ...FONTS.labelLg,
    color: COLORS.onSurface,
  },
  farePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  farePreviewLabel: {
    ...FONTS.bodySm,
    color: COLORS.onSurfaceVariant,
  },
  farePreviewValue: {
    ...FONTS.labelLg,
    color: COLORS.onSurface,
  },
  inputValue: {
    flex: 1,
    color: COLORS.onSurface,
  },
  textInput: {
    flex: 1,
    color: COLORS.onSurface,
  },
  useCurrentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  seatRow: {
    gap: 8,
  },
  seatChip: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  seatChipActive: {
    backgroundColor: COLORS.primaryContainer,
  },
  seatChipText: {
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  seatChipTextActive: {
    color: COLORS.onPrimaryContainer,
    fontWeight: '700',
  },
  seatHintText: {
    ...FONTS.bodySm,
    color: COLORS.onSurfaceVariant,
    marginTop: -4,
  },
  errorText: {
    color: COLORS.error,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completedBadgeText: {
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  liveBadge: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filterRow: {
    gap: 8,
    marginTop: 12,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceContainerLow,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPillActive: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(0, 109, 54, 0.10)',
  },
  requestCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  routeWrap: {
    marginTop: 12,
    gap: 8,
  },
  routeLine: {
    height: 1,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primaryContainer,
  },
  dropoffDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.onSurfaceVariant,
  },
  requestMeta: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  acceptBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptBtnDisabled: {
    opacity: 0.6,
  },
  modalPage: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  modalBack: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
  },
  modalSpacer: {
    width: 32,
  },
  modalSearch: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalInput: {
    flex: 1,
    color: COLORS.onSurface,
  },
  modalList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  mapModalMapWrap: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  mapModalMap: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapModalUnavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  mapModalCloseBtn: {
    position: 'absolute',
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...AMBIENT_SHADOW,
    zIndex: 10,
  },
  mapModalBottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 14,
  },
  mapSheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.surfaceContainerHighest,
    marginBottom: 2,
  },
  mapSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapSheetStudentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mapSheetAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceContainer,
  },
  mapSheetAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  mapSheetStudentCopy: {
    flex: 1,
  },
  mapSheetFarePill: {
    minWidth: 92,
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  mapSheetStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mapSheetStatCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  mapSheetRouteCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  mapSheetRouteText: {
    flex: 1,
    paddingBottom: 10,
  },
  mapSheetAcceptButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
});
