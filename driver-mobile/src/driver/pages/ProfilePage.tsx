import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import { useAuthStore } from '../../core/authStore';

const { width } = Dimensions.get('window');

const PLACEHOLDER_AVATAR = 
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAEPLb-0VXvJX3a4y_p5Bo9qBWqmVdk7DJmrEtCiDHFQSslab5sGSUpzuhbRBDuSDMbx2DzntjHd-6mJvLgviVL2J-XQsvk5egP7wfVa5zdZ1Xl-7W1dXZ4OA1bxXUbFnhVTVRvAtWBh9ECwU2Pz86jM6GjzrvX9ZwzvasJ3HD_LvG95E52BYauB7OP_BdrcPi6N-VIYLRFfgTEYvyM_vJFkGir3sjQghnVsB78BOGtnXiR9d854c3wMTGGgObpBkXxV2eu8SfY6lY";

type ProfileProps = {
  onNavigateToSettings?: () => void;
};

export default function DriverProfilePage({ onNavigateToSettings }: ProfileProps) {
  const { user } = useAuthStore();
  
  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header Section */}
      <View style={styles.profileHeader}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: PLACEHOLDER_AVATAR }} 
            style={styles.profileImage} 
          />
          <View style={styles.verifiedBadge}>
            <MaterialIcons name="verified" size={16} color={COLORS.onPrimary} />
          </View>
        </View>
        <View style={styles.nameContainer}>
          <Text style={[FONTS.headlineXl, styles.nameText]}>
            {user?.full_name || 'Adebayo Samuel'}
          </Text>
          <View style={styles.ratingRow}>
            <MaterialIcons name="star" size={18} color={COLORS.primaryContainer} />
            <Text style={[FONTS.labelLg, { color: COLORS.onSurfaceVariant }]}>4.8</Text>
            <View style={styles.dot} />
            <Text style={[FONTS.labelLg, { color: COLORS.onSurfaceVariant }]}>Verified Driver</Text>
          </View>
        </View>
      </View>

      {/* Bento Grid Layout for Details */}
      <View style={styles.statsContainer}>
        <View style={[styles.statBox, AMBIENT_SHADOW]}>
          <Text style={[FONTS.headlineMd, styles.statValue]}>3</Text>
          <Text style={[FONTS.labelMd, styles.statLabel]}>Years Exp.</Text>
        </View>
        <View style={[styles.statBox, AMBIENT_SHADOW]}>
          <Text style={[FONTS.headlineMd, styles.statValue]}>1.2k</Text>
          <Text style={[FONTS.labelMd, styles.statLabel]}>Total Rides</Text>
        </View>
        <View style={[styles.statBox, AMBIENT_SHADOW]}>
          <Text style={[FONTS.headlineMd, styles.statValue]}>EN, HA</Text>
          <Text style={[FONTS.labelMd, styles.statLabel]}>Languages</Text>
        </View>
      </View>

      {/* Vehicle Details Card */}
      <View style={[styles.card, AMBIENT_SHADOW]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconBg}>
            <MaterialIcons name="directions-car" size={20} color={COLORS.primaryContainer} />
          </View>
          <Text style={[FONTS.headlineMd, styles.cardTitle]}>Vehicle Details</Text>
        </View>
        
        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <Text style={[FONTS.bodyMd, styles.detailLabel]}>Model</Text>
            <Text style={[FONTS.labelLg, styles.detailValue]}>Toyota Corolla 2018</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[FONTS.bodyMd, styles.detailLabel]}>Plate Number</Text>
            <View style={styles.plateBadge}>
              <Text style={[FONTS.labelLg, styles.plateText]}>ABC-123-XY</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={[FONTS.bodyMd, styles.detailLabel]}>Color</Text>
            <View style={styles.colorValue}>
              <View style={[styles.colorDot, { backgroundColor: '#C0C0C0' }]} />
              <Text style={[FONTS.labelLg, styles.detailValue]}>Silver</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Performance Badges */}
      <View style={[styles.card, AMBIENT_SHADOW]}>
        <Text style={[FONTS.labelLg, styles.sectionSubTitle]}>Performance Badges</Text>
        <View style={styles.badgeWrap}>
          <View style={[styles.badge, styles.badgePrimary]}>
            <MaterialIcons name="workspace-premium" size={16} color={COLORS.onPrimaryContainer} />
            <Text style={[FONTS.labelMd, { color: COLORS.onPrimaryContainer }]}>Top Rated</Text>
          </View>
          <View style={[styles.badge, styles.badgeSecondary]}>
            <MaterialIcons name="explore" size={16} color={COLORS.onSecondaryContainer} />
            <Text style={[FONTS.labelMd, { color: COLORS.onSecondaryContainer }]}>Expert Navigator</Text>
          </View>
          <View style={[styles.badge, styles.badgePrimary]}>
            <MaterialIcons name="health-and-safety" size={16} color={COLORS.onPrimaryContainer} />
            <Text style={[FONTS.labelMd, { color: COLORS.onPrimaryContainer }]}>Safety First</Text>
          </View>
        </View>
      </View>

      {/* Documentation Status */}
      <View style={[styles.card, AMBIENT_SHADOW]}>
        <Text style={[FONTS.labelLg, styles.sectionSubTitle]}>Documentation</Text>
        <View style={styles.docList}>
          <View style={styles.docItem}>
            <View style={styles.docInfo}>
              <MaterialIcons name="badge" size={20} color={COLORS.onBackground} />
              <Text style={[FONTS.bodyMd, styles.docName]}>Driver's License</Text>
            </View>
            <MaterialIcons name="check-circle" size={22} color={COLORS.primaryContainer} />
          </View>
          <View style={styles.docItem}>
            <View style={styles.docInfo}>
              <MaterialIcons name="description" size={20} color={COLORS.onBackground} />
              <Text style={[FONTS.bodyMd, styles.docName]}>Vehicle Insurance</Text>
            </View>
            <MaterialIcons name="check-circle" size={22} color={COLORS.primaryContainer} />
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionArea}>
        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.9}>
          <MaterialIcons name="edit" size={20} color={COLORS.onPrimary} />
          <Text style={[FONTS.labelLg, styles.primaryButtonText]}>Edit Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9} onPress={onNavigateToSettings}>
          <MaterialIcons name="settings" size={20} color={COLORS.onBackground} />
          <Text style={[FONTS.labelLg, styles.secondaryButtonText]}>Account Settings</Text>
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
    paddingBottom: 112, // Space for bottom nav
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: COLORS.surfaceContainerLowest,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primaryContainer,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameContainer: {
    alignItems: 'center',
  },
  nameText: {
    color: COLORS.onBackground,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.surfaceContainerHighest,
    marginHorizontal: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  statValue: {
    color: COLORS.onBackground,
  },
  statLabel: {
    color: COLORS.onSurfaceVariant,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceContainer,
  },
  cardIconBg: {
    backgroundColor: COLORS.surfaceContainerLow,
    padding: 8,
    borderRadius: 8,
  },
  cardTitle: {
    color: COLORS.onBackground,
    fontSize: 20,
  },
  cardBody: {
    gap: 16,
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
    color: COLORS.onBackground,
  },
  plateBadge: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  plateText: {
    color: COLORS.onBackground,
  },
  colorValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  sectionSubTitle: {
    color: COLORS.onSurfaceVariant,
    marginBottom: 12,
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    gap: 4,
  },
  badgePrimary: {
    backgroundColor: COLORS.primaryContainer + '1A', // 10% opacity
    borderColor: COLORS.primaryContainer,
  },
  badgeSecondary: {
    backgroundColor: COLORS.secondaryContainer + '33', // 20% opacity
    borderColor: COLORS.secondary,
  },
  docList: {
    gap: 12,
  },
  docItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  docName: {
    color: COLORS.onBackground,
  },
  actionArea: {
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: COLORS.onPrimary,
  },
  secondaryButton: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainer,
  },
  secondaryButtonText: {
    color: COLORS.onBackground,
  },
});
