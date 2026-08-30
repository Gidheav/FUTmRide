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
import { useAuthStore } from '../../core/authStore';
import { startDriverLocationTracking, stopDriverLocationTracking } from '../../core/locationSocket';
import { useGarageRideStore } from '../../core/garageRideStore';
import { useDriverRidesStore } from '../../core/driverRidesStore';
import { useToast } from '../context/ToastContext';
import { 
  getDriverActivityState, 
  canGoOnline, 
  canCreateGarageRide,
  getUpcomingScheduledRide,
  formatTimeUntil,
  isScheduledRideLocked,
  SCHEDULED_RIDE_AUTO_OFFLINE_MINUTES,
  canAcceptOnDemandNearScheduled
} from '../../core/driverActivity';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';
import { useLocations } from '../../core/locationDataService';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import Constants from 'expo-constants';
import ActiveRideScreen from '../screens/ActiveRideScreen';

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
  vehicle_seats: 5,
};

const DRIVER_VERIFICATION_MESSAGE = 'Your driver account must be verified before you can accept rides, create garage rides, or join scheduled rides.';


type DriverMode = 'garage' | 'scheduled' | 'ondemand';

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

const filterLocations = (query: string, locations: LocationOption[]) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return locations;
  return locations.filter((item) => {
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

const decodePolyline = (t: string) => {
  let points = [];
  let index = 0, len = t.length;
  let lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = t.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = t.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    points.push({ latitude: (lat / 1e5), longitude: (lng / 1e5) });
  }
  return points;
};

const routeCache: Record<string, { latitude: number, longitude: number }[]> = {};
const fetchRouteGeometry = async (ride: any) => {
  if (routeCache[ride.id]) return routeCache[ride.id];
  const GOOGLE_API_KEY = Constants.expoConfig?.android?.config?.googleMaps?.apiKey || 'AIzaSyD5nLbEz_xY6UOHJ1mbjvipD1PY1A14erQ';
  
  const oLat = Number(ride.origin_latitude);
  const oLng = Number(ride.origin_longitude);
  const dLat = Number(ride.destination_latitude);
  const dLng = Number(ride.destination_longitude);
  if (!oLat || !oLng || !dLat || !dLng) return null;

  let waypoints = '';
  if (Array.isArray(ride.stops) && ride.stops.length > 0) {
    const wps = ride.stops
      .map((s: any) => `${Number(s.latitude)},${Number(s.longitude)}`)
      .join('|');
    waypoints = `&waypoints=${wps}`;
  }

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${oLat},${oLng}&destination=${dLat},${dLng}${waypoints}&key=${GOOGLE_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const points = decodePolyline(data.routes[0].overview_polyline.points);
      routeCache[ride.id] = points;
      return points;
    }
  } catch (e) {
    console.error('Error fetching directions', e);
  }
  return null;
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
      latitudeDelta: 0.055,
      longitudeDelta: 0.055,
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
    latitudeDelta: Math.max(maxLatitude - minLatitude, 0.035) + 0.035,
    longitudeDelta: Math.max(maxLongitude - minLongitude, 0.035) + 0.035,
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

const ScheduledRideCard = React.memo(function ScheduledRideCard({ 
  ride,
  isSelected,
  onCardPress,
  onDetailsPress,
}: { 
  ride: any,
  isSelected: boolean,
  onCardPress: () => void,
  onDetailsPress: () => void,
}) {
  const date = new Date(`${ride.departure_date}T${ride.window_start}`);
  const isInterested = ride.driver_interest_status === 'interested' || ride.driver_interest_status === 'assigned';
  const isAssigned = ride.driver_interest_status === 'assigned';
  
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onCardPress}
      style={[
        styles.scheduledCompactCard,
        isSelected && styles.scheduledCompactCardActive,
      ]}
    >
      {/* Interest dot indicator */}
      {isInterested && <View style={[styles.scheduledInterestDot, isAssigned && { backgroundColor: COLORS.primary }]} />}

      {/* Time column */}
      <View style={styles.scheduledCompactTime}>
        <Text style={[FONTS.labelLg, { color: isSelected ? COLORS.primary : COLORS.onSurface, fontWeight: '700' }]} numberOfLines={1}>
          {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 1 }]} numberOfLines={1}>
          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
      </View>

      {/* Divider */}
      <View style={styles.scheduledCompactDivider} />

      {/* Route column */}
      <View style={styles.scheduledCompactRoute}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <View style={styles.scheduledDotOrigin} />
          <Text style={[FONTS.bodySm, { color: COLORS.onSurface, flex: 1, fontWeight: '500' }]} numberOfLines={1}>
            {ride.origin_address || 'Pickup'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={styles.scheduledDotDest} />
          <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, flex: 1 }]} numberOfLines={1}>
            {ride.destination_address || 'Dropoff'}
          </Text>
        </View>
      </View>

      {/* Details Button */}
      <TouchableOpacity 
        style={styles.scheduledCompactDetailsBtn}
        onPress={onDetailsPress}
      >
        <Text style={[FONTS.labelMd, { color: COLORS.primary }]}>Details</Text>
        <MaterialIcons name="chevron-right" size={16} color={COLORS.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

import CreateGarageRideScreen from '../screens/CreateGarageRideScreen';

interface DriverRidesPageProps {
  route?: any;
  onBack?: () => void;
  onRideFinished?: () => void;
  requestedFilter?: string | null;
  onFilterConsumed?: () => void;
}

export default function RidesPage({ route, onBack, onRideFinished, requestedFilter, onFilterConsumed }: DriverRidesPageProps) {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { user } = useAuthStore();
  const isDriverVerified = Boolean(user?.is_verified);
  const {
    isOnline,
    marketplaceRequests: cachedRequests,
    driverHasActiveRide: cachedHasActiveRide,
    garageRide: cachedGarageRide,
    garagePassengers: cachedGaragePassengers,
    setIsOnline: setCachedIsOnline,
    setMarketplaceRequests: setCachedRequests,
    setDriverHasActiveRide: setCachedHasActiveRide,
    setGarageRide: setCachedGarageRide,
    setGaragePassengers: setCachedGaragePassengers,
    setRideHistory: setCachedRideHistory,
    offlineMode,
  } = useDriverRidesStore();

  // Effective tab derived from online/offline state:
  // - Online → always on-demand
  // - Offline → whichever offlineMode is set in the store (garage | scheduled)
  const driverMode: DriverMode = isOnline ? 'ondemand' : offlineMode;

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

  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timer: NodeJS.Timeout;

    const fetchLoc = async () => {
      if (!isOnline) return;
      try {
        const { getCurrentPositionAsync, Accuracy } = await import('expo-location');
        const loc = await getCurrentPositionAsync({ accuracy: Accuracy.Balanced });
        if (isMounted) {
          setDriverLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch (e) {
        // ignore
      }
    };

    fetchLoc();
    if (isOnline) {
      timer = setInterval(fetchLoc, 15000);
    }
    
    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
    };
  }, [isOnline]);

  const sortedMarketplaceRequests = useMemo(() => {
    let list = [...marketplaceRequests];
    if (driverLocation) {
      list = list.map((ride: any) => {
        let dist = null;
        if (ride.pickup_latitude && ride.pickup_longitude) {
          dist = haversineKm(
            driverLocation.latitude,
            driverLocation.longitude,
            Number(ride.pickup_latitude),
            Number(ride.pickup_longitude)
          );
        }
        return { ...ride, _distanceToPickup: dist };
      }).sort((a: any, b: any) => {
        const distA = a._distanceToPickup ?? Infinity;
        const distB = b._distanceToPickup ?? Infinity;
        return distA - distB;
      });
    }
    return list;
  }, [marketplaceRequests, driverLocation]);

  useEffect(() => {
    if (!isRideMapReady || !mapRef.current || selectedRideCoordinates.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(selectedRideCoordinates, {
        edgePadding: { top: 110, right: 70, bottom: 320, left: 70 },
        animated: true,
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [isRideMapReady, selectedRideCoordinates]);

  const [driverHasActiveRide, setDriverHasActiveRide] = useState(cachedHasActiveRide);
  const [activeFilter, setActiveFilter] = useState('High Fare');

  useEffect(() => {
    if (requestedFilter) {
      setActiveFilter(requestedFilter);
      if (onFilterConsumed) onFilterConsumed();
    }
  }, [requestedFilter, onFilterConsumed]);
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
  
  const rawLocations = useLocations();
  const locations = useMemo(() => {
    return rawLocations.map((loc) => ({
      id: loc.id,
      label: loc.name,
      description: loc.description,
      latitude: Number(loc.latitude),
      longitude: Number(loc.longitude),
    }));
  }, [rawLocations]);

  const filteredLocations = useMemo(() => filterLocations(locationQuery, locations), [locationQuery, locations]);
  
  // Scheduled Rides Bidding State
  const [availableScheduledRides, setAvailableScheduledRides] = useState<any[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const scheduledFetchedOnce = useRef(false);
  const [expressingInterestId, setExpressingInterestId] = useState<string | null>(null);
  const [scheduledError, setScheduledError] = useState<string | null>(null);
  const [selectedScheduledRide, setSelectedScheduledRide] = useState<any>(null); // For map highlighting
  const [detailedScheduledRide, setDetailedScheduledRide] = useState<any>(null); // For the modal
  const [scheduledRoutesGeometry, setScheduledRoutesGeometry] = useState<Record<string, { latitude: number, longitude: number }[]>>({});
  const errorHoldUntil = useRef<number>(0);
  const initialFetchDone = useRef(cachedRequests.length > 0);
  const isFetchingRequests = useRef(false);
  const pendingGpsVerifyInFlight = useRef(false);

  // Compute upcoming scheduled ride for the awareness banner
  const upcomingScheduledRide = useMemo(() => {
    return getUpcomingScheduledRide(availableScheduledRides);
  }, [availableScheduledRides]);

  // True when a scheduled ride is within the 15-min lock window — blocks garage creation & on-demand
  const hasImminentScheduledRide = useMemo(
    () => Boolean(upcomingScheduledRide && isScheduledRideLocked(upcomingScheduledRide)),
    [upcomingScheduledRide],
  );

  // Active On-Demand Ride State
  const [activeOnDemandRide, setActiveOnDemandRide] = useState<any>(null);
  const [loadingActiveOnDemand, setLoadingActiveOnDemand] = useState(false);
  const [advancingRideId, setAdvancingRideId] = useState<string | null>(null);

  const garageIsActive = garageRide && ['open', 'full', 'departed'].includes(garageRide.status);
  const isOfflineBlocked = Boolean(driverHasActiveRide || garageIsActive);

  const clearFinishedOnDemandRide = useCallback((rideId: string) => {
    setActiveOnDemandRide(null);
    setDriverHasActiveRide(false);
    setCachedHasActiveRide(false);
    setMarketplaceRequests((prev) => {
      const next = prev.filter((ride) => ride.id !== rideId);
      setCachedRequests(next);
      return next;
    });
    setSelectedRideForMap((selected) => (selected?.id === rideId ? null : selected));
    driverApi.getRideHistory()
      .then((historyRes) => {
        const rides = Array.isArray(historyRes?.data)
          ? historyRes.data
          : historyRes?.data?.results || [];
        setCachedRideHistory(rides.slice(0, 50));
      })
      .catch(() => {});
    onRideFinished?.();
  }, [onRideFinished, setCachedHasActiveRide, setCachedRequests, setCachedRideHistory]);



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
          setCachedIsOnline(nextStatus);
        }
      } catch (error: any) {
        if (isMounted) {
          // Profile may not exist yet — default to offline so toggle works
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
      if (garageRide) {
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
          // Always replace with fresh server data so cancelled/taken rides vanish instantly
          setAvailableScheduledRides((prev) => {
            if (rawData.length > prev.length) {
              LayoutAnimation.configureNext(customZoomAnimation);
            }
            setScheduledNextUrl(nextUrl);
            return rawData;
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

  // Fetch true geometry from Google Directions when a scheduled ride is selected
  useEffect(() => {
    if (!selectedScheduledRide) return;
    const rideId = selectedScheduledRide.id;
    if (scheduledRoutesGeometry[rideId]) return;

    let isMounted = true;
    (async () => {
       const geom = await fetchRouteGeometry(selectedScheduledRide);
       if (isMounted && geom) {
         setScheduledRoutesGeometry(prev => ({ ...prev, [rideId]: geom }));
       }
    })();
    return () => { isMounted = false; };
  }, [selectedScheduledRide, scheduledRoutesGeometry]);

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
            // Always replace with the fresh server list so stale/cancelled rides disappear instantly
            setMarketplaceNextUrl(nextUrl);
            setMarketplaceRequests((prev) => {
              // Animate only when rows are added
              if (list.length > prev.length) {
                LayoutAnimation.configureNext(customZoomAnimation);
              }
              return list as RideListItem[];
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


  // ── Auto-offline before scheduled ride ──
  useEffect(() => {
    if (!upcomingScheduledRide || !isOnline) return;

    const departureMs = new Date(`${upcomingScheduledRide.departure_date}T${upcomingScheduledRide.window_start}`).getTime();
    if (Number.isNaN(departureMs)) return;

    const now = Date.now();
    const lockMs = SCHEDULED_RIDE_AUTO_OFFLINE_MINUTES * 60000;
    const timeUntilLock = departureMs - lockMs - now;

    const executeAutoOffline = async () => {
      try {
        await driverApi.updateAvailability({ is_online: false });
        setCachedIsOnline(false);
        showToast(`You've been taken offline — your scheduled ride departs in ${SCHEDULED_RIDE_AUTO_OFFLINE_MINUTES} minutes.`, 'info');
      } catch (err) {
        console.warn('Failed to auto-offline', err);
      }
    };

    if (timeUntilLock <= 0) {
      // We are already inside the lock window
      executeAutoOffline();
      return;
    }

    const timerId = setTimeout(() => {
      executeAutoOffline();
    }, timeUntilLock);

    return () => clearTimeout(timerId);
  }, [upcomingScheduledRide, isOnline]);

  const handleAcceptRide = useCallback(async (rideId: string) => {
    if (acceptingRideId) return;
    if (!isDriverVerified) {
      Alert.alert('Verification Required', DRIVER_VERIFICATION_MESSAGE);
      return;
    }

    // Scheduled ride proximity guard
    if (upcomingScheduledRide && driverLocation) {
      const onDemandRide = marketplaceRequests.find(r => r.id === rideId);
      if (onDemandRide) {
        let distToScheduled = null;
        if (upcomingScheduledRide.origin_latitude && upcomingScheduledRide.origin_longitude) {
          distToScheduled = haversineKm(
            driverLocation.latitude,
            driverLocation.longitude,
            Number(upcomingScheduledRide.origin_latitude),
            Number(upcomingScheduledRide.origin_longitude)
          );
        }
        
        const guard = canAcceptOnDemandNearScheduled(onDemandRide.estimated_distance_km, distToScheduled);
        if (!guard.allowed) {
          Alert.alert(
            'Distance Warning',
            `${guard.reason}\n${guard.suggestion}`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Accept Anyway', style: 'destructive', onPress: () => performAcceptRide(rideId) }
            ]
          );
          return;
        }
      }
    }

    performAcceptRide(rideId);
  }, [acceptingRideId, isDriverVerified, upcomingScheduledRide, driverLocation, marketplaceRequests]);

  const performAcceptRide = async (rideId: string) => {
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

      // If server reports active trip conflict, attempt fetching active ride to sync UI
      if (status === 400 || status === 409) {
        try {
          const activeRes = await driverApi.getActiveRide();
          if (activeRes?.data) {
            setActiveOnDemandRide(activeRes.data);
            setDriverHasActiveRide(true);
            setCachedHasActiveRide(true);
            setAcceptingRideId(null);
            return;
          }
        } catch (_) {
          // No active ride in DB (backend self-healing handles stale flag)
        }
      }

      const statusLabel = status ? `(${status}) ` : '';
      setRequestsError(`${statusLabel}${message}`.trim());
      errorHoldUntil.current = Date.now() + 12000;
    } finally {
      setAcceptingRideId(null);
    }
  };

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
      let payload = undefined;
      // If we are completing the trip, attempt GPS verification
      if (activeOnDemandRide?.status === 'in_progress') {
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
          try {
            const { getCurrentPositionAsync, Accuracy } = await import('expo-location');
            const loc = await getCurrentPositionAsync({ accuracy: Accuracy.Balanced });
            payload = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            break;
          } catch (e) {
            attempts++;
            if (attempts >= maxAttempts) {
              console.warn('GPS verification failed after 3 attempts', e);
            }
          }
        }
      }

      const res = await driverApi.advanceRide(rideId, payload);
      const nextRide = res.data;
      if (['completed', 'cancelled', 'cancelled_by_student', 'cancelled_by_driver', 'cancelled_no_driver', 'cancelled_no_show'].includes(nextRide.status)) {
        clearFinishedOnDemandRide(rideId);
      } else {
        setActiveOnDemandRide(nextRide);
        setDriverHasActiveRide(true);
        setCachedHasActiveRide(true);
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
  }, [advancingRideId, activeOnDemandRide?.status, clearFinishedOnDemandRide]);

  useEffect(() => {
    if (!activeOnDemandRide?.id || activeOnDemandRide.status !== 'pending_completion') return;

    let isMounted = true;
    const pollRideCompletion = async () => {
      try {
        const res = await driverApi.getRideDetail(activeOnDemandRide.id);
        const nextRide = res?.data;
        if (!isMounted || !nextRide) return;
        if (['completed', 'cancelled', 'cancelled_by_student', 'cancelled_by_driver', 'cancelled_no_driver', 'cancelled_no_show'].includes(nextRide.status)) {
          clearFinishedOnDemandRide(activeOnDemandRide.id);
        } else {
          setActiveOnDemandRide(nextRide);
        }
      } catch {
        // Keep the waiting screen visible until the next successful poll.
      }
    };

    const verifyPendingCompletionWithGps = async () => {
      if (pendingGpsVerifyInFlight.current) return;
      pendingGpsVerifyInFlight.current = true;
      try {
        const { getCurrentPositionAsync, Accuracy } = await import('expo-location');
        const loc = await getCurrentPositionAsync({ accuracy: Accuracy.High });
        const res = await driverApi.advanceRide(activeOnDemandRide.id, {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        const nextRide = res?.data;
        if (!isMounted || !nextRide) return;
        if (['completed', 'cancelled', 'cancelled_by_student', 'cancelled_by_driver', 'cancelled_no_driver', 'cancelled_no_show'].includes(nextRide.status)) {
          clearFinishedOnDemandRide(activeOnDemandRide.id);
        } else {
          setActiveOnDemandRide(nextRide);
        }
      } catch {
        // GPS may fail or be outside the dropoff axis; keep waiting for student confirmation.
      } finally {
        pendingGpsVerifyInFlight.current = false;
      }
    };

    void verifyPendingCompletionWithGps();
    const pollInterval = setInterval(pollRideCompletion, 5000);
    const gpsInterval = setInterval(verifyPendingCompletionWithGps, 12000);
    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      clearInterval(gpsInterval);
    };
  }, [activeOnDemandRide?.id, activeOnDemandRide?.status, clearFinishedOnDemandRide]);

  const handleToggleOnline = async () => {
    if (isUpdatingOnline || isOnline === null) return;
    
    const activityState = getDriverActivityState(isOnline, garageRide, driverHasActiveRide);
    const hasLock = upcomingScheduledRide ? isScheduledRideLocked(upcomingScheduledRide) : false;
    
    // Only apply the guard if they are trying to GO online (not offline)
    if (!isOnline) {
      if (!isDriverVerified) {
        Alert.alert('Verification Required', DRIVER_VERIFICATION_MESSAGE);
        return;
      }
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
      setCachedIsOnline(nextStatus);
      setRequestsError(null);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        try {
          await ensureDriverProfile();
          await driverApi.updateAvailability({ is_online: nextStatus });
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

  // NOTE: driverMode is fully derived (isOnline ? 'ondemand' : offlineMode) — no setter needed.

  const [cancellingInterestId, setCancellingInterestId] = useState<string | null>(null);

  const handleExpressInterest = useCallback(async (rideId: string) => {
    if (!isDriverVerified) {
      Alert.alert('Verification Required', DRIVER_VERIFICATION_MESSAGE);
      return;
    }
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
  }, [isDriverVerified]);

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

  const [cancelAssignmentModalVisible, setCancelAssignmentModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingAssignmentId, setCancellingAssignmentId] = useState<string | null>(null);

  const handleCancelAssignmentSubmit = async () => {
    if (!cancellingAssignmentId || !cancelReason.trim()) return;
    try {
      await driverApi.cancelScheduledAssignment(cancellingAssignmentId, cancelReason);
      setAvailableScheduledRides(prev => prev.map(r => 
        r.id === cancellingAssignmentId ? { ...r, driver_interest_status: 'withdrawn_with_fine' } : r
      ));
      setCancelAssignmentModalVisible(false);
      setCancelReason('');
      setDetailedScheduledRide(null);
      Alert.alert('Assignment Cancelled', 'Your assignment was cancelled and a fine has been applied.');
    } catch (err: any) {
      let errorMessage = 'Failed to cancel assignment.';
      if (err?.response?.data?.error) {
        errorMessage = typeof err.response.data.error === 'string' ? err.response.data.error : JSON.stringify(err.response.data.error);
      } else if (err?.response?.data?.detail) {
        errorMessage = typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail);
      } else if (err?.message) {
        errorMessage = err.message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setCancellingAssignmentId(null);
    }
  };

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

  const scheduledMapRef = useRef<MapView>(null);

  const renderScheduledItem = useCallback(({ item }: { item: any }) => (
    <ScheduledRideCard
      ride={item}
      isSelected={selectedScheduledRide?.id === item.id}
      onCardPress={() => {
        setSelectedScheduledRide(item);
        // Zoom map to this ride's route
        const oLat = Number(item.origin_latitude);
        const oLng = Number(item.origin_longitude);
        const dLat = Number(item.destination_latitude);
        const dLng = Number(item.destination_longitude);
        if (oLat && oLng && dLat && dLng) {
          const coords = [{ latitude: oLat, longitude: oLng }];
          if (Array.isArray(item.stops)) {
            item.stops.forEach((s: any) => {
              const sLat = Number(s.latitude);
              const sLng = Number(s.longitude);
              if (sLat && sLng) coords.push({ latitude: sLat, longitude: sLng });
            });
          }
          coords.push({ latitude: dLat, longitude: dLng });
          scheduledMapRef.current?.fitToCoordinates(
            coords,
            { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true },
          );
        }
      }}
      onDetailsPress={() => setDetailedScheduledRide(item)}
    />
  ), [selectedScheduledRide?.id, setSelectedScheduledRide, setDetailedScheduledRide]);

  const renderRequestItem = useCallback(({ item: ride }: { item: any }) => {
    const requestedSeats = ride.requested_seats || 0;
    const distToPickup = typeof ride._distanceToPickup === 'number' 
      ? `${ride._distanceToPickup.toFixed(1)} km` 
      : null;
    return (
      <View style={{ paddingHorizontal: 16, opacity: isOnline ? 1 : 0.4 }} pointerEvents={isOnline ? 'auto' : 'none'}>
        <RequestCard
          name={getStudentName(ride.student)}
          rating="New"
          fare={formatCurrency(ride.total_fare)}
          seats={requestedSeats}
          distToPickup={distToPickup}
          from={ride.pickup_address || 'Pickup location'}
          to={ride.dropoff_address || 'Dropoff location'}
          distance={formatDistance(ride.estimated_distance_km)}
          acceptLabel="Accept Request"
          onAccept={() => handleAcceptRide(ride.id)}
          onCardPress={() => {
            setReadyRideMapId(null);
            setSelectedRideForMap(ride);
          }}
          disabled={Boolean(acceptingRideId === ride.id || driverHasActiveRide || modeLocked || !isOnline || !isDriverVerified)}
        />
      </View>
    );
  }, [acceptingRideId, driverHasActiveRide, modeLocked, handleAcceptRide, isOnline, isDriverVerified]);

  if (activeOnDemandRide) {
    return (
      <ActiveRideScreen 
        activeOnDemandRide={activeOnDemandRide}
        onAdvanceRide={handleAdvanceRide}
        advancingRideId={advancingRideId}
        errorMessage={requestsError}
      />
    );
  }

  if (driverMode === 'garage' || garageRide) {
    return <CreateGarageRideScreen onBack={onBack || (() => {})} />;
  }

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

      {/* ── Scheduled Tab: Map + List hybrid ── */}
      {driverMode === 'scheduled' && (
        <View style={{ flex: 1 }}>
          {/* ── Map Panel ── */}
          <View style={styles.scheduledMapPanel}>
            <MapView
              ref={scheduledMapRef}
              style={[StyleSheet.absoluteFillObject, { height: '110%', marginBottom: -30 }]}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: availableScheduledRides.length > 0
                  ? Number(availableScheduledRides[0].origin_latitude) || 9.6171
                  : 9.6171,
                longitude: availableScheduledRides.length > 0
                  ? Number(availableScheduledRides[0].origin_longitude) || 6.5492
                  : 6.5492,
                latitudeDelta: 0.06,
                longitudeDelta: 0.06,
              }}
              showsUserLocation
              showsMyLocationButton={false}
            >
              {availableScheduledRides.map((ride: any) => {
                const oLat = Number(ride.origin_latitude);
                const oLng = Number(ride.origin_longitude);
                const dLat = Number(ride.destination_latitude);
                const dLng = Number(ride.destination_longitude);
                if (!oLat || !oLng) return null;
                const isActive = selectedScheduledRide?.id === ride.id;
                return (
                  <React.Fragment key={ride.id}>
                    {/* Origin pin */}
                    <Marker
                      coordinate={{ latitude: oLat, longitude: oLng }}
                      tracksViewChanges={false}
                      pinColor="green"
                      title="Pickup"
                      onPress={() => {
                        setSelectedScheduledRide(ride);
                        if (dLat && dLng) {
                          const coords = [{ latitude: oLat, longitude: oLng }];
                          if (Array.isArray(ride.stops)) {
                            ride.stops.forEach((s: any) => {
                              const sLat = Number(s.latitude);
                              const sLng = Number(s.longitude);
                              if (sLat && sLng) coords.push({ latitude: sLat, longitude: sLng });
                            });
                          }
                          coords.push({ latitude: dLat, longitude: dLng });
                          scheduledMapRef.current?.fitToCoordinates(
                            coords,
                            { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true },
                          );
                        }
                      }}
                    />

                    {/* Destination & Stop pins — only shown for selected ride */}
                    {isActive && dLat && dLng && (
                      <>
                        <Marker 
                          coordinate={{ latitude: dLat, longitude: dLng }} 
                          tracksViewChanges={false} 
                          pinColor="red" 
                          title="Destination" 
                        />
                        
                        {/* Render intermediate stops */}
                        {Array.isArray(ride.stops) && ride.stops.map((stop: any, idx: number) => {
                          const sLat = Number(stop.latitude);
                          const sLng = Number(stop.longitude);
                          if (!sLat || !sLng) return null;
                          return (
                            <Marker 
                              key={stop.id || idx} 
                              coordinate={{ latitude: sLat, longitude: sLng }} 
                              tracksViewChanges={false} 
                              pinColor="blue"
                              title={`Stop ${idx + 1}`}
                            />
                          );
                        })}

                        {/* Route line */}
                        {scheduledRoutesGeometry[ride.id] && (
                          <Polyline
                            coordinates={scheduledRoutesGeometry[ride.id]}
                            strokeColor={COLORS.primary}
                            strokeWidth={4}
                          />
                        )}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </MapView>

            {/* Ride count badge */}
            <View style={styles.scheduledMapBadge} pointerEvents="none">
              <MaterialIcons name="event-note" size={14} color={COLORS.onPrimary} />
              <Text style={[FONTS.labelMd, { color: COLORS.onPrimary, marginLeft: 4 }]}>
                {availableScheduledRides.length} ride{availableScheduledRides.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {loadingScheduled && (
              <View style={styles.scheduledMapLoading}>
                <LoadingOverlay visible={true} inline size={32} />
              </View>
            )}
          </View>

          {/* ── List Panel ── */}
          {scheduledError ? (
            <View style={[styles.emptyStateContainer, { margin: 16 }]}>
              <MaterialIcons name="error-outline" size={40} color={COLORS.error} />
              <Text style={[FONTS.bodyMd, { color: COLORS.error, marginTop: 8, textAlign: 'center' }]}>{scheduledError}</Text>
            </View>
          ) : availableScheduledRides.length === 0 && !loadingScheduled ? (
            <View style={[styles.emptyStateContainer, { margin: 16 }]}>
              <MaterialIcons name="event-busy" size={40} color={COLORS.surfaceContainerHigh} />
              <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, marginTop: 8, textAlign: 'center' }]}>No available schedules right now.</Text>
            </View>
          ) : (
            <View style={styles.scheduledListPanel}>
              <View style={styles.scheduledListHeader}>
                <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Available Scheduled Rides</Text>
              </View>
              <CustomRefreshFlatList
                data={availableScheduledRides}
                keyExtractor={scheduledKeyExtractor}
                renderItem={renderScheduledItem}
                showsVerticalScrollIndicator={false}
                initialNumToRender={8}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}
                refreshing={refreshing}
                onRefresh={onRefresh}
                ItemSeparatorComponent={ListItemSeparator}
                onEndReached={loadMoreScheduled}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loadingMoreScheduled ? <LoadingOverlay visible={true} inline size={32} /> : null}
              />
            </View>
          )}
        </View>
      )}

      {/* ── On-Demand Tab ── */}
      <CustomRefreshFlatList
        style={driverMode !== 'ondemand' ? { display: 'none', position: 'absolute' } : { flex: 1 }}
        data={!loadingRequests && !requestsError ? sortedMarketplaceRequests : []}
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

      {/* Garage Tab is now handled by the early return of CreateGarageRideScreen above */}

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
                  disabled={acceptingRideId === selectedRideForMap.id || !isDriverVerified}
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

      {/* ── Scheduled Ride Modal ── */}
      <Modal
        visible={!!detailedScheduledRide}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailedScheduledRide(null)}
      >
        <View style={styles.mapSheetOverlay}>
          <TouchableOpacity
            style={styles.mapSheetBackdrop}
            activeOpacity={1}
            onPress={() => setDetailedScheduledRide(null)}
          />

          {detailedScheduledRide && (() => {
            const ride = detailedScheduledRide;
            const date = new Date(`${ride.departure_date}T${ride.window_start}`);
            const isInterested = ride.driver_interest_status === 'interested';
            const isAssigned = ride.driver_interest_status === 'assigned';
            const isWithdrawn = ride.driver_interest_status === 'withdrawn_with_fine';
            const isExp = expressingInterestId === ride.id;
            const isCan = cancellingInterestId === ride.id;
            return (
              <View style={[styles.mapSheetContainer, { paddingBottom: insets.bottom + 8 }]}>
                <View style={styles.mapSheetHandleWrap}>
                  <View style={styles.mapSheetHandle} />
                </View>

                {/* Header */}
                <View style={styles.mapSheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[FONTS.titleMd, { color: COLORS.onSurface }]}>Scheduled Ride</Text>
                    <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 2 }]}>
                      {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  {isInterested && (
                    <View style={styles.premiumCardInterestedBadge}>
                      <MaterialIcons name="check" size={12} color={COLORS.primary} />
                      <Text style={[FONTS.labelMd, { color: COLORS.primary, marginLeft: 4 }]}>Interested</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => setDetailedScheduledRide(null)} style={{ padding: 4 }}>
                    <MaterialIcons name="close" size={22} color={COLORS.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>

                {/* Route */}
                <View style={styles.mapSheetRouteCard}>
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineGraphic}>
                      <View style={styles.timelineDotTop} />
                      <View style={styles.timelineLine} />
                    </View>
                    <View style={styles.mapSheetRouteText}>
                      <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Pickup</Text>
                      <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]}>{ride.origin_address}</Text>
                    </View>
                  </View>
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineGraphic}>
                      <View style={styles.timelineDotBottom} />
                    </View>
                    <View style={styles.mapSheetRouteText}>
                      <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Dropoff</Text>
                      <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]}>{ride.destination_address}</Text>
                    </View>
                  </View>
                </View>

                {/* Chips row */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <View style={styles.premiumCardInfoItem}>
                    <MaterialIcons name="directions-car" size={14} color={COLORS.outline} />
                    <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginLeft: 5 }]}>
                      {Array.isArray(ride.allowed_vehicle_types) && ride.allowed_vehicle_types.length > 0
                        ? ride.allowed_vehicle_types.map((v: string) => v.replace(/_/g, ' ')).join(', ')
                        : String(ride.vehicle_size || '').replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <View style={styles.premiumCardInfoItem}>
                    <MaterialIcons name="people" size={14} color={COLORS.outline} />
                    <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginLeft: 5 }]}>{ride.passenger_count || 0} pax</Text>
                  </View>
                  {(ride.stops_count > 0) && (
                    <View style={styles.premiumCardInfoItem}>
                      <MaterialIcons name="alt-route" size={14} color={COLORS.outline} />
                      <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginLeft: 5 }]}>{ride.stops_count} stop{ride.stops_count !== 1 ? 's' : ''}</Text>
                    </View>
                  )}
                  {ride.standard_enabled && (
                    <View style={[styles.premiumCardInfoItem, { backgroundColor: COLORS.primaryContainer }]}>
                      <Text style={[FONTS.bodySm, { color: COLORS.onPrimaryContainer }]}>Std ₦{Number(ride.standard_price || 0).toLocaleString()}</Text>
                    </View>
                  )}
                  {ride.premium_enabled && (
                    <View style={[styles.premiumCardInfoItem, { backgroundColor: COLORS.surfaceContainerHigh }]}>
                      <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]}>Prem ₦{Number(ride.premium_price || 0).toLocaleString()}</Text>
                    </View>
                  )}
                  {ride.freight_enabled && (
                    <View style={[styles.premiumCardInfoItem, { backgroundColor: COLORS.surfaceContainerHigh }]}>
                      <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]}>Freight ₦{Number(ride.freight_price || 0).toLocaleString()}</Text>
                    </View>
                  )}
                </View>

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                  {isAssigned ? (
                    <TouchableOpacity
                      style={[styles.mapSheetAcceptButton, { flex: 1, backgroundColor: COLORS.errorContainer, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }]}
                      onPress={() => { 
                        setCancellingAssignmentId(ride.id);
                        setCancelAssignmentModalVisible(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <MaterialIcons name="close" size={20} color={COLORS.error} />
                      <Text style={[FONTS.labelLg, { color: COLORS.error }]}>Not going</Text>
                    </TouchableOpacity>
                  ) : isInterested ? (
                    <TouchableOpacity
                      style={[styles.mapSheetAcceptButton, { flex: 1, backgroundColor: COLORS.errorContainer, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }]}
                      onPress={() => { handleCancelInterest(ride.id); setDetailedScheduledRide(null); }}
                      disabled={isCan}
                      activeOpacity={0.85}
                    >
                      {isCan
                        ? <LoadingOverlay visible={true} inline size={22} />
                        : <>
                            <MaterialIcons name="close" size={20} color={COLORS.error} />
                            <Text style={[FONTS.labelLg, { color: COLORS.error }]}>Withdraw Interest</Text>
                          </>
                      }
                    </TouchableOpacity>
                  ) : isWithdrawn ? (
                    <View style={[styles.mapSheetAcceptButton, { flex: 1, backgroundColor: COLORS.surfaceContainer, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={[FONTS.labelLg, { color: COLORS.onSurfaceVariant }]}>Interest Withdrawn</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.mapSheetAcceptButton, { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }]}
                      onPress={() => { handleExpressInterest(ride.id); setDetailedScheduledRide(null); }}
                      disabled={isExp || !isDriverVerified}
                      activeOpacity={0.85}
                    >
                      {isExp
                        ? <LoadingOverlay visible={true} inline size={22} />
                        : <>
                            <MaterialIcons name="check-circle" size={20} color={COLORS.onPrimary} />
                            <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Express Interest</Text>
                          </>
                      }
                    </TouchableOpacity>
                  )}
                </View>

              </View>
            );
          })()}
        </View>
      </Modal>

      {/* Cancel Assignment Modal */}
      <Modal visible={cancelAssignmentModalVisible} transparent animationType="fade">
        <View style={styles.mapSheetOverlay}>
          <View style={[styles.mapSheetContainer, { paddingBottom: 32 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[FONTS.titleLg, { color: COLORS.onSurface }]}>Cancel Assignment</Text>
              <TouchableOpacity onPress={() => setCancelAssignmentModalVisible(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={24} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant }]}>
              Please provide a reason for cancelling this assignment. A flat fine will be deducted from your wallet as a penalty.
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: COLORS.surfaceContainerHigh,
                borderRadius: 12,
                padding: 12,
                minHeight: 80,
                textAlignVertical: 'top',
                backgroundColor: COLORS.surfaceContainerLowest,
                ...FONTS.bodyMd,
                color: COLORS.onSurface
              }}
              placeholder="e.g. Vehicle broke down"
              placeholderTextColor={COLORS.onSurfaceVariant}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.mapSheetAcceptButton, { flex: 1, backgroundColor: COLORS.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }]}
                onPress={() => setCancelAssignmentModalVisible(false)}
              >
                <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Go back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapSheetAcceptButton, { flex: 1, backgroundColor: COLORS.error, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', opacity: cancelReason.trim() ? 1 : 0.5 }]}
                onPress={handleCancelAssignmentSubmit}
                disabled={!cancelReason.trim()}
              >
                <Text style={[FONTS.labelLg, { color: COLORS.onError }]}>Confirm Fine</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  seats,
  distToPickup,
  from,
  to,
  distance,
  acceptLabel,
  onAccept,
  onCardPress,
  disabled,
  isAssigned,
  isInterested,
}: {
  name: string;
  rating: string;
  fare: string;
  seats: number;
  distToPickup: string | null;
  from: string;
  to: string;
  distance: string;
  acceptLabel: string;
  onAccept: () => void;
  onCardPress: () => void;
  disabled?: boolean;
  isAssigned?: boolean;
  isInterested?: boolean;
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
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {(isInterested || isAssigned) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="check-circle" size={16} color={isAssigned ? COLORS.primary : COLORS.tertiary} />
              <Text style={[FONTS.bodySm, { color: isAssigned ? COLORS.primary : COLORS.tertiary, fontWeight: '600' }]}>
                {isAssigned ? "Assigned" : "Interest Expressed"}
              </Text>
            </View>
          )}
          {distToPickup && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialIcons name="near-me" size={14} color={COLORS.primary} />
              <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>{distToPickup}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="people" size={14} color={COLORS.onSurfaceVariant} />
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>{seats}</Text>
          </View>
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
  premiumTabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 8,
  },
  premiumTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  premiumTabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  premiumTabLabel: {
    ...FONTS.labelMd,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600' as const,
  },
  premiumTabLabelActive: {
    color: COLORS.onPrimaryContainer,
    fontWeight: '800' as const,
  },
  premiumTabBadge: {
    position: 'absolute',
    top: 6,
    right: 28,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceContainerLowest,
  },
  premiumTabBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFF',
  },
  garageTabContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumEmptyGarage: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumEmptyGarageIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  premiumEmptyGarageTitle: {
    ...FONTS.headlineMd,
    color: COLORS.onSurface,
    fontWeight: '800' as const,
    marginBottom: 12,
  },
  premiumEmptyGarageSub: {
    ...FONTS.bodyMd,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  premiumGarageCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 100,
    gap: 12,
    ...AMBIENT_SHADOW,
  },
  premiumGarageCtaText: {
    ...FONTS.labelLg,
    color: '#FFF',
    fontWeight: '800' as const,
  },
  mapSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  mapSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  mapSheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
  },
  mapSheetHandleWrap: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  scheduledCompactDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  // ── Scheduled Map+List hybrid ──────────────────────
  scheduledMapPanel: {
    flex: 1.5,
    backgroundColor: COLORS.surfaceContainerLow,
    overflow: 'hidden', // Add hidden overflow if we want to clip map edges
  },
  scheduledMapBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    ...AMBIENT_SHADOW,
  },
  scheduledMapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  scheduledListPanel: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceContainerLow,
  },
  scheduledListHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceContainerLow,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  // Compact card in the list panel
  scheduledCompactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    position: 'relative',
  },
  scheduledCompactCardActive: {
    backgroundColor: 'rgba(0, 109, 54, 0.05)',
  },
  scheduledInterestDot: {
    position: 'absolute',
    left: 6,
    top: '50%',
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  scheduledCompactTime: {
    minWidth: 68,
    alignItems: 'flex-start',
  },
  scheduledCompactDivider: {
    width: 1,
    height: 34,
    backgroundColor: COLORS.surfaceContainerLow,
    marginHorizontal: 12,
  },
  scheduledCompactRoute: {
    flex: 1,
  },
  scheduledDotOrigin: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    flexShrink: 0,
  },
  scheduledDotDest: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.onSurfaceVariant,
    flexShrink: 0,
  },
  // Map pins
  scheduledMapPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.75,
    borderWidth: 2,
    borderColor: '#fff',
  },
  scheduledMapPinActive: {
    width: 32,
    height: 32,
    borderRadius: 16,
    opacity: 1,
    ...AMBIENT_SHADOW,
  },
  scheduledMapPinDest: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    ...AMBIENT_SHADOW,
  },
  scheduledMapPinStop: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderBottomRightRadius: 2,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
    transform: [{ rotate: '-45deg' }],
    ...AMBIENT_SHADOW,
  },
  scheduledMapPinStopText: {
    color: '#fff', 
    fontSize: 10, 
    fontWeight: 'bold',
    transform: [{ rotate: '45deg' }], // counter-rotate so text is upright
  },
});
