import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useState } from 'react'
import ActiveRidePage from './ActiveRidePage'
import RideMatchingPage from './RideMatchingPage'

const rides = [
  {
    id: 'tunde',
    name: 'Tunde',
    rating: '4.8',
    price: '₦500',
    eta: '2 min away',
    carType: 'Economy Sedan',
    carName: 'Toyota Corolla - KJA-452',
    status: 'available' as const,
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCkSQdjLDIgEUuPWaq2FENE0ky6XbGIl_qWlp-_xRbfKMfNSyxyzAZ5AsMprD0f67i5F_Rlq9_albnmdOJJzaxBMHi7QeG8K-BgRy48oyy56H7-LdZW1_dPF_e4aFGc8yUaPNmyCXAm30RB-0s_VDXjaDjwins64P65BifvsnB_2XypVo7pDXqbH5k5-ZCiPa52BErW6K2hobZpU9DgRdcmSs8sIVcU2ao8zyAHn_Bxr3F153yRzbh-ji6H4UqOO4o3wVImleKu1Pg',
  },
  {
    id: 'ibrahim',
    name: 'Ibrahim',
    rating: '4.9',
    price: '₦750',
    eta: '4 min away',
    carType: 'Premium SUV',
    carName: 'Honda CRV - LND-889',
    status: 'available' as const,
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD7QXq6_7KqcJI8SJBfFKwr_e-RMvK7Bf5TrdMVOFR5Yd7V1fqpWpE1CxtFcDLB1nEfiPuiPMFV8iWajaGJB22ceSP7g6Zc4bHiSnwFOJ2QyXxTCmfKXTgbrMIFL_TSWaRt-Ci0mhGvWi_E3mTepUTyFrt0YdoWrHmLs-xPQbEKNRAwV_p26bcAP5U2AnqxGusgmIuV_un0NS5kPoDA0HPrTbx-5cQshbb7NAOWTdhL5bOy8mm7dDWzuVxg9-ZosYpXghzeOslzARM',
  },
  {
    id: 'sarah',
    name: 'Sarah',
    rating: '4.7',
    price: '',
    eta: 'Offline',
    carType: 'Economy Hatchback',
    carName: 'Suzuki Swift - MIN-112',
    status: 'offline' as const,
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAJ2IECArRd6-V4GfnFEYPC0fG0s2m1twMOaIMX1vIKOYbkf_F4OkVVWZA2xuFPWkm_RQPaGPjczb1VtIMe8OciOdz-tPAT7p_Fvc7jR5KqhzlHnpsQKZDaL33Y_kM58QgE5sY4EIfeNz1aSfoUWHS_cIjOP5seFYx_KisyFcM1vjv0AvFnvaMTyly2-I9s90bbDtSZggy45yn9AKIwQczG8EmGOnxcMfFiLF-HOxXwlFCn3mq_AbMEQPl5JFJoNfbBOiPzdQsGQUk',
  },
]

export default function StudentRidesPage() {
  const [showActiveRide, setShowActiveRide] = useState(false)
  const [showMatching, setShowMatching] = useState(false)

  if (showActiveRide) {
    return <ActiveRidePage onBack={() => setShowActiveRide(false)} />
  }

  if (showMatching) {
    return (
      <RideMatchingPage
        onBack={() => setShowMatching(false)}
        onMatched={() => {
          setShowMatching(false)
          setShowActiveRide(true)
        }}
      />
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <View style={styles.mapCard}>
        <Image
          source={{
            uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDoboFJkimJJsvzvpxvAeLlPvMiUFjfN30ydT7TCnzrJm11nwK3I6UduyuYsm8EqEwErt5Me-WD6au4UEMyxJX4hgqbMqKpTKaQy3gN0PvJp4seyhQOyEOKZ0p2E-HoRtDV2JOXo0nvZtoVjXlf8Ue2o-HErK-hzJMQmPNIGOCR3R9ghNfYih03Ltmhv_lkqazK4THyGyHsSFEbAkY1y4NbnafegHWM8KfQmUWLeFtVN9ltXgIIoOpjNElslrkfVDETK2udK2G1Yic',
          }}
          style={styles.mapImage}
          resizeMode="cover"
        />
        <View style={styles.mapOverlay}>
          <View style={styles.locationPill}>
            <MaterialIcons name="location-on" size={18} color="#6A1B9A" />
            <Text style={styles.locationText}>Gidan Kwano (FUTMINNA)</Text>
          </View>
          <View style={styles.mapPulseWrap}>
            <View style={styles.mapPulseOuter}>
              <View style={styles.mapPulseInner} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Available Rides</Text>
        <View style={styles.nearbyBadge}>
          <Text style={styles.nearbyBadgeText}>3 Nearby</Text>
        </View>
      </View>

      <View style={styles.list}>
        {rides.map((ride) => {
          const isOffline = ride.status === 'offline'
          return (
            <View key={ride.id} style={[styles.rideCard, isOffline && styles.rideCardOffline]}>
              <View style={styles.rideTop}>
                <View style={styles.driverRow}>
                  <View style={styles.avatarWrap}>
                    <Image source={{ uri: ride.avatar }} style={[styles.avatar, isOffline && styles.avatarOffline]} />
                    <View style={[styles.statusDot, isOffline && styles.statusDotOffline]} />
                  </View>
                  <View>
                    <Text style={styles.driverName}>{ride.name}</Text>
                    <View style={styles.ratingRow}>
                      <MaterialIcons name="star" size={14} color="#6A1B9A" />
                      <Text style={styles.ratingText}>{ride.rating}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.priceWrap}>
                  {ride.price ? <Text style={styles.priceText}>{ride.price}</Text> : null}
                  <View style={[styles.etaBadge, isOffline && styles.etaBadgeOffline]}>
                    <Text style={[styles.etaText, isOffline && styles.etaTextOffline]}>{ride.eta}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.rideBottom}>
                <View>
                  <Text style={styles.carType}>{ride.carType}</Text>
                  <View style={styles.carRow}>
                    <MaterialIcons name="directions-car" size={16} color={isOffline ? '#8a8a8a' : '#5e5e5e'} />
                    <Text style={[styles.carText, isOffline && styles.carTextOffline]}>{ride.carName}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.requestButton, isOffline && styles.requestButtonDisabled]}
                  activeOpacity={0.85}
                  disabled={isOffline}
                  onPress={() => {
                    if (!isOffline) {
                      setShowActiveRide(false)
                      setShowMatching(true)
                    }
                  }}
                >
                  <Text style={[styles.requestText, isOffline && styles.requestTextDisabled]}>
                    {isOffline ? 'Unavailable' : 'Request'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  pageContent: {
    padding: 20,
    paddingBottom: 24,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  mapCard: {
    height: 192,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#f3f3f3',
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  mapImage: {
    width: '100%',
    height: '100%',
    opacity: 0.82,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    justifyContent: 'space-between',
  },
  locationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#eeeeee',
  },
  locationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  mapPulseWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPulseOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(106,27,154,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPulseInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#6A1B9A',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  nearbyBadge: {
    backgroundColor: 'rgba(106,27,154,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(106,27,154,0.18)',
  },
  nearbyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  list: {
    gap: 16,
  },
  rideCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  rideCardOffline: {
    backgroundColor: '#f9f9f9',
    shadowOpacity: 0.02,
    opacity: 0.72,
  },
  rideTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#eeeeee',
  },
  avatarOffline: {
    tintColor: '#a0a0a0',
  },
  statusDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6A1B9A',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  statusDotOffline: {
    backgroundColor: '#9a9a9a',
  },
  driverName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#5e5e5e',
    fontWeight: '600',
  },
  priceWrap: {
    alignItems: 'flex-end',
    gap: 6,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  etaBadge: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(106,27,154,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  etaBadgeOffline: {
    backgroundColor: '#eeeeee',
  },
  etaText: {
    fontSize: 12,
    color: '#6A1B9A',
    fontWeight: '600',
  },
  etaTextOffline: {
    color: '#7b7b7b',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  rideBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  carType: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  carRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  carText: {
    fontSize: 13,
    color: '#1a1c1c',
  },
  carTextOffline: {
    color: '#7b7b7b',
  },
  requestButton: {
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  requestButtonDisabled: {
    backgroundColor: '#eeeeee',
    shadowOpacity: 0,
  },
  requestText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  requestTextDisabled: {
    color: '#9a9a9a',
  },
})
