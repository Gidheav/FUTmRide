import { Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

const MAP_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuACAymAvVMw1_C29t_JZNFHXMi-T5wwcAwgkT6N2VVyx2XV-1Xjo_Qr9SJ3xLb-716lqv-Swb1HgaR5B8r39cSQaSIJflKKytUBGy9Fl9PmgI5O8GCdx5HIpEd_TveEpmgfA27p5K9J_tG2lJmYOE1LBqbbqe9hm_UTSPJdGBCRURMe1LLu9IcP6045gOwgJxsOPDxdVK8j3tmKb5QaCajMywzbxWSC8Y5Fd-Dwqm2-AxyGwcVOP6UwWPyO-5pzQPFrHseLIibVVWA'

const DRIVER_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBQjnJ6thn41UR35nThYvk-c1bRE2vNk8x5xLU1HWUN-AHXTH05wBgoaMd3fj54h8GIAvwj5j3X_lKGg8oob9PVCYvhnAeKjBa911O815sftTF5kKeTZwfZ7MyDhmffLOHB1HPhm3CncfR7YTQQZMXonkgKyiAZe8U1dSthPBZg16-Wq26uv6VZwu4Nj90gHjmOIsa_HZd-yUtj-4xG5BQ3zv_T0kMLD_o93dHHkDLg3SYIwHCrTEBFaiHjUb0o_Wh6H23RVFi2mtQ'

type ActiveRidePageProps = {
  onBack: () => void
}

export default function ActiveRidePage({ onBack }: ActiveRidePageProps) {
  return (
    <View style={styles.page}>
      <ImageBackground source={{ uri: MAP_IMAGE }} style={styles.map} resizeMode="cover">
        <View style={styles.mapButtons}>
          <TouchableOpacity style={styles.mapButton} activeOpacity={0.85}>
            <MaterialIcons name="my-location" size={20} color="#6A1B9A" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapButton} activeOpacity={0.85}>
            <MaterialIcons name="layers" size={20} color="#1a1c1c" />
          </TouchableOpacity>
        </View>

        <View style={styles.etaBadge}>
          <Text style={styles.etaBadgeText}>4 min away</Text>
        </View>

        <View style={styles.routeLineA} />
        <View style={styles.routeLineB} />
        <View style={styles.destinationMarker}>
          <View style={styles.destinationInner} />
        </View>
        <View style={styles.driverMarker}>
          <MaterialIcons name="directions-car" size={20} color="#6A1B9A" />
        </View>
      </ImageBackground>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarButton} onPress={onBack} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={20} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>En Route</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.sheet}>
        <View style={styles.handle}>
          <View style={styles.handleBar} />
        </View>

        <View style={styles.sheetBody}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Arriving in 4 mins</Text>
              <Text style={styles.sheetSubtitle}>Drop-off at Engineering Block B</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>On Time</Text>
            </View>
          </View>

          <View style={styles.driverCard}>
            <View style={styles.driverTop}>
              <View style={styles.driverInfo}>
                <View style={styles.driverAvatarWrap}>
                  <Image source={{ uri: DRIVER_IMAGE }} style={styles.driverAvatar} />
                  <View style={styles.driverRating}>
                    <Text style={styles.driverRatingText}>4.9</Text>
                    <MaterialIcons name="star" size={10} color="#6A1B9A" />
                  </View>
                </View>
                <View>
                  <Text style={styles.driverName}>Emmanuel</Text>
                  <Text style={styles.driverCar}>Toyota Corolla - Silver</Text>
                </View>
              </View>
              <View style={styles.plateWrap}>
                <Text style={styles.plateText}>KJA-452</Text>
              </View>
            </View>

            <View style={styles.driverDivider} />

            <View style={styles.driverActions}>
              <TouchableOpacity style={styles.driverActionButton} activeOpacity={0.85}>
                <MaterialIcons name="chat" size={20} color="#1a1c1c" />
                <Text style={styles.driverActionText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.driverActionButton} activeOpacity={0.85}>
                <MaterialIcons name="call" size={20} color="#1a1c1c" />
                <Text style={styles.driverActionText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tripActions}>
            <TouchableOpacity style={styles.shareButton} activeOpacity={0.85}>
              <MaterialIcons name="share" size={20} color="#6A1B9A" />
              <Text style={styles.shareText}>Share Trip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sosButton} activeOpacity={0.85}>
              <MaterialIcons name="warning" size={20} color="#9c1b1b" />
              <Text style={styles.sosText}>SOS</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} activeOpacity={0.85}>
            <Text style={styles.cancelText}>Cancel Ride</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  map: {
    flex: 1,
  },
  mapButtons: {
    position: 'absolute',
    top: 84,
    right: 16,
    gap: 8,
  },
  mapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  etaBadge: {
    position: 'absolute',
    top: 380,
    left: 150,
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  etaBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  routeLineA: {
    position: 'absolute',
    left: 160,
    top: 260,
    width: 6,
    height: 220,
    borderRadius: 4,
    backgroundColor: '#6A1B9A',
    opacity: 0.85,
    transform: [{ rotate: '18deg' }],
  },
  routeLineB: {
    position: 'absolute',
    left: 210,
    top: 170,
    width: 6,
    height: 140,
    borderRadius: 4,
    backgroundColor: '#6A1B9A',
    opacity: 0.75,
    transform: [{ rotate: '-22deg' }],
  },
  destinationMarker: {
    position: 'absolute',
    left: 198,
    top: 140,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6A1B9A',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  driverMarker: {
    position: 'absolute',
    left: 230,
    top: 420,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#6A1B9A',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  topBarSpacer: {
    width: 40,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
  },
  handle: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  handleBar: {
    width: 48,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e2e2e2',
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  sheetSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: '#6A1B9A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(106,27,154,0.08)',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  driverCard: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  driverTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatarWrap: {
    position: 'relative',
    width: 56,
    height: 56,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e5e5e5',
  },
  driverRating: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    padding: 2,
  },
  driverRatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6A1B9A',
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  driverCar: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  plateWrap: {
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f3f3',
  },
  plateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
    letterSpacing: 1,
  },
  driverDivider: {
    height: 1,
    backgroundColor: '#eeeeee',
  },
  driverActions: {
    flexDirection: 'row',
    gap: 12,
  },
  driverActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f3f3f3',
  },
  driverActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  tripActions: {
    flexDirection: 'row',
    gap: 12,
  },
  shareButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6A1B9A',
    backgroundColor: '#ffffff',
  },
  shareText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  sosButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#ffe8e8',
  },
  sosText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9c1b1b',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7b7b7b',
  },
})
