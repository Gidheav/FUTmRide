import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, FONTS } from '../../core/theme';
import { driverApi, driverWalletApi } from '../../core/api';
import { useAuthStore } from '../../core/authStore';
import { useGarageRideStore } from '../../core/garageRideStore';
import { useDriverRidesStore } from '../../core/driverRidesStore';
import {
  getDriverActivityState,
  getActivityDisplay,
  canCreateGarageRide,
  canGoOnline,
  DriverActivityState,
} from '../../core/driverActivity';
import LoadingOverlay from '../components/LoadingOverlay';
import { AMBIENT_SHADOW } from '../../core/theme';

const ACTIVE_GARAGE_STATUSES = new Set(['open', 'full', 'departed']);

const TOOL_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  android: {
    elevation: 6,
  },
});

const toNumber = (value: any) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getGoalProgress = (summary: any) => {
  if (summary?.daily_goal?.progress_percent != null) {
    return Math.min(100, Math.max(0, Number(summary.daily_goal.progress_percent)));
  }
  const target = toNumber(summary?.daily_goal?.target ?? summary?.daily_goal_target);
  const earned = toNumber(
    summary?.daily_goal?.earned ??
      summary?.today_earnings ??
      summary?.today_revenue ??
      summary?.earnings_today
  );
  if (target <= 0) return 0;
  return Math.min(100, Math.round((earned / target) * 100));
};

const formatCompactDistance = (value: any) => {
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance <= 0) return '-- km';
  return `${distance >= 10 ? distance.toFixed(0) : distance.toFixed(1)} km`;
};

const formatElapsed = (startedAt: any, now: number) => {
  if (!startedAt) return '--';
  const startedMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedMs)) return '--';
  const diffMins = Math.max(0, Math.floor((now - startedMs) / 60000));
  if (diffMins < 60) return `${diffMins}m`;
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins ? `${hrs}h ${mins}m` : `${hrs}h`;
};

const getRideRouteCoords = (sourceRide: any) => {
  if (!sourceRide) return [];

  if (Array.isArray(sourceRide.estimated_route_geometry) && sourceRide.estimated_route_geometry.length > 0) {
    return sourceRide.estimated_route_geometry
      .map((point: any) => ({
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
      }))
      .filter((point: any) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  }

  const oLat = Number(sourceRide.origin_latitude || sourceRide.pickup_latitude);
  const oLng = Number(sourceRide.origin_longitude || sourceRide.pickup_longitude);
  const dLat = Number(sourceRide.destination_latitude || sourceRide.dropoff_latitude);
  const dLng = Number(sourceRide.destination_longitude || sourceRide.dropoff_longitude);

  if (oLat && oLng && dLat && dLng) {
    return [
      { latitude: oLat, longitude: oLng },
      { latitude: dLat, longitude: dLng },
    ];
  }

  return [];
};

// ── Visual mode for the dashboard mode-switch tool ──
// This is the mode the driver WANTS to be in. It only applies when the state is IDLE.
type VisualMode = 'ondemand' | 'garage' | 'scheduled';

const MODE_CYCLE: VisualMode[] = ['garage', 'scheduled'];
const MODE_META: Record<VisualMode, { icon: any; label: string; color: string }> = {
  ondemand: { icon: 'bolt', label: 'On-Demand', color: '#2E7D32' },
  garage: { icon: 'directions-car', label: 'Garage', color: '#E65100' },
  scheduled: { icon: 'event-note', label: 'Scheduled', color: '#6A1B9A' },
};

const DRIVER_VERIFICATION_MESSAGE = 'Your driver account must be verified before you can accept rides, create garage rides, or join scheduled rides.';

const DashboardScreen = ({ onCreateGarageRide, onNavigateToRide }: { onCreateGarageRide?: () => void; onNavigateToRide?: () => void }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const { status, setStatus } = useGarageRideStore();
  const { user } = useAuthStore();
  const isDriverVerified = Boolean(user?.is_verified);
  const {
    isOnline,
    setIsOnline: setCachedIsOnline,
    driverHasActiveRide,
    garageRide: storeGarageRide,
    offlineMode,
    setOfflineMode,
  } = useDriverRidesStore();

  const [walletSummary, setWalletSummary] = useState<any>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [activeOnDemandRide, setActiveOnDemandRide] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingOnline, setIsUpdatingOnline] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const handleToggleOnline = useCallback(async () => {
    if (isUpdatingOnline || isOnline === null) return;
    const activityState = getDriverActivityState(isOnline, storeGarageRide, driverHasActiveRide);
    if (!isOnline) {
      if (!isDriverVerified) {
        Alert.alert('Verification Required', DRIVER_VERIFICATION_MESSAGE);
        return;
      }
      const guard = canGoOnline(activityState);
      if (!guard.allowed) {
        Alert.alert('Action Blocked', `${guard.reason}\n\n${guard.suggestion}`);
        return;
      }
    }
    const nextStatus = !isOnline;
    setIsUpdatingOnline(true);
    try {
      await driverApi.updateAvailability({ is_online: nextStatus });
      setCachedIsOnline(nextStatus);
    } catch {
      // silently fail — state stays in sync via store
    } finally {
      setIsUpdatingOnline(false);
    }
  }, [isUpdatingOnline, isOnline, isDriverVerified, storeGarageRide, driverHasActiveRide]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const toggleSheet = () => {
    setIsSheetExpanded((prev) => !prev);
  };

  // ── Derive the REAL activity state from existing stores ──
  const activityState: DriverActivityState = useMemo(
    () => getDriverActivityState(isOnline, storeGarageRide, driverHasActiveRide),
    [isOnline, storeGarageRide, driverHasActiveRide],
  );
  const activityDisplay = useMemo(() => getActivityDisplay(activityState), [activityState]);

  // State is "locked" if the driver is in any non-IDLE state.
  // When locked, the mode switcher is hidden — the status pill shows the current forced state.
  const isLocked = activityState !== 'IDLE';
  const hasActiveRideContent = ['ON_DEMAND_ACTIVE', 'GARAGE_SESSION', 'GARAGE_DEPARTED'].includes(activityState);

  // ── Data fetching (unchanged from the old DashboardScreen) ──
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

      let activeOnDemand = null;
      if (driverHasActiveRide) {
        try {
          const activeRes = await driverApi.getActiveRide();
          activeOnDemand = activeRes.data;
          setActiveOnDemandRide(activeOnDemand);
        } catch (err: any) {
          if (err?.response?.status === 404) {
            setActiveOnDemandRide(null);
          }
        }
      } else {
        setActiveOnDemandRide(null);
      }

      return { activeGarageRide: active || null, activeOnDemandRide: activeOnDemand };
    } catch {
      setStatus('inactive');
      setActiveRide(null);
      setActiveOnDemandRide(null);
      setWalletSummary(null);
      return { activeGarageRide: null, activeOnDemandRide: null };
    }
  };

  const centerOnDriver = async () => {
    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        1000,
      );
    } catch (err) {
      console.log('Location error:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await fetchDashboardData();
      const refreshedRouteCoords = getRideRouteCoords(
        refreshed.activeOnDemandRide || refreshed.activeGarageRide,
      );

      if (refreshedRouteCoords.length >= 2) {
        hasFittedRoute.current = null;
        mapRef.current?.fitToCoordinates(refreshedRouteCoords, {
          edgePadding: { top: 80, right: 80, bottom: 350, left: 80 },
          animated: true,
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Mode cycling — only between 'garage' and 'scheduled' when OFFLINE/IDLE ──
  const cycleMode = () => {
    if (isLocked) return;
    const next = offlineMode === 'garage' ? 'scheduled' : 'garage';
    setOfflineMode(next);
  };

  // Determine current icon: online forces ondemand icon; offline uses offlineMode
  const currentModeIcon = isLocked
    ? activityDisplay.icon
    : isOnline
      ? MODE_META.ondemand
      : MODE_META[offlineMode];

  // ── Garage ride creation with guard ──
  const handleGaragePress = () => {
    if (!isDriverVerified) {
      Alert.alert('Verification Required', DRIVER_VERIFICATION_MESSAGE);
      return;
    }
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

  // ── Computed values ──
  const goalProgress = useMemo(() => getGoalProgress(walletSummary), [walletSummary]);
  const goalColor = goalProgress >= 100 ? '#4CAF50' : goalProgress >= 50 ? COLORS.primary : '#FF9800';

  // Determine if the mode icon represents an action state vs display only
  const currentModeMeta = isLocked
    ? { icon: activityDisplay.icon, label: activityDisplay.label, color: activityDisplay.color }
    : isOnline
      ? MODE_META.ondemand           // While online, always show on-demand — not switchable
      : MODE_META[offlineMode];      // While offline, show the current offline mode

  const activeHeaderMetrics = useMemo(() => {
    let sourceRide = null;
    let isGarage = false;

    if (activityState === 'ON_DEMAND_ACTIVE') {
      sourceRide = activeOnDemandRide;
    } else if (activityState === 'GARAGE_SESSION' || activityState === 'GARAGE_DEPARTED') {
      sourceRide = activeRide || storeGarageRide;
      isGarage = true;
    }

    if (!sourceRide) return null;

    const distance = isGarage
      ? sourceRide.estimated_distance_km
      : (sourceRide.actual_distance_km || sourceRide.estimated_distance_km);
    const startedAt = isGarage
      ? sourceRide.created_at
      : (sourceRide.requested_at || sourceRide.driver_assigned_at || sourceRide.trip_started_at);

    return {
      distance: formatCompactDistance(distance),
      elapsed: formatElapsed(startedAt, currentTime),
    };
  }, [activeRide, activeOnDemandRide, activityState, currentTime, storeGarageRide]);

  const routeCoords = useMemo(() => {
    let sourceRide = null;

    if (activityState === 'ON_DEMAND_ACTIVE') {
      sourceRide = activeOnDemandRide;
    } else if (activityState === 'GARAGE_SESSION' || activityState === 'GARAGE_DEPARTED') {
      sourceRide = activeRide || storeGarageRide;
    }

    if (!sourceRide) return [];
    return getRideRouteCoords(sourceRide);
  }, [activeRide, activeOnDemandRide, activityState, storeGarageRide]);

  const hasFittedRoute = useRef<string | null>(null);

  // ── Auto-center map on route or driver ──
  useEffect(() => {
    const currentRideId = activeOnDemandRide?.id || activeRide?.id || storeGarageRide?.id;
    
    if (isLocked && routeCoords.length > 0 && mapRef.current) {
      if (hasFittedRoute.current !== currentRideId) {
        hasFittedRoute.current = currentRideId;
        const timer = setTimeout(() => {
          mapRef.current?.fitToCoordinates(routeCoords, {
            edgePadding: { top: 80, right: 80, bottom: 350, left: 80 },
            animated: true,
          });
        }, 500);
        return () => clearTimeout(timer);
      }
    } else if (!isLocked) {
      if (hasFittedRoute.current !== null) {
        hasFittedRoute.current = null;
        centerOnDriver();
      }
    }
  }, [isLocked, routeCoords, activeOnDemandRide?.id, activeRide?.id, storeGarageRide?.id]);


  const renderActiveRideDetails = () => {
    let sourceRide = null;
    let isGarage = false;

    if (activityState === 'ON_DEMAND_ACTIVE') {
      sourceRide = activeOnDemandRide;
    } else if (activityState === 'GARAGE_SESSION' || activityState === 'GARAGE_DEPARTED') {
      sourceRide = activeRide || storeGarageRide;
      isGarage = true;
    }

    if (!sourceRide) return null;

    const origin = isGarage ? sourceRide.origin_address : sourceRide.pickup_address;
    const destination = isGarage ? sourceRide.destination_address : sourceRide.dropoff_address;
    
    return (
      <View style={styles.sheetDetailsContainer}>
        <View style={styles.sheetLocationContainer}>
          <View style={styles.sheetLocationRow}>
            <View style={styles.sheetRouteIcon}>
              <MaterialIcons name="my-location" size={14} color={COLORS.primary} />
            </View>
            <Text style={styles.sheetLocationText} numberOfLines={1}>{origin || 'Current Location'}</Text>
          </View>
          <View style={styles.sheetLocationDot} />
          <View style={styles.sheetLocationRow}>
            <View style={[styles.sheetRouteIcon, styles.sheetRouteIconEnd]}>
              <MaterialIcons name="location-on" size={14} color={COLORS.error ?? '#B00020'} />
            </View>
            <Text style={styles.sheetLocationText} numberOfLines={1}>{destination || 'Destination'}</Text>
          </View>
        </View>
        {(isGarage ? onCreateGarageRide : onNavigateToRide) && (
          <TouchableOpacity
            style={styles.sheetPrimaryButton}
            onPress={isGarage ? onCreateGarageRide : onNavigateToRide}
          >
            <Text style={styles.sheetPrimaryButtonText}>{isGarage ? 'View Ride' : 'Go to Ride'}</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ─── Full-Screen Unrestricted Map ─── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        initialRegion={{
          latitude: 9.6139,
          longitude: 6.5569,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {/* Render active ride route if there are coordinates */}
        {routeCoords.length >= 2 && (
          <>
            <Marker coordinate={routeCoords[0]} pinColor={COLORS.primary} title="Origin" />
            <Marker coordinate={routeCoords[routeCoords.length - 1]} pinColor={COLORS.error ?? '#B00020'} title="Destination" />
            <Polyline
              coordinates={routeCoords}
              strokeColor={COLORS.primary}
              strokeWidth={4}
              geodesic
            />
          </>
        )}
      </MapView>

      {/* ─── Status Pill + Online Toggle (Top-Left) ─── */}
      <View style={{ position: 'absolute', left: 16, top: insets.top + 16, zIndex: 10 }}>
        {/* Online / Offline toggle pill */}
        <TouchableOpacity
          onPress={handleToggleOnline}
          disabled={isUpdatingOnline || isOnline === null}
          activeOpacity={0.85}
          style={[
            styles.onlineTogglePill,
            isOnline ? styles.onlineTogglePillOnline : styles.onlineTogglePillOffline,
            (isUpdatingOnline || isOnline === null) && { opacity: 0.5 },
          ]}
        >
          {isUpdatingOnline || isOnline === null ? (
            <ActivityIndicator size="small" color={isOnline ? '#FFF' : COLORS.primary} />
          ) : (
            <View style={[styles.onlineToggleDot, { backgroundColor: isOnline ? '#FFF' : COLORS.primary }]} />
          )}
          <Text style={[styles.onlineToggleText, { color: isOnline ? '#FFF' : COLORS.onSurface }]}>
            {isUpdatingOnline ? 'Updating...' : isOnline ? 'Online' : 'Offline'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── Right-Side Vertical Toolbar ─── */}
      <View style={[styles.toolbarContainer, { top: insets.top + 16 }]}>

        {/* 1. Daily Goal Progress Ring */}
        <TouchableOpacity style={styles.toolIcon} activeOpacity={0.8}>
          <View style={[styles.goalRing, { borderColor: goalColor }]}>
            <Text style={[styles.goalText, { color: goalColor }]}>{goalProgress}%</Text>
          </View>
        </TouchableOpacity>

        {/* 2. GPS Center */}
        <TouchableOpacity style={styles.toolIcon} onPress={centerOnDriver} activeOpacity={0.8}>
          <MaterialIcons name="my-location" size={22} color={COLORS.onSurfaceVariant} />
        </TouchableOpacity>

        {/* 3. Refresh */}
        <TouchableOpacity
          style={styles.toolIcon}
          onPress={handleRefresh}
          disabled={isRefreshing}
          activeOpacity={0.8}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <MaterialIcons name="refresh" size={22} color={COLORS.onSurfaceVariant} />
          )}
        </TouchableOpacity>

        {/* 4. Mode Switcher
            - Online: shows on-demand icon but is NOT tappable (mode is implicit)
            - Offline + unlocked: cycles between garage / scheduled
            - Active ride / garage session: dimmed, not tappable */}
        <TouchableOpacity
          style={[styles.toolIcon, (isLocked || isOnline === true) && { opacity: 0.5 }]}
          onPress={(!isLocked && isOnline !== true) ? cycleMode : undefined}
          activeOpacity={(isLocked || isOnline === true) ? 1 : 0.75}
        >
          <MaterialIcons name={currentModeMeta.icon} size={24} color={currentModeMeta.color} />
        </TouchableOpacity>

        {/* 5. Create Garage Ride button
            Only shown in garage offlineMode.
            Disabled when: locked, online, scheduled mode is active,
            or there's an imminent scheduled ride. */}
        {(offlineMode === 'garage' && !isOnline) && (
          <TouchableOpacity
            style={[
              styles.toolIcon,
              { backgroundColor: '#E65100' },
              (isLocked || !isDriverVerified) && { opacity: 0.4 },
            ]}
            onPress={isLocked ? undefined : handleGaragePress}
            activeOpacity={(isLocked || !isDriverVerified) ? 1 : 0.8}
          >
            <MaterialIcons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>




      {/* ─── Collapsible Bottom Sheet (mirrors student dashboard) ─── */}
      {hasActiveRideContent && (
        <View style={[
          styles.bottomSheet,
          !isSheetExpanded && styles.bottomSheetCollapsed,
          { 
            bottom: 0,
            maxHeight: '44%',
            paddingBottom: isSheetExpanded ? Math.max(insets.bottom, 12) : 10,
          }
        ]}>
          <TouchableOpacity style={styles.sheetHeaderButton} onPress={toggleSheet} activeOpacity={0.85}>
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetHeaderTitle}>
                {isSheetExpanded ? 'Hide' : 'Show'}
              </Text>
              <MaterialIcons
                name={isSheetExpanded ? 'keyboard-arrow-down' : 'keyboard-arrow-up'}
                size={22}
                color="#5e5e5e"
              />
              <View style={styles.sheetHandleCenter} pointerEvents="none">
                <View style={styles.sheetHandle} />
              </View>
            </View>
          </TouchableOpacity>

          {isSheetExpanded && (
            <View style={styles.sheetContent}>
              <View style={{ width: '100%' }}>
                <View style={styles.sheetHeaderInfo}>
                  <View style={[styles.sheetIconBox, { backgroundColor: activityDisplay.bgColor }]}>
                    <MaterialIcons name={activityDisplay.icon as any} size={24} color={activityDisplay.color} />
                  </View>
                  <View style={styles.sheetTextCol}>
                    <Text style={styles.sheetTitle}>{activityDisplay.label}</Text>
                    <Text style={styles.sheetSub} numberOfLines={1}>
                      {activityState === 'ON_DEMAND_ACTIVE' ? 'Student on board' :
                       activityState === 'GARAGE_SESSION' ? 'Waiting for passengers' :
                       activityState === 'GARAGE_DEPARTED' ? 'Heading to destination' :
                       'Active Session'}
                    </Text>
                  </View>
                  {activeHeaderMetrics && (
                    <View style={styles.sheetMetricCol}>
                      <Text style={styles.sheetMetricText} numberOfLines={1}>{activeHeaderMetrics.distance}</Text>
                      <Text style={styles.sheetMetricSubText} numberOfLines={1}>{activeHeaderMetrics.elapsed}</Text>
                    </View>
                  )}
                </View>
                {renderActiveRideDetails()}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    bottom: -35,
  },

  // ── Online Toggle Pill (Top-Left) ──
  onlineTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 8,
    ...TOOL_SHADOW,
  },
  onlineTogglePillOnline: {
    backgroundColor: COLORS.primary,
  },
  onlineTogglePillOffline: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  onlineToggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  onlineToggleText: {
    ...FONTS.labelMd,
    color: COLORS.onSurface,
    fontWeight: '700' as const,
  },

  // ── Right-Side Toolbar ──
  toolbarContainer: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    gap: 14,
    zIndex: 10,
  },
  toolIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...TOOL_SHADOW,
  },
  garageFab: {
    backgroundColor: COLORS.primary,
  },
  goalRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalText: {
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Mode Label ──
  modeLabelContainer: {
    position: 'absolute',
    right: 12,
    zIndex: 9,
  },
  modeLabelPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modeLabelText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Collapsible Bottom Sheet (matching student app) ──
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    zIndex: 20,
  },
  bottomSheetCollapsed: {
    paddingBottom: 12,
  },
  sheetHeaderButton: {
    marginBottom: 2,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  sheetHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5e5e5e',
  },
  sheetHandleCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: {
    width: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#dadada',
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetContent: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  sheetHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  sheetIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTextCol: {
    flex: 1,
  },
  sheetTitle: {
    ...FONTS.titleMd,
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  sheetSub: {
    ...FONTS.bodySm,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  sheetMetricCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 64,
  },
  sheetMetricText: {
    ...FONTS.labelLg,
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  sheetMetricSubText: {
    ...FONTS.bodySm,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
    fontWeight: '700',
  },
  sheetDetailsContainer: {
    marginTop: 12,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sheetDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 12,
    marginBottom: 12,
  },
  sheetDetailItem: {
    alignItems: 'center',
    flex: 1,
  },
  sheetDetailLabel: {
    ...FONTS.labelMd,
    color: COLORS.onSurfaceVariant,
    marginTop: 4,
  },
  sheetDetailValue: {
    ...FONTS.titleMd,
    color: COLORS.onSurface,
    fontWeight: '700',
    marginTop: 2,
  },
  sheetLocationContainer: {
    paddingHorizontal: 2,
  },
  sheetLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetLocationDot: {
    width: 2,
    height: 10,
    backgroundColor: '#ccc',
    marginLeft: 10,
    marginVertical: 2,
  },
  sheetRouteIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primaryContainer + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRouteIconEnd: {
    backgroundColor: (COLORS.error ?? '#B00020') + '14',
  },
  sheetLocationText: {
    ...FONTS.bodySm,
    color: COLORS.onSurface,
    flex: 1,
  },
  sheetPrimaryButton: {
    marginTop: 12,
    alignSelf: 'flex-end',
    minWidth: 118,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  sheetPrimaryButtonText: {
    ...FONTS.labelLg,
    color: '#FFF',
  },
});

export default DashboardScreen;
