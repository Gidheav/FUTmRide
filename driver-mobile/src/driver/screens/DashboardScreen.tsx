import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, FONTS } from '../../core/theme';
import { driverApi, driverWalletApi } from '../../core/api';
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

// ── Visual mode for the dashboard mode-switch tool ──
// This is the mode the driver WANTS to be in. It only applies when the state is IDLE.
type VisualMode = 'ondemand' | 'garage' | 'scheduled';

const MODE_CYCLE: VisualMode[] = ['ondemand', 'garage', 'scheduled'];
const MODE_META: Record<VisualMode, { icon: any; label: string; color: string }> = {
  ondemand: { icon: 'bolt', label: 'On-Demand', color: '#2E7D32' },
  garage: { icon: 'directions-car', label: 'Garage', color: '#E65100' },
  scheduled: { icon: 'event-note', label: 'Scheduled', color: '#6A1B9A' },
};

const DashboardScreen = ({ onCreateGarageRide }: { onCreateGarageRide?: () => void }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const { status, setStatus } = useGarageRideStore();
  const {
    isOnline,
    driverHasActiveRide,
    garageRide: storeGarageRide,
  } = useDriverRidesStore();

  const [walletSummary, setWalletSummary] = useState<any>(null);
  const [activeRide, setActiveRide] = useState<any>(null); // Garage ride
  const [activeOnDemandRide, setActiveOnDemandRide] = useState<any>(null); // On-demand ride
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visualMode, setVisualMode] = useState<VisualMode>('ondemand');
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);

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

      if (driverHasActiveRide) {
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
    } catch {
      setStatus('inactive');
      setActiveRide(null);
      setActiveOnDemandRide(null);
      setWalletSummary(null);
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
    await fetchDashboardData();
    await centerOnDriver();
    setIsRefreshing(false);
  };

  // ── Mode cycling (only works when IDLE / unlocked) ──
  const cycleMode = () => {
    if (isLocked) return; // Shouldn't be reachable, but safety check
    setVisualMode((prev) => {
      const idx = MODE_CYCLE.indexOf(prev);
      return MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
    });
  };

  // ── Garage ride creation with guard ──
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

  // ── Computed values ──
  const goalProgress = useMemo(() => getGoalProgress(walletSummary), [walletSummary]);
  const goalColor = goalProgress >= 100 ? '#4CAF50' : goalProgress >= 50 ? COLORS.primary : '#FF9800';

  const routeCoords = useMemo(() => {
    let sourceRide = null;

    if (activityState === 'ON_DEMAND_ACTIVE') {
      sourceRide = activeOnDemandRide;
    } else if (activityState === 'GARAGE_SESSION' || activityState === 'GARAGE_DEPARTED') {
      sourceRide = activeRide;
    }

    if (!sourceRide) return [];

    // 1. If we have exact route geometry from the student/creation, use it!
    if (Array.isArray(sourceRide.estimated_route_geometry) && sourceRide.estimated_route_geometry.length > 0) {
      return sourceRide.estimated_route_geometry
        .map((point: any) => ({
          latitude: Number(point.latitude),
          longitude: Number(point.longitude)
        }))
        .filter((point: any) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
    }

    // 2. Fallback: Draw a simple line if geometry is missing
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
  }, [activeRide, activeOnDemandRide, activityState]);

  const hasFittedRoute = useRef(false);

  // ── Auto-center map on route or driver ──
  useEffect(() => {
    if (isLocked && routeCoords.length > 0 && mapRef.current) {
      const isInitialFit = !hasFittedRoute.current;
      hasFittedRoute.current = true;
      const timer = setTimeout(() => {
        mapRef.current?.fitToCoordinates(routeCoords, {
          edgePadding: { top: 80, right: 80, bottom: 250, left: 80 },
          animated: !isInitialFit,
        });
      }, isInitialFit ? 100 : 500);
      return () => clearTimeout(timer);
    } else if (!isLocked) {
      hasFittedRoute.current = false;
      centerOnDriver();
    }
  }, [isLocked, routeCoords]);

  // Determine mode icon meta — when locked, show the forced state; when unlocked, show selected mode
  const currentModeMeta = isLocked
    ? { icon: activityDisplay.icon, label: activityDisplay.label, color: activityDisplay.color }
    : MODE_META[visualMode];

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

      {/* ─── Status Pill (Top-Left) — Read-only, shows current state ─── */}
      <View style={[styles.statusPillContainer, { top: insets.top + 16 }]}>
        <View style={[styles.statusPill, { borderLeftColor: activityDisplay.color }]}>
          <View style={[styles.statusDot, { backgroundColor: activityDisplay.color }]} />
          <Text style={styles.statusPillText}>{activityDisplay.label}</Text>
        </View>
      </View>

      {/* ─── Right-Side Vertical Toolbar ─── */}
      <View style={[styles.toolbarContainer, { top: insets.top + 16 }]}>

        {/* 1. Mode Switcher — Only visible when unlocked (IDLE) */}
        {!isLocked && (
          <TouchableOpacity style={styles.toolIcon} onPress={cycleMode} activeOpacity={0.75}>
            <MaterialIcons name={currentModeMeta.icon} size={24} color={currentModeMeta.color} />
          </TouchableOpacity>
        )}

        {/* 2. Start Garage Ride — Only visible when visualMode is 'garage' AND unlocked */}
        {!isLocked && visualMode === 'garage' && (
          <TouchableOpacity
            style={[styles.toolIcon, styles.garageFab]}
            onPress={handleGaragePress}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add" size={28} color={COLORS.onPrimary} />
          </TouchableOpacity>
        )}

        {/* 3. Daily Goal Progress Ring */}
        <TouchableOpacity style={styles.toolIcon} activeOpacity={0.8}>
          <View style={[styles.goalRing, { borderColor: goalColor }]}>
            <Text style={[styles.goalText, { color: goalColor }]}>{goalProgress}%</Text>
          </View>
        </TouchableOpacity>

        {/* 4. GPS Center */}
        <TouchableOpacity style={styles.toolIcon} onPress={centerOnDriver} activeOpacity={0.8}>
          <MaterialIcons name="my-location" size={22} color={COLORS.onSurfaceVariant} />
        </TouchableOpacity>

        {/* 5. Refresh */}
        <TouchableOpacity
          style={styles.toolIcon}
          onPress={handleRefresh}
          disabled={isRefreshing}
          activeOpacity={0.8}
        >
          {isRefreshing ? (
            <LoadingOverlay visible inline size={22} />
          ) : (
            <MaterialIcons name="refresh" size={22} color={COLORS.onSurfaceVariant} />
          )}
        </TouchableOpacity>
      </View>

      {/* ─── Mode Label (bottom of toolbar, only when unlocked) ─── */}
      {!isLocked && (
        <View style={[styles.modeLabelContainer, { top: insets.top + 72 }]}>
          <View style={[styles.modeLabelPill, { backgroundColor: currentModeMeta.color + '18' }]}>
            <Text style={[styles.modeLabelText, { color: currentModeMeta.color }]}>
              {currentModeMeta.label}
            </Text>
          </View>
        </View>
      )}

      {/* ─── Collapsible Bottom Sheet (mirrors student dashboard) ─── */}
      <View style={[
        styles.bottomSheet,
        !isSheetExpanded && styles.bottomSheetCollapsed,
        { paddingBottom: Math.max(insets.bottom, 16) + 70 },
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
            {isLocked ? (
              <>
                <View style={[styles.sheetIconBox, { backgroundColor: activityDisplay.bgColor }]}>
                  <MaterialIcons name={activityDisplay.icon as any} size={24} color={activityDisplay.color} />
                </View>
                <View style={styles.sheetTextCol}>
                  <Text style={styles.sheetTitle}>{activityDisplay.label}</Text>
                  <Text style={styles.sheetSub} numberOfLines={1}>
                    {activityState === 'ON_DEMAND_ACTIVE' ? 'Student on board / En route' :
                     activityState === 'GARAGE_SESSION' ? 'Waiting for passengers' :
                     'Heading to destination'}
                  </Text>
                </View>
                <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: activityDisplay.color }]} activeOpacity={0.8}>
                  <Text style={styles.sheetBtnText}>View</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.sheetIconBox, { backgroundColor: '#f3f3f3' }]}>
                  <MaterialIcons name="local-taxi" size={24} color={COLORS.onSurfaceVariant} />
                </View>
                <View style={styles.sheetTextCol}>
                  <Text style={styles.sheetTitle}>Ready for rides</Text>
                  <Text style={styles.sheetSub}>Select your preferred mode above to start</Text>
                </View>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // ── Status Pill (Top-Left) ──
  statusPillContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 8,
    borderLeftWidth: 4,
    ...TOOL_SHADOW,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    ...FONTS.labelMd,
    color: COLORS.onSurface,
    fontWeight: '700',
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
    paddingTop: 12,
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
    marginBottom: 6,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  sheetIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
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
  sheetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  sheetBtnText: {
    ...FONTS.labelMd,
    color: '#ffffff',
    fontWeight: '700',
  },
});

export default DashboardScreen;
