import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Animated,
  ImageBackground,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';

const DEEP_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 24,
  elevation: 8,
};

const MAP_IMAGE = "https://lh3.googleusercontent.com/aida-public/AB6AXuDH5Mc0CtUncK6AM9ekDcXpokpcii8T-mtnBtBSwJHLEFy-r2xky1Axae-FBOvLGIJbmjVXgxQx4IxrNYEuHgQu_QXdceeZKdIg2isg_qJULq9See4bWpI3mkejzY0yL_9XzwHsDVjrKHXAHyvqb13fZu_VcptaomSO-OO8AUkiluQwANgxVUlYG9yyqbufqOrOjXYKIlk41RQE4cK4IoO2eBFTaqQ1Bs1hzcbGqJCEK1gYXC2Jb2Z6z8HZeRr_C3iH3F6Rsr8j7lI";

type DashboardScreenProps = {
  onCreateGarageRide?: () => void;
};

const DashboardScreen = ({ onCreateGarageRide }: DashboardScreenProps) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const heatPulse1 = useRef(new Animated.Value(0.4)).current;
  const heatPulse2 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Status dot pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
    // Heatmap pulses
    Animated.loop(
      Animated.sequence([
        Animated.timing(heatPulse1, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
        Animated.timing(heatPulse1, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(heatPulse2, { toValue: 0.5, duration: 1400, useNativeDriver: true }),
        Animated.timing(heatPulse2, { toValue: 0.2, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Alert Ticker */}
      <View style={styles.alertBanner}>
        <MaterialIcons name="warning" size={18} color="#F57F17" />
        <Text style={styles.alertText} numberOfLines={1}>
          Heavy traffic reported near South Gate. Expect delays.
        </Text>
      </View>

      {/* Status & Earnings Card */}
      <View style={[styles.statusCard, AMBIENT_SHADOW]}>
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <Animated.View style={[styles.statusDot, { opacity: pulseAnim }]} />
            <Text style={[FONTS.labelLg, { color: COLORS.primaryContainer }]}>
              Online
            </Text>
            <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginLeft: 8 }]}>
              02:45:10
            </Text>
          </View>
        </View>

        <View style={styles.earningsRow}>
          <View>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant, marginBottom: 4 }]}>
              Earnings Today
            </Text>
            <Text style={[FONTS.headlineXl, { color: COLORS.onSurface }]}>₦12,450</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant, marginBottom: 4 }]}>
              Completed
            </Text>
            <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>8 Rides</Text>
          </View>
        </View>
      </View>

      {/* Demand Heatmap */}
      <View style={[styles.heatmapCard, AMBIENT_SHADOW]}>
        <View style={styles.heatmapHeader}>
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>Demand Heatmap</Text>
          <MaterialIcons name="open-in-full" size={18} color={COLORS.onSurfaceVariant} />
        </View>
        <View style={styles.heatmapBody}>
          <Image source={{ uri: MAP_IMAGE }} style={styles.mapImage} resizeMode="cover" />
          {/* Heat overlays */}
          <Animated.View style={[styles.heatBlob1, { opacity: heatPulse1 }]} />
          <Animated.View style={[styles.heatBlob2, { opacity: heatPulse2 }]} />
          {/* Marker */}
          <View style={styles.markerContainer}>
            <View style={styles.markerLabel}>
              <Text style={[FONTS.labelMd, { color: COLORS.onPrimary }]}>Main Campus</Text>
            </View>
            <View style={styles.markerDot} />
          </View>
        </View>
      </View>

      {/* Performance Stats (Bento Grid) */}
      <View style={styles.bentoGrid}>
        {/* Rating */}
        <View style={[styles.bentoCell, AMBIENT_SHADOW]}>
          <MaterialIcons name="star" size={24} color={COLORS.primaryContainer} style={{ marginBottom: 8 }} />
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>4.8</Text>
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Driver Rating</Text>
        </View>
        {/* Acceptance */}
        <View style={[styles.bentoCell, AMBIENT_SHADOW]}>
          <MaterialIcons name="check-circle" size={24} color={COLORS.primaryContainer} style={{ marginBottom: 8 }} />
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>92%</Text>
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Acceptance</Text>
        </View>
        {/* Cancellation */}
        <View style={[styles.bentoCell, AMBIENT_SHADOW]}>
          <MaterialIcons name="cancel" size={24} color={COLORS.error} style={{ marginBottom: 8 }} />
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>3%</Text>
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Cancellation</Text>
        </View>
        {/* Daily Goal */}
        <View style={[styles.bentoCell, AMBIENT_SHADOW, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={styles.goalRing}>
            <View style={styles.goalTrack} />
            <View style={styles.goalFill} />
            <View style={styles.goalCenter}>
              <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>8/10</Text>
            </View>
          </View>
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant, marginTop: 8, textAlign: 'center' }]}>
            Daily Goal
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.quickActionsGrid}>
          {[
            { icon: 'map' as const, label: 'Map', action: undefined },
            { icon: 'support-agent' as const, label: 'Support', action: undefined },
            { icon: 'qr-code-scanner' as const, label: 'Garage QR', action: onCreateGarageRide },
            { icon: 'car-repair' as const, label: 'Vehicle', action: undefined },
          ].map((item, idx) => (
            <TouchableOpacity key={idx} style={styles.quickActionItem} activeOpacity={0.8} onPress={item.action}>
              <MaterialIcons name={item.icon} size={24} color={COLORS.primaryContainer} />
              <Text style={[FONTS.labelMd, { color: COLORS.onSurface }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Nearby Requests */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>NEARBY REQUESTS</Text>
          <View style={styles.newBadge}>
            <Text style={[FONTS.labelMd, { color: COLORS.primaryContainer }]}>2 New</Text>
          </View>
        </View>

        {/* Request Card 1 — highlighted */}
        <View style={[styles.requestCard, DEEP_SHADOW, styles.requestCardHighlighted]}>
          <View style={styles.requestAccentBar} />
          <View style={styles.requestTop}>
            <View style={styles.requestUser}>
              <View style={styles.avatar}>
                <Text style={[FONTS.headlineMd, { color: COLORS.onSurfaceVariant }]}>S</Text>
              </View>
              <View>
                <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Samuel T.</Text>
                <View style={styles.ratingRow}>
                  <MaterialIcons name="star" size={14} color={COLORS.onSurfaceVariant} />
                  <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>4.9</Text>
                </View>
              </View>
            </View>
            <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>₦850</Text>
          </View>

          <View style={styles.routeWrap}>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <View style={styles.pickupDot} />
              <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]} numberOfLines={1}>
                Main Gate, Bosso Campus
              </Text>
            </View>
            <View style={styles.routePoint}>
              <View style={styles.dropoffDot} />
              <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]} numberOfLines={1}>
                Engineering Block
              </Text>
            </View>
          </View>

          <View style={styles.requestActions}>
            <TouchableOpacity style={styles.declineBtn} activeOpacity={0.8}>
              <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} activeOpacity={0.8}>
              <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Request Card 2 */}
        <View style={[styles.requestCard, AMBIENT_SHADOW, { marginTop: 12 }]}>
          <View style={styles.requestTop}>
            <View style={styles.requestUser}>
              <View style={styles.avatar}>
                <Text style={[FONTS.headlineMd, { color: COLORS.onSurfaceVariant }]}>F</Text>
              </View>
              <View>
                <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Fatima A.</Text>
                <View style={styles.ratingRow}>
                  <MaterialIcons name="star" size={14} color={COLORS.onSurfaceVariant} />
                  <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>4.7</Text>
                </View>
              </View>
            </View>
            <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>₦1,200</Text>
          </View>

          <View style={styles.routeWrap}>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <View style={styles.pickupDot} />
              <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]} numberOfLines={1}>
                South Gate Clinic
              </Text>
            </View>
            <View style={styles.routePoint}>
              <View style={styles.dropoffDot} />
              <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]} numberOfLines={1}>
                Student Hostel C
              </Text>
            </View>
          </View>

          <View style={styles.requestActions}>
            <TouchableOpacity style={styles.declineBtn} activeOpacity={0.8}>
              <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} activeOpacity={0.8}>
              <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContent: {
    paddingHorizontal: 5,
    paddingTop: 16,
    paddingBottom: 80,
    gap: 24,
  },

  /* ── Alert Banner ── */
  alertBanner: {
    backgroundColor: '#FFF8E1',
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 0.24,
    fontWeight: '600',
    color: '#F57F17',
  },

  /* ── Status & Earnings ── */
  statusCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primaryContainer,
  },
  goOfflineBtn: {
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceContainer,
    paddingTop: 16,
  },

  /* ── Heatmap ── */
  heatmapCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  heatmapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  heatmapBody: {
    height: 160,
    width: '100%',
    backgroundColor: COLORS.surfaceContainerHigh,
    position: 'relative',
  },
  mapImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  heatBlob1: {
    position: 'absolute',
    top: '20%',
    left: '25%',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.error,
  },
  heatBlob2: {
    position: 'absolute',
    top: '45%',
    right: '18%',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.error,
  },
  markerContainer: {
    position: 'absolute',
    top: '18%',
    left: '28%',
    alignItems: 'center',
  },
  markerLabel: {
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primaryContainer,
    borderWidth: 2,
    borderColor: COLORS.onPrimary,
  },

  /* ── Bento Grid ── */
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bentoCell: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    gap: 4,
  },
  /* Goal ring (simplified) */
  goalRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  goalTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: COLORS.surfaceContainerHigh,
  },
  goalFill: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: COLORS.primaryContainer,
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '25deg' }],
  },
  goalCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Quick Actions ── */
  sectionWrap: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: COLORS.onSurfaceVariant,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newBadge: {
    backgroundColor: COLORS.primaryContainer + '1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionItem: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },

  /* ── Request Cards ── */
  requestCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    position: 'relative',
    overflow: 'hidden',
  },
  requestCardHighlighted: {
    borderColor: COLORS.primaryContainer + '4D', // ~30%
  },
  requestAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
    backgroundColor: COLORS.primaryContainer,
  },
  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestUser: {
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  routeWrap: {
    marginBottom: 16,
    paddingLeft: 8,
    position: 'relative',
    gap: 8,
  },
  routeLine: {
    position: 'absolute',
    left: 11,
    top: 16,
    bottom: 16,
    width: 2,
    backgroundColor: COLORS.surfaceContainerHigh,
    zIndex: 0,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
  },
  pickupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primaryContainer,
    borderWidth: 2,
    borderColor: COLORS.surfaceContainerLowest,
  },
  dropoffDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: COLORS.error,
    borderWidth: 2,
    borderColor: COLORS.surfaceContainerLowest,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: COLORS.primaryContainer,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});

export default DashboardScreen;