import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import { driverApi } from '../../core/api';
import { startDriverLocationTracking, stopDriverLocationTracking } from '../../core/locationSocket';
import { useGarageRideStore } from '../../core/garageRideStore';
import { useDriverRidesStore } from '../../core/driverRidesStore';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';
import locationData from '../locations.json';

const FILTERS = [
  { label: 'High Fare', icon: 'payments' as const },
  { label: 'Short Distance', icon: null },
  { label: 'Newest', icon: null },
  { label: 'More', icon: 'tune' as const },
];

const SEAT_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];

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

const formatDistance = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return `${num.toFixed(1)} km`;
};

export default function DriverRidesPage() {
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
  const [driverHasActiveRide, setDriverHasActiveRide] = useState(cachedHasActiveRide);
  const [activeFilter, setActiveFilter] = useState('High Fare');

  const [garageRide, setGarageRide] = useState<GarageRide | null>(cachedGarageRide);
  const [garagePassengers, setGaragePassengers] = useState<GaragePassenger[]>(cachedGaragePassengers);
  const [loadingGarage, setLoadingGarage] = useState(false);
  const [garageError, setGarageError] = useState<string | null>(null);
  const { setStatus } = useGarageRideStore();

  const [origin, setOrigin] = useState<LocationOption | null>(null);
  const [destination, setDestination] = useState<LocationOption | null>(null);
  const [farePerSeat, setFarePerSeat] = useState('');
  const [totalSeats, setTotalSeats] = useState(4);
  const [driverNote, setDriverNote] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState('');
  const [locationPickerOpen, setLocationPickerOpen] = useState<null | 'origin' | 'destination'>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [isCreatingRide, setIsCreatingRide] = useState(false);

  const errorHoldUntil = useRef<number>(0);
  const initialFetchDone = useRef(cachedRequests.length > 0);
  const isFetchingRequests = useRef(false);

  const filteredLocations = useMemo(() => filterLocations(locationQuery), [locationQuery]);

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
            setCachedHasActiveRide(data.driver_has_active_ride);
          } else {
            setDriverHasActiveRide(false);
            setCachedHasActiveRide(false);
          }
          setMarketplaceRequests(list as RideListItem[]);
          setCachedRequests(list as RideListItem[]);
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
  }, [requestsError]);

  const handleAcceptRide = async (rideId: string) => {
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
  };

  const handleToggleOnline = async () => {
    if (isUpdatingOnline || isOnline === null) return;
    if (isOnline && isOfflineBlocked) {
      setRequestsError('You cannot go offline while a ride is active.');
      errorHoldUntil.current = Date.now() + 8000;
      return;
    }
    const nextStatus = !isOnline;
    setIsUpdatingOnline(true);
    try {
      await driverApi.updateProfile({ is_online: nextStatus });
      setIsOnline(nextStatus);
      setCachedIsOnline(nextStatus);
      setRequestsError(null);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        try {
          await ensureDriverProfile();
          await driverApi.updateProfile({ is_online: nextStatus });
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

  const handleSelectLocation = (item: LocationOption) => {
    if (locationPickerOpen === 'origin') {
      setOrigin(item);
    } else if (locationPickerOpen === 'destination') {
      setDestination(item);
    }
    setLocationQuery('');
    setLocationPickerOpen(null);
  };

  const handleUseCurrentLocation = async () => {
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      if (!existing.granted) {
        const request = await Location.requestForegroundPermissionsAsync();
        if (!request.granted) {
          setGarageError('Location permission denied.');
          return;
        }
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setOrigin({
        id: 'current',
        label: 'Current location',
        description: 'Using your current location',
        latitude: Number(current.coords.latitude),
        longitude: Number(current.coords.longitude),
      });
    } catch (error: any) {
      setGarageError(error?.message || 'Unable to get current location.');
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

  const handleCreateGarageRide = async () => {
    if (!origin || !destination) {
      setGarageError('Select both origin and destination.');
      return;
    }
    if (!farePerSeat) {
      setGarageError('Enter fare per seat.');
      return;
    }

    setIsCreatingRide(true);
    setGarageError(null);

    try {
      await ensureDriverProfile();

      const payload: any = {
        origin_address: origin.label,
        origin_latitude: origin.latitude,
        origin_longitude: origin.longitude,
        destination_address: destination.label,
        destination_latitude: destination.latitude,
        destination_longitude: destination.longitude,
        vehicle_type: 'sedan',
        total_seats: totalSeats,
        fare_per_seat: Number(farePerSeat),
        driver_note: driverNote || null,
      };

      if (expiryMinutes) {
        const minutes = Number(expiryMinutes);
        if (!Number.isNaN(minutes) && minutes > 0) {
          const expires = new Date(Date.now() + minutes * 60000).toISOString();
          payload.expires_at = expires;
        }
      }

      const response = await driverApi.createGarageRide(payload);
      setGarageRide(response?.data || null);
      setGaragePassengers([]);
      setDriverMode('garage');
      setStatus('active');
      setCachedGarageRide(response?.data || null);
      setCachedGaragePassengers([]);
    } catch (error: any) {
      const data = error?.response?.data;
      const message = data?.error?.message || data?.detail || 'Unable to create garage ride.';
      setGarageError(message);
    } finally {
      setIsCreatingRide(false);
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
      await driverApi.completeGarageRide(garageRide.id);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.modeToggleWrap}>
        <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Driver Mode</Text>
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, driverMode === 'garage' && styles.modeTabActive]}
            onPress={() => setDriverMode('garage')}
          >
            <Text style={driverMode === 'garage' ? styles.modeTabTextActive : styles.modeTabText}>Garage</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, driverMode === 'ondemand' && styles.modeTabActive, modeLocked && styles.modeTabDisabled]}
            onPress={() => {
              if (!modeLocked) setDriverMode('ondemand');
            }}
            disabled={Boolean(modeLocked)}
          >
            <Text style={driverMode === 'ondemand' ? styles.modeTabTextActive : styles.modeTabText}>On-Demand</Text>
          </TouchableOpacity>
        </View>
        {modeLocked ? (
          <Text style={styles.modeHint}>Garage ride active — complete it before switching.</Text>
        ) : null}
      </View>

      {/* Online status */}
      <View style={styles.onlineStatusRow}>
        <View style={styles.onlineStatusLeft}>
          <View style={[styles.onlineStatusDot, { backgroundColor: isOnline ? COLORS.primaryContainer : COLORS.error }]} />
          <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}> {isOnline === null ? 'Loading…' : isOnline ? 'Online' : 'Offline'} </Text>
        </View>
        <Switch
          value={Boolean(isOnline)}
          onValueChange={handleToggleOnline}
          disabled={Boolean(isUpdatingOnline || isOnline === null || (isOnline && isOfflineBlocked))}
          trackColor={{ false: COLORS.surfaceContainerLow, true: COLORS.primaryContainer }}
          thumbColor={COLORS.surface}
        />
      </View>
      {isOnline && isOfflineBlocked ? (
        <Text style={styles.modeHint}>You cannot go offline while a ride is active.</Text>
      ) : null}

      {driverMode === 'garage' && (
        <View style={styles.sectionWrap}>
          {loadingGarage ? (
            <View style={[styles.card, AMBIENT_SHADOW]}>
              <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant }]}>Loading garage ride…</Text>
            </View>
          ) : garageRide ? (
            <View style={[styles.card, AMBIENT_SHADOW]}>
              <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>Active Garage Ride</Text>
              <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 4 }]}>Ref: {garageRide.reference}</Text>

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
          ) : (
            <View style={[styles.card, AMBIENT_SHADOW]}>
              <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>Create Garage Ride</Text>
              <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 4 }]}>Students scan to pay and board.</Text>

              <TouchableOpacity style={styles.inputRow} onPress={() => setLocationPickerOpen('origin')}>
                <MaterialIcons name="my-location" size={18} color={COLORS.outline} />
                <Text style={[FONTS.bodyMd, styles.inputValue]}>{origin?.label || 'Select origin'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.useCurrentBtn} onPress={handleUseCurrentLocation}>
                <MaterialIcons name="location-on" size={18} color={COLORS.primary} />
                <Text style={[FONTS.labelMd, { color: COLORS.primary }]}>Use current location</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.inputRow} onPress={() => setLocationPickerOpen('destination')}>
                <MaterialIcons name="place" size={18} color={COLORS.outline} />
                <Text style={[FONTS.bodyMd, styles.inputValue]}>{destination?.label || 'Select destination'}</Text>
              </TouchableOpacity>

              <View style={styles.inputRow}>
                <MaterialIcons name="payments" size={18} color={COLORS.outline} />
                <TextInput
                  style={[FONTS.bodyMd, styles.textInput]}
                  placeholder="Fare per seat (₦)"
                  keyboardType="numeric"
                  value={farePerSeat}
                  onChangeText={setFarePerSeat}
                />
              </View>

              <View style={styles.inputRow}>
                <MaterialIcons name="groups" size={18} color={COLORS.outline} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seatRow}>
                  {SEAT_OPTIONS.map((count) => (
                    <TouchableOpacity
                      key={count}
                      style={[styles.seatChip, totalSeats === count && styles.seatChipActive]}
                      onPress={() => setTotalSeats(count)}
                    >
                      <Text style={totalSeats === count ? styles.seatChipTextActive : styles.seatChipText}>{count} seats</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputRow}>
                <MaterialIcons name="note" size={18} color={COLORS.outline} />
                <TextInput
                  style={[FONTS.bodyMd, styles.textInput]}
                  placeholder="Driver note (optional)"
                  value={driverNote}
                  onChangeText={setDriverNote}
                />
              </View>

              <View style={styles.inputRow}>
                <MaterialIcons name="timer" size={18} color={COLORS.outline} />
                <TextInput
                  style={[FONTS.bodyMd, styles.textInput]}
                  placeholder="Expiry minutes (optional)"
                  keyboardType="numeric"
                  value={expiryMinutes}
                  onChangeText={setExpiryMinutes}
                />
              </View>

              {garageError ? <Text style={styles.errorText}>{garageError}</Text> : null}

              <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateGarageRide} disabled={isCreatingRide}>
                {isCreatingRide ? (
                  <ActivityIndicator size="small" color={COLORS.onPrimary} />
                ) : (
                  <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Create Garage Ride</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {driverMode === 'ondemand' && (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={[FONTS.labelLg, { color: COLORS.onSurfaceVariant }]}>Active Request</Text>
            <View style={styles.liveBadge}>
              <Text style={[FONTS.labelMd, { color: COLORS.onSurface }]}>{marketplaceRequests.length} Live</Text>
            </View>
          </View>

          {loadingRequests && (
            <View style={[styles.card, AMBIENT_SHADOW]}>
              <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant }]}>Loading active requests...</Text>
            </View>
          )}
          {!loadingRequests && requestsError && (
            <View style={[styles.card, AMBIENT_SHADOW]}>
              <Text style={[FONTS.bodyMd, { color: COLORS.error }]}>{requestsError}</Text>
            </View>
          )}
          {!loadingRequests && !requestsError && marketplaceRequests.length === 0 && (
            <View style={[styles.card, AMBIENT_SHADOW]}>
              <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant }]}>No active requests right now.</Text>
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
                  disabled={Boolean(acceptingRideId === ride.id || driverHasActiveRide || modeLocked)}
                />
              );
            })}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
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
                <Text style={[FONTS.labelMd, { color: activeFilter === f.label ? COLORS.primary : COLORS.onSurface }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <Modal visible={Boolean(locationPickerOpen)} animationType="slide" onRequestClose={() => setLocationPickerOpen(null)}>
        <View style={styles.modalPage}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setLocationPickerOpen(null)} style={styles.modalBack}>
              <MaterialIcons name="close" size={20} color={COLORS.onSurface} />
            </TouchableOpacity>
            <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Select location</Text>
            <View style={styles.modalSpacer} />
          </View>

          <View style={styles.modalSearch}>
            <MaterialIcons name="search" size={18} color={COLORS.onSurfaceVariant} />
            <TextInput
              style={styles.modalInput}
              placeholder="Search locations"
              value={locationQuery}
              onChangeText={setLocationQuery}
            />
          </View>

          <ScrollView contentContainerStyle={styles.modalList}>
            {filteredLocations.map((item) => (
              <TouchableOpacity key={item.id} style={styles.modalItem} onPress={() => handleSelectLocation(item)}>
                <MaterialIcons name="place" size={18} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[FONTS.labelMd, { color: COLORS.onSurface }]}>{item.label}</Text>
                  <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant }]}>{item.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ─── Request Card Sub-component ─── */
function RequestCard({
  name,
  rating,
  fare,
  passengers,
  from,
  to,
  distance,
  acceptLabel,
  onAccept,
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
  disabled?: boolean;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <View style={[styles.requestCard, AMBIENT_SHADOW]}>
      <View style={styles.requestTop}>
        <View style={styles.requestUser}>
          <View style={styles.avatar}>
            <Text style={[FONTS.headlineMd, { color: COLORS.onSurfaceVariant }]}>{initials}</Text>
          </View>
          <View>
            <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>{name}</Text>
            <View style={styles.ratingRow}>
              <MaterialIcons name="star" size={14} color={COLORS.onSurfaceVariant} />
              <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>{rating}</Text>
            </View>
          </View>
        </View>
        <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>{fare}</Text>
      </View>

      <View style={styles.routeWrap}>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <View style={styles.pickupDot} />
          <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]} numberOfLines={1}>
            {from}
          </Text>
        </View>
        <View style={styles.routePoint}>
          <View style={styles.dropoffDot} />
          <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]} numberOfLines={1}>
            {to}
          </Text>
        </View>
      </View>

      <View style={styles.requestMeta}>
        <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>{passengers}</Text>
        <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>{distance}</Text>
      </View>

      <TouchableOpacity style={[styles.acceptBtn, disabled && styles.acceptBtnDisabled]} onPress={onAccept} disabled={disabled}>
        <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}> {acceptLabel} </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  modeToggleWrap: {
    marginBottom: 12,
    gap: 8,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLow,
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
  onlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
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
  errorText: {
    color: COLORS.error,
    fontWeight: '600',
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
    backgroundColor: 'rgba(94, 53, 177, 0.08)',
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
    backgroundColor: COLORS.error,
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
});
