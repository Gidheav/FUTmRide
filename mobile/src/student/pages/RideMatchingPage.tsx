import { useEffect } from 'react'
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

const MAP_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAU4SAdl3a8Hfo8n5lP8rQ5YdOKd8674FWiyZDXWHvEGRmvU9HDn0fTcade8FdZ2Kt5x3jSNUDl3lyXF2w2geOmiAl0Aj0B_41G5F8uRvSuf06uqp_lZSnSPT9G5_uV1pqKQbYGZUkBeP9PxT96eZTYO67i8S4N85AnFm0mzuqQ6sUXbbK5jdVpiX_BNRU58HSskHCIPbPYVY_hbiULUflUrWm7v8zUVHiSXuiwmUkCHCRa_xdH_AP1DXoqiyOzd-ryyXUQygOz79o'

type RideMatchingPageProps = {
  onBack: () => void
  onMatched: () => void
}

export default function RideMatchingPage({ onBack, onMatched }: RideMatchingPageProps) {
  useEffect(() => {
    const timer = setTimeout(() => onMatched(), 2800)
    return () => clearTimeout(timer)
  }, [onMatched])

  return (
    <View style={styles.page}>
      <ImageBackground source={{ uri: MAP_IMAGE }} style={styles.map} resizeMode="cover">
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
            <MaterialIcons name="arrow-back" size={20} color="#1a1c1c" />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.radarWrap}>
          <View style={[styles.radarRing, styles.radarRingOne]} />
          <View style={[styles.radarRing, styles.radarRingTwo]} />
          <View style={[styles.radarRing, styles.radarRingThree]} />

          <View style={styles.userPulseOuter}>
            <View style={styles.userPulseInner} />
          </View>

          <View style={styles.driverMarkerOne}>
            <View style={styles.driverBadge}>
              <MaterialIcons name="directions-car" size={16} color="#6A1B9A" />
            </View>
            <View style={styles.driverEta}>
              <Text style={styles.driverEtaText}>2 min</Text>
            </View>
          </View>

          <View style={styles.driverMarkerTwo}>
            <View style={styles.driverBadge}>
              <MaterialIcons name="directions-car" size={16} color="#6A1B9A" />
            </View>
            <View style={styles.driverEta}>
              <Text style={styles.driverEtaText}>4 min</Text>
            </View>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.sheet}>
        <View style={styles.handle}>
          <View style={styles.handleBar} />
        </View>

        <View style={styles.sheetBody}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Finding your ride...</Text>
            <Text style={styles.statusSubtitle}>Connecting you to nearby drivers in Minna</Text>
          </View>

          <View style={styles.grid}>
            <View style={styles.gridCard}>
              <MaterialIcons name="schedule" size={28} color="#6A1B9A" />
              <Text style={styles.gridLabel}>EST. ARRIVAL</Text>
              <Text style={styles.gridValue}>3-5 min</Text>
            </View>
            <View style={styles.gridCard}>
              <MaterialIcons name="payments" size={28} color="#6A1B9A" />
              <Text style={styles.gridLabel}>EST. FARE</Text>
              <Text style={styles.gridValue}>₦400</Text>
            </View>
          </View>

          <View style={styles.routeCard}>
            <View style={styles.routeRail}>
              <View style={styles.routeDot} />
              <View style={styles.routeLine} />
              <View style={styles.routeSquare} />
            </View>
            <View style={styles.routeText}>
              <View>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={styles.routeValue}>Gidan Kwano Gate</Text>
              </View>
              <View style={styles.routeSpacing}>
                <Text style={styles.routeLabel}>Dropoff</Text>
                <Text style={styles.routeValue}>Engineering Block</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.cancelText}>Cancel Request</Text>
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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    paddingHorizontal: 20,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  headerSpacer: {
    width: 40,
  },
  radarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#6A1B9A',
    borderRadius: 999,
  },
  radarRingOne: {
    width: 100,
    height: 100,
    opacity: 0.2,
  },
  radarRingTwo: {
    width: 200,
    height: 200,
    opacity: 0.12,
  },
  radarRingThree: {
    width: 300,
    height: 300,
    opacity: 0.08,
  },
  userPulseOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(106,27,154,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPulseInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6A1B9A',
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  driverMarkerOne: {
    position: 'absolute',
    top: '28%',
    left: '32%',
    alignItems: 'center',
  },
  driverMarkerTwo: {
    position: 'absolute',
    bottom: '30%',
    right: '26%',
    alignItems: 'center',
  },
  driverBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  driverEta: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  driverEtaText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
  },
  handle: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
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
  },
  statusHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  gridLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  gridValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  routeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  routeRail: {
    width: 22,
    alignItems: 'center',
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6A1B9A',
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e2e2e2',
    marginVertical: 6,
  },
  routeSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#1a1c1c',
  },
  routeText: {
    flex: 1,
    justifyContent: 'space-between',
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  routeSpacing: {
    marginTop: 14,
  },
  cancelButton: {
    backgroundColor: '#f3f3f3',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1c1c',
  },
})
