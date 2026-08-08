import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';

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

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

export type ActiveRideScreenProps = {
  // On-Demand props
  activeOnDemandRide?: any | null;
  onAdvanceRide?: (rideId: string) => Promise<void>;
  advancingRideId?: string | null;
  
  // Garage props
  garageRide?: any | null;
  garagePassengers?: any[];
  onDepartGarage?: () => Promise<void>;
  onCompleteGarage?: () => Promise<void>;
  onCancelGarage?: () => Promise<void>;

  // Shared
  errorMessage?: string | null;
};

export default function ActiveRideScreen({
  activeOnDemandRide,
  onAdvanceRide,
  advancingRideId,
  garageRide,
  garagePassengers, // Kept in props but not used in UI based on design request
  onDepartGarage,
  onCompleteGarage,
  onCancelGarage,
  errorMessage,
}: ActiveRideScreenProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  
  const [driverLocation, setDriverLocation] = useState<MapCoordinate | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true); // Default open to show telemetry
  const [hasInitialFitted, setHasInitialFitted] = useState(false);

  // Telemetry state
  const [currentSpeed, setCurrentSpeed] = useState<number>(0); // km/h
  const [distanceLeft, setDistanceLeft] = useState<number>(0); // km
  const [etaMins, setEtaMins] = useState<number>(0); // mins

  const ride = activeOnDemandRide || garageRide;
  const isGarage = !!garageRide;
  
  // Track previous locations for manual speed calculation if needed
  const locationHistoryRef = useRef<{lat: number, lon: number, time: number}[]>([]);

  const routeCoordinates = useMemo(() => {
    if (!ride) return [];
    if (Array.isArray(ride.estimated_route_geometry)) {
      return ride.estimated_route_geometry
        .map((p: any) => parseMapCoordinate(p.latitude, p.longitude))
        .filter(Boolean) as MapCoordinate[];
    }
    return [];
  }, [ride]);

  const originCoord = useMemo(() => {
    if (!ride) return null;
    return parseMapCoordinate(
      isGarage ? ride.origin_latitude : ride.pickup_latitude,
      isGarage ? ride.origin_longitude : ride.pickup_longitude
    );
  }, [ride, isGarage]);

  const destCoord = useMemo(() => {
    if (!ride) return null;
    return parseMapCoordinate(
      isGarage ? ride.destination_latitude : ride.dropoff_latitude,
      isGarage ? ride.destination_longitude : ride.dropoff_longitude
    );
  }, [ride, isGarage]);

  // Determine next objective based on current status
  const nextObjectiveCoords = useMemo(() => {
    if (!ride) return null;
    if (isGarage) {
      if (ride.status === 'open' || ride.status === 'full') return originCoord; // Still at pickup
      return destCoord; // En route to dropoff
    } else {
      if (ride.status === 'accepted' || ride.status === 'arrived') return originCoord; // Going to pickup
      return destCoord; // Going to dropoff
    }
  }, [ride, isGarage, originCoord, destCoord]);

  // Live driver location tracking & Telemetry
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest, // Highest accuracy for driving telemetry
            distanceInterval: 5, // Update every 5 meters
            timeInterval: 2000, // Or every 2 seconds
          },
          (loc) => {
            if (!isMounted) return;
            
            const currentLat = loc.coords.latitude;
            const currentLon = loc.coords.longitude;
            const currentTime = loc.timestamp;

            setDriverLocation({ latitude: currentLat, longitude: currentLon });

            // 1. Calculate Speed
            let speedKmh = 0;
            if (loc.coords.speed !== null && loc.coords.speed > 0) {
              // Location API natively provides speed in m/s
              speedKmh = loc.coords.speed * 3.6;
            } else {
              // Manual fallback calculation using sliding window
              const history = locationHistoryRef.current;
              history.push({ lat: currentLat, lon: currentLon, time: currentTime });
              if (history.length > 3) history.shift();

              if (history.length >= 2) {
                const oldest = history[0];
                const newest = history[history.length - 1];
                const distKm = haversineDistance(oldest.lat, oldest.lon, newest.lat, newest.lon);
                const timeHrs = (newest.time - oldest.time) / (1000 * 60 * 60);
                if (timeHrs > 0) {
                  speedKmh = distKm / timeHrs;
                }
              }
            }
            setCurrentSpeed(Math.max(0, speedKmh));

            // 2. Calculate Distance Left
            if (nextObjectiveCoords) {
              const distToObj = haversineDistance(
                currentLat,
                currentLon,
                nextObjectiveCoords.latitude,
                nextObjectiveCoords.longitude
              );
              setDistanceLeft(distToObj);
              
              // 3. Calculate ETA
              let estimatedMins = 0;
              if (distToObj < 0.05) {
                 estimatedMins = 0; // Less than 50 meters
              } else {
                 const assumedAvgSpeedKmh = speedKmh > 5 ? speedKmh : 30; // Fallback to 30km/h if stopped/slow
                 estimatedMins = (distToObj / assumedAvgSpeedKmh) * 60;
              }
              setEtaMins(Math.max(0, estimatedMins));
            }
          }
        );
      } catch (err) {
        console.warn('Driver location tracking error:', err);
      }
    })();
    
    return () => {
      isMounted = false;
      sub?.remove();
    };
  }, [nextObjectiveCoords]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !originCoord || !destCoord || hasInitialFitted) return;
    
    const coordsToFit = [...routeCoordinates];
    if (coordsToFit.length === 0) {
      coordsToFit.push(originCoord, destCoord);
    }
    
    if (driverLocation) {
      coordsToFit.push(driverLocation);
    }

    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordsToFit, {
        edgePadding: { top: insets.top + 100, right: 60, bottom: isExpanded ? 450 : 300, left: 60 },
        animated: true,
      });
      setHasInitialFitted(true);
    }, 500);
  }, [mapReady, originCoord, destCoord, routeCoordinates, hasInitialFitted, driverLocation, isExpanded, insets.top]);

  // Handle follow driver location
  useEffect(() => {
    if (mapReady && mapRef.current && driverLocation && hasInitialFitted) {
      mapRef.current.animateCamera({
        center: driverLocation,
        heading: undefined,
        pitch: undefined,
      }, { duration: 1000 });
    }
  }, [driverLocation, mapReady, hasInitialFitted]);


  if (!ride) return null;

  const handleCallStudent = () => {
    const phone = ride?.student?.phone_number;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleNavigate = () => {
    if (nextObjectiveCoords) {
      const { latitude, longitude } = nextObjectiveCoords;
      const url = Platform.select({
        ios: `maps:0,0?q=${latitude},${longitude}`,
        android: `geo:0,0?q=${latitude},${longitude}`
      });
      if (url) Linking.openURL(url);
    }
  };

  // Status Stepper Data
  const getTimelineSteps = () => {
    if (isGarage) {
      const s = ride.status;
      return [
        { label: 'Boarding', active: s === 'open' || s === 'full', completed: s === 'departed' || s === 'completed' },
        { label: 'En Route', active: s === 'departed', completed: s === 'completed' },
      ];
    } else {
      const s = ride.status;
      return [
        { label: 'Heading', active: s === 'driver_assigned' || s === 'driver_en_route', completed: s === 'driver_arrived' || s === 'in_progress' || s === 'pending_completion' || s === 'completed' },
        { label: 'Arrived', active: s === 'driver_arrived', completed: s === 'in_progress' || s === 'pending_completion' || s === 'completed' },
        { label: 'In Progress', active: s === 'in_progress', completed: s === 'pending_completion' || s === 'completed' },
      ];
    }
  };
  const timelineSteps = getTimelineSteps();

  const isAdvancing = advancingRideId === ride.id;
  const isPendingCompletion = !isGarage && ride.status === 'pending_completion';

  // Action Button Configuration
  let buttonLabel = 'Advance Status';
  let buttonAction = () => { if (onAdvanceRide) onAdvanceRide(ride.id); };
  let buttonColor = COLORS.primary;

  if (isGarage) {
    if (ride.status === 'departed') {
      buttonLabel = 'Complete Trip';
      buttonAction = () => { if (onCompleteGarage) onCompleteGarage(); };
      buttonColor = '#2E7D32'; // Green
    } else {
      buttonLabel = 'Depart Garage';
      buttonAction = () => { if (onDepartGarage) onDepartGarage(); };
    }
  } else {
    // Map driver actions based on current status
    if (ride.status === 'driver_assigned' || ride.status === 'driver_en_route') buttonLabel = 'Confirm Arrival';
    else if (ride.status === 'driver_arrived') buttonLabel = 'Start Trip';
    else if (ride.status === 'in_progress') buttonLabel = 'Complete Trip';
    else if (ride.status === 'pending_completion') {
      buttonLabel = 'Awaiting Student...';
      buttonColor = COLORS.surfaceVariant;
    }
  }

  if (isAdvancing) {
    buttonLabel = 'Processing...';
    buttonColor = COLORS.surfaceVariant;
  }

  return (
    <View style={styles.container}>
      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={false} 
        showsCompass={false}
        showsScale={false}
        showsMyLocationButton={false}
        loadingEnabled
        loadingIndicatorColor={COLORS.primary}
        loadingBackgroundColor={COLORS.surfaceContainerLowest}
      >
        {originCoord && (
          <Marker coordinate={originCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.mapMarkerDot, { backgroundColor: '#2E7D32' }]} />
          </Marker>
        )}
        {destCoord && (
          <Marker coordinate={destCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.mapMarkerDot, { backgroundColor: COLORS.error }]} />
          </Marker>
        )}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={COLORS.primary}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }} zIndex={100}>
            <View style={styles.driverMarkerHalo}>
              <View style={styles.driverMarkerCore}>
                <MaterialIcons name="navigation" size={14} color="#FFF" style={{ transform: [{ rotate: '45deg' }] }} />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── Floating Secondary Actions (Top Right) ── */}
      <View style={[styles.floatingActions, { top: insets.top + 16 }]}>
        <TouchableOpacity style={styles.floatingActionBtn} onPress={handleNavigate} activeOpacity={0.8}>
          <MaterialIcons name="navigation" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        
        {!isGarage && (
          <TouchableOpacity style={[styles.floatingActionBtn, { marginTop: 12 }]} onPress={handleCallStudent} activeOpacity={0.8}>
            <MaterialIcons name="call" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Telemetry Bottom Sheet ── */}
      <View style={[styles.bottomSheet, AMBIENT_SHADOW, { paddingBottom: Math.max(insets.bottom, 16) + 70 }]}>
        <View style={styles.sheetHandleWrap}>
          <TouchableOpacity 
            style={{ width: '100%', alignItems: 'center', paddingVertical: 12 }} 
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={1}
          >
            <View style={styles.sheetHandle} />
          </TouchableOpacity>
        </View>

        <View style={styles.sheetContent}>
          {/* Top Telemetry Row */}
          <View style={styles.telemetryRow}>
            <View style={styles.telemetryCard}>
              <Text style={styles.telemetryValue}>{currentSpeed.toFixed(0)}</Text>
              <Text style={styles.telemetryLabel}>km/h</Text>
            </View>
            <View style={styles.telemetryDivider} />
            <View style={styles.telemetryCard}>
              <Text style={styles.telemetryValue}>{distanceLeft.toFixed(1)}</Text>
              <Text style={styles.telemetryLabel}>km left</Text>
            </View>
            <View style={styles.telemetryDivider} />
            <View style={styles.telemetryCard}>
              <Text style={styles.telemetryValue}>{Math.ceil(etaMins)}</Text>
              <Text style={styles.telemetryLabel}>min ETA</Text>
            </View>
          </View>

          {/* Horizontal Timeline Stepper */}
          {isExpanded && (
            <View style={styles.timelineContainer}>
              {timelineSteps.map((step, index) => {
                const isLast = index === timelineSteps.length - 1;
                return (
                  <View key={index} style={styles.timelineStepContainer}>
                    <View style={styles.timelineNodeRow}>
                      <View style={[
                        styles.timelineNode,
                        step.completed ? { backgroundColor: '#2E7D32', borderColor: '#2E7D32' } :
                        step.active ? { backgroundColor: COLORS.primaryContainer, borderColor: COLORS.primary, borderWidth: 3 } :
                        { backgroundColor: COLORS.surfaceContainerHighest, borderColor: COLORS.outlineVariant }
                      ]}>
                        {step.completed && <MaterialIcons name="check" size={12} color="#FFF" />}
                      </View>
                      {!isLast && (
                        <View style={[
                          styles.timelineTrack,
                          { backgroundColor: step.completed ? '#2E7D32' : COLORS.surfaceVariant }
                        ]} />
                      )}
                    </View>
                    <Text style={[
                      styles.timelineText,
                      step.active && { color: COLORS.onSurface, fontWeight: '700' as const },
                      !step.active && !step.completed && { color: COLORS.onSurfaceVariant },
                      step.completed && { color: '#2E7D32' }
                    ]} numberOfLines={1}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          {/* Primary Action Button (No Spinners) */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: buttonColor, opacity: isAdvancing ? 0.7 : 1 }]}
            onPress={buttonAction}
            disabled={isAdvancing || isPendingCompletion}
            activeOpacity={0.8}
          >
            <Text style={[
              FONTS.labelLg, 
              { color: (isPendingCompletion || isAdvancing) ? COLORS.onSurfaceVariant : '#FFF' }
            ]}>
              {buttonLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  driverMarkerHalo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(21, 101, 192, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarkerCore: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1565C0',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingActions: {
    position: 'absolute',
    right: 20,
    alignItems: 'center',
  },
  floatingActionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...AMBIENT_SHADOW,
    elevation: 5,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
  },
  sheetHandleWrap: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: COLORS.surface,
  },
  sheetHandle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.outlineVariant,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  telemetryCard: {
    alignItems: 'center',
    flex: 1,
  },
  telemetryValue: {
    ...FONTS.headlineXl,
    color: COLORS.onSurface,
  },
  telemetryLabel: {
    ...FONTS.labelMd,
    color: COLORS.onSurfaceVariant,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  telemetryDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.surfaceVariant,
  },
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  timelineStepContainer: {
    flex: 1,
    alignItems: 'center',
  },
  timelineNodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  timelineNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    alignSelf: 'center',
  },
  timelineTrack: {
    flex: 1,
    height: 3,
    marginLeft: -12, // Pull under node
    marginRight: -12,
    zIndex: 1,
  },
  timelineText: {
    ...FONTS.labelMd,
    textAlign: 'center',
  },
  primaryBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...FONTS.bodySm,
    color: COLORS.error,
    marginBottom: 16,
    textAlign: 'center',
  },
});
