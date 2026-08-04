import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../core/authStore'
import { useSettingsStore } from '../../core/settingsStore'
import { useUIPreferencesStore } from '../../core/uiPreferencesStore'
import MapView, { Marker, Callout, Circle, Region, PROVIDER_GOOGLE } from 'react-native-maps'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import {
  getCurrentLocation,
  isWithinServiceArea,
  requestLocationPermission,
  LocationError,
  MINNA_SERVICE_AREA,
} from '../../core/locationService'
import useWalletStore from '../../core/walletStore'
import { useLocations } from '../../../services/locationDataService'
import { useStudentProfileStore } from '../../core/studentProfileStore'
import { getCampusCenter } from '../../core/campus'
import { isFuzzyMatch } from '../../core/searchUtils'

const DEFAULT_REGION: Region = {
  latitude: 9.5261,
  longitude: 6.4514,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
}
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)


const FOCUS_LATITUDE_DELTA = 0.0026
const FOCUS_LONGITUDE_DELTA = 0.0026
const HIGHLIGHT_RADIUS_METERS = 90

type Location = {
  id: string
  name: string
  description: string
  latitude: number
  longitude: number
  category: string
}

const LOCATION_BUFFER_KM = 25

const computeBounds = (locations: Location[], bufferKm: number) => {
  if (!locations || locations.length === 0) return { northEast: { latitude: 0, longitude: 0 }, southWest: { latitude: 0, longitude: 0 } }
  let minLat = locations[0].latitude
  let maxLat = locations[0].latitude
  let minLng = locations[0].longitude
  let maxLng = locations[0].longitude

  for (const loc of locations) {
    if (loc.latitude < minLat) minLat = loc.latitude
    if (loc.latitude > maxLat) maxLat = loc.latitude
    if (loc.longitude < minLng) minLng = loc.longitude
    if (loc.longitude > maxLng) maxLng = loc.longitude
  }

  const latBuffer = bufferKm / 111.0
  const lngBuffer = bufferKm / 111.32

  return {
    northEast: { latitude: maxLat + latBuffer, longitude: maxLng + lngBuffer },
    southWest: { latitude: minLat - latBuffer, longitude: minLng - lngBuffer },
  }
}

const isWithinBounds = (
  coords: { latitude: number; longitude: number },
  bounds: { northEast: { latitude: number; longitude: number }; southWest: { latitude: number; longitude: number } },
) => (
  coords.latitude <= bounds.northEast.latitude
  && coords.latitude >= bounds.southWest.latitude
  && coords.longitude <= bounds.northEast.longitude
  && coords.longitude >= bounds.southWest.longitude
)

const MODAL_CATEGORIES: Record<string, string> = {
  lecture: 'Lecture Theatres',
  hostel: 'Hostels',
  gate: 'Campus Gates',
  laboratory: 'Laboratories',
  blocks: 'Admin Blocks',
  worship: 'Places of Worship',
  library: 'Libraries',
  medical: 'Medical Centers',
  sports: 'Sports Facilities',
  ict: 'ICT Centers',
  canteen: 'Canteens',
  workshop: 'Workshops & Tech Labs',
  auditorium: 'Auditoriums & Halls',
  parking: 'Parking Areas',
  faculty: 'Faculty & Department Offices',
  senate: 'Senate & Admin Directorates',
}

type QuickItem = {
  id: string
  label: string
  icon: keyof typeof MaterialIcons.glyphMap
  category: string
  hasModal: boolean
}

export const QUICK_ITEMS: QuickItem[] = [
  { id: 'lecture',    label: 'Lecture',   icon: 'school',             category: 'lecture',    hasModal: true },
  { id: 'laboratory', label: 'Lab',       icon: 'science',            category: 'laboratory', hasModal: true },
  { id: 'hostel',     label: 'Hostel',    icon: 'apartment',          category: 'hostel',     hasModal: true },
  { id: 'library',    label: 'Library',   icon: 'local-library',      category: 'library',    hasModal: true },
  { id: 'gate',       label: 'Gate',      icon: 'meeting-room',       category: 'gate',       hasModal: true },
  { id: 'blocks',     label: 'Blocks',    icon: 'business',           category: 'blocks',     hasModal: true },
  { id: 'medical',    label: 'Medical',   icon: 'local-hospital',     category: 'medical',    hasModal: true },
  { id: 'sports',     label: 'Sports',    icon: 'sports-soccer',      category: 'sports',     hasModal: true },
  { id: 'ict',        label: 'ICT',       icon: 'computer',           category: 'ict',        hasModal: true },
  { id: 'canteen',    label: 'Canteen',   icon: 'restaurant',         category: 'canteen',    hasModal: true },
  { id: 'worship',    label: 'Worship',   icon: 'account-balance',    category: 'worship',    hasModal: true },
  { id: 'workshop',   label: 'Workshop',  icon: 'build',              category: 'workshop',   hasModal: true },
  { id: 'auditorium', label: 'Hall',      icon: 'event-seat',         category: 'auditorium', hasModal: true },
  { id: 'parking',    label: 'Parking',   icon: 'local-parking',      category: 'parking',    hasModal: true },
  { id: 'faculty',    label: 'Faculty',   icon: 'domain',             category: 'faculty',    hasModal: true },
  { id: 'senate',     label: 'Senate',    icon: 'account-circle',     category: 'senate',     hasModal: true },
]

type StudentDashboardScreenProps = {
  onNavigateToWallet?: () => void
  onBookRide?: () => void
  onViewRideStatus?: () => void
  onQrScanned?: (qrToken: string) => void
  onShareCodeScanned?: (code: string) => void
  activeRide?: { id: string; status: string } | null
}

export default function StudentDashboardScreen({
  onNavigateToWallet,
  onBookRide,
  onViewRideStatus,
  onQrScanned,
  onShareCodeScanned,
  activeRide,
}: StudentDashboardScreenProps) {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const userId = user?.id || null
  const cachedProfileEntry = useStudentProfileStore((state) => userId ? state.profilesByUserId[userId] : null)
  const campusValue =
    cachedProfileEntry?.studentProfile?.campus?.name ??
    cachedProfileEntry?.studentProfile?.campus?.id ??
    user?.campus?.name ??
    user?.campus?.id
  const campusMapRegion = useMemo<Region>(() => {
    const center = getCampusCenter(campusValue)
    return {
      ...DEFAULT_REGION,
      latitude: center.latitude,
      longitude: center.longitude,
    }
  }, [campusValue])
  const { enabledCategories } = useSettingsStore()
  const mapRef = useRef<MapView | null>(null)
  const markerRef = useRef<any>(null)
  const searchInputRef = useRef<TextInput | null>(null)
  const savedMapRegionRef = useRef<Region>(campusMapRegion)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [isActionPanelExpanded, setIsActionPanelExpanded] = useState(true)
  const [isMapReady, setIsMapReady] = useState(false)
  const [didMapTimeout, setDidMapTimeout] = useState(false)
  const [mapInstanceKey, setMapInstanceKey] = useState(0)
  const [currentMapRegion, setCurrentMapRegion] = useState<Region>(campusMapRegion)
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [activePin, setActivePin] = useState<Location | null>(null)

  // OTA location data — updates automatically after silent background download
  const ALL_LOCATIONS = useLocations() as Location[]
  const MINNA_BOUNDS = useMemo(
    () => (ALL_LOCATIONS.length > 0 ? computeBounds(ALL_LOCATIONS, LOCATION_BUFFER_KM) : computeBounds([{ latitude: 9.5255, longitude: 6.4498 } as Location], LOCATION_BUFFER_KM)),
    [ALL_LOCATIONS],
  )
  const [scannerVisible, setScannerVisible] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const [locationStatus, setLocationStatus] = useState<'unknown' | 'granted' | 'denied' | 'outOfAxis' | 'error'>('unknown')
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationMessage, setLocationMessage] = useState<string | null>(null)
  const walletBalance = useWalletStore((state) => state.walletBalance)
  const hideBalance = useUIPreferencesStore((state) => state.hideBalance)
  const setUIHideBalance = useUIPreferencesStore((state) => state.setHideBalance)
  const SCAN_DISABLED_STATUSES = new Set(['driver_assigned', 'in_progress', 'arrived'])
  const isScanDisabled = Boolean(activeRide && SCAN_DISABLED_STATUSES.has(activeRide.status))

  const formatAmount = useCallback((value: number | string | null) => {
    if (value === null || value === undefined) return '--'
    const numeric = Number(value)
    return `₦${numeric.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
  }, [])

  useEffect(() => {
    const isFabric = Boolean((globalThis as any).nativeFabricUIManager)
    if (Platform.OS === 'android' && !isFabric && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true)
    }
  }, [])

  useEffect(() => {
    if (isMapReady) return
    const timer = setTimeout(() => { if (!isMapReady) setDidMapTimeout(true) }, 12000)
    return () => clearTimeout(timer)
  }, [isMapReady, mapInstanceKey])

  useEffect(() => {
    savedMapRegionRef.current = campusMapRegion
    setCurrentMapRegion(campusMapRegion)
    mapRef.current?.animateToRegion(campusMapRegion, 350)
  }, [campusMapRegion])

  useEffect(() => {
    if (mapRef.current && savedMapRegionRef.current) {
      const timer = setTimeout(() => {
        mapRef.current?.animateToRegion(savedMapRegionRef.current, 300)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isMapReady])

  const handleMapReady = () => { setIsMapReady(true); setDidMapTimeout(false) }

  const handleRegionChangeComplete = (region: Region) => {
    savedMapRegionRef.current = region
    setCurrentMapRegion(region)
  }

  const flyToLocation = (loc: Location) => {
    setActiveModal(null)
    setActivePin(loc)
    setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: FOCUS_LATITUDE_DELTA,
          longitudeDelta: FOCUS_LONGITUDE_DELTA,
        },
        500,
      )
      setTimeout(() => markerRef.current?.showCallout(), 650)
    }, 300)
  }

  const handleQuickPress = (item: QuickItem) => {
    if (item.hasModal) { setActiveModal(item.category); return }
    const loc = ALL_LOCATIONS.find((l) => l.category === item.category)
    if (loc) flyToLocation(loc)
  }

  const toggleActionPanel = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setIsActionPanelExpanded((prev) => !prev)
  }

  const retryMapRender = () => {
    setDidMapTimeout(false)
    setIsMapReady(false)
    setMapInstanceKey((prev) => prev + 1)
  }

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission()
      if (!result.granted) return
    }
    setScanned(false)
    setScannerVisible(true)
  }

  const searchResults = useMemo(() => {
    const query = searchQuery.trim()
    if (!query) return []
    return ALL_LOCATIONS.filter((location) => {
      return [location.name, location.description, location.category]
        .some((field) => isFuzzyMatch(query, field))
    })
  }, [searchQuery, ALL_LOCATIONS])

  const searchResultsVisible = searchActive && searchQuery.trim().length > 0

  const handleScan = ({ data }: { data: string }) => {
    setScanned(true)
    setScannerVisible(false)
    
    // First, check if it's a UUID (used for garage dispatch)
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    const uuidMatch = data.match(uuidPattern)
    if (uuidMatch && onQrScanned) {
      onQrScanned(uuidMatch[0])
      return
    }

    // Then, check if it's a shared ride code (typically a custom URL scheme or just the code)
    // The code might be embedded in lrride://share/CODE or https://lrride-server.onrender.com/share/CODE
    const shareUrlPattern = /(?:lrride:\/\/|https:\/\/(?:[^\/]+\/)?)share\/([A-Z0-9]+)/i
    const shareUrlMatch = data.match(shareUrlPattern)
    
    // Or if they just scanned the raw share code (e.g. 8-12 alphanumeric characters)
    const rawShareCodePattern = /^([A-Z0-9]{6,12})$/i
    const rawShareCodeMatch = data.match(rawShareCodePattern)

    const shareCode = shareUrlMatch?.[1] || rawShareCodeMatch?.[1]
    
    if (shareCode && onShareCodeScanned) {
      onShareCodeScanned(shareCode.toUpperCase())
      return
    }

    // If no valid format found, show an alert
    const { Alert } = require('react-native')
    Alert.alert('Invalid QR', 'This barcode is not a valid ride code.')
  }

  const handleLocateUser = async () => {
    setLocationStatus('unknown')
    setLocationMessage(null)

    try {
      const granted = await requestLocationPermission()
      if (!granted) {
        setLocationStatus('denied')
        setLocationMessage('Location permission is required to use this feature.')
        return
      }

      const coords = await getCurrentLocation()
      
      if (isWithinServiceArea(coords)) {
        setLocationStatus('granted')
      } else {
        setLocationStatus('outOfAxis')
        setLocationMessage('You appear to be outside the service area.')
      }

      setUserLocation(coords)
      mapRef.current?.animateToRegion(
        { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 },
        500,
      )
    } catch (err: any) {
      setLocationStatus('error')
      setUserLocation(null)
      setLocationMessage('An unexpected error occurred while fetching your location.')
    }
  }

  const locationIconColor =
    locationStatus === 'granted'
      ? '#0fa958'
      : locationStatus === 'outOfAxis'
        ? '#d14343'
        : '#9ca3af'

  const modalItems = activeModal ? ALL_LOCATIONS.filter((l) => l.category === activeModal) : []

  return (
    <View style={styles.page}>
      <View style={styles.mapCanvas}>
        <MapView
          key={mapInstanceKey}
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={currentMapRegion}
          onMapReady={handleMapReady}
          onMapLoaded={handleMapReady}
          onRegionChangeComplete={handleRegionChangeComplete}
          onPress={() => setActivePin(null)}
          mapType="standard"
          zoomEnabled
          scrollEnabled
          rotateEnabled={false}
          pitchEnabled
          minZoomLevel={10}
          maxZoomLevel={18}
          showsCompass
          showsScale
          loadingEnabled
          loadingIndicatorColor="#0fa958"
          loadingBackgroundColor="#f3f3f3"
        >
          {userLocation && (
            <Marker
              coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
              tracksViewChanges={false}
            >
              <View style={styles.userMarkerOuter}>
                <View style={styles.userMarkerInner} />
              </View>
            </Marker>
          )}
          {activePin && (
            <Circle
              center={{ latitude: activePin.latitude, longitude: activePin.longitude }}
              radius={HIGHLIGHT_RADIUS_METERS}
              strokeColor="rgba(255, 82, 82, 0.9)"
              fillColor="rgba(255, 82, 82, 0.16)"
              strokeWidth={2}
            />
          )}
          {activePin && (
            <Marker
              ref={markerRef}
              coordinate={{ latitude: activePin.latitude, longitude: activePin.longitude }}
              tracksViewChanges={false}
              pinColor="#EA4335"
            >

              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>{activePin.name}</Text>
                  <Text style={styles.calloutDesc}>{activePin.description}</Text>
                  <View style={styles.calloutDivider} />
                  <View style={styles.calloutFooter}>
                    <MaterialIcons name="location-on" size={12} color="#FF5252" />
                    <Text style={styles.calloutCoords}>
                      {activePin.latitude.toFixed(4)}, {activePin.longitude.toFixed(4)}
                    </Text>
                  </View>
                </View>
                <View style={styles.calloutArrow} />
              </Callout>
            </Marker>
          )}
        </MapView>

        {!isMapReady && (
          <View style={styles.mapLoadingBadge}>
            <MaterialIcons name="map" size={16} color="#5e5e5e" />
            <Text style={styles.mapLoadingText}>Loading Minna map...</Text>
          </View>
        )}

        {didMapTimeout && (
          <View style={styles.mapErrorCard}>
            <Text style={styles.mapErrorTitle}>Map is taking longer than expected</Text>
            <Text style={styles.mapErrorBody}>Check network and retry.</Text>
            <TouchableOpacity style={styles.mapRetryButton} onPress={retryMapRender} activeOpacity={0.85}>
              <Text style={styles.mapRetryText}>Retry map</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="#5e5e5e" />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => {
              setSearchActive(true)
              setIsActionPanelExpanded(false)
            }}
            onBlur={() => setSearchActive(false)}
            onTouchStart={() => {
              if (searchInputRef.current?.isFocused()) {
                searchInputRef.current.blur()
                setSearchActive(false)
              }
            }}
            placeholder="Find location in Minna"
            placeholderTextColor="#5e5e5e"
            returnKeyType="search"
            underlineColorAndroid="transparent"
          />
          <TouchableOpacity style={styles.recenterButton} onPress={handleLocateUser} activeOpacity={0.85}>
            <MaterialIcons name="my-location" size={16} color={locationIconColor} />
          </TouchableOpacity>
        </View>

        {searchResultsVisible && (
          <View style={styles.searchResultsContainer}>
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={styles.searchResultsList}
                contentContainerStyle={styles.searchResultsContent}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchResultItem}
                    onPress={() => {
                      setSearchActive(false)
                      setSearchQuery('')
                      searchInputRef.current?.blur()
                      flyToLocation(item)
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.searchResultHeader}>
                      <Text style={styles.searchResultName}>{item.name}</Text>
                      <Text style={styles.searchResultCategory}>{item.category}</Text>
                    </View>
                    <Text style={styles.searchResultDescription}>{item.description}</Text>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.searchResultSeparator} />}
              />
            ) : (
              <View style={styles.searchNoResults}>
                <Text style={styles.searchNoResultsText}>No matching locations found.</Text>
              </View>
            )}
          </View>
        )}

        {locationMessage ? (
          <View style={styles.locationBanner}>
            <MaterialIcons name="info" size={16} color="#1a1c1c" />
            <Text style={styles.locationBannerText}>{locationMessage}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.bottomSheet, !isActionPanelExpanded && styles.bottomSheetCollapsed]}>
        <TouchableOpacity style={styles.sheetHeaderButton} onPress={toggleActionPanel} activeOpacity={0.85}>
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetHeaderTitle}>
              {isActionPanelExpanded ? 'Hide' : 'Show'}
            </Text>

            <MaterialIcons
              name={isActionPanelExpanded ? 'keyboard-arrow-down' : 'keyboard-arrow-up'}
              size={22}
              color="#5e5e5e"
            />

            <View style={styles.sheetHandleCenter} pointerEvents="none">
              <View style={styles.sheetHandle} />
            </View>
          </View>
        </TouchableOpacity>

        {isActionPanelExpanded && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickAccessRow}
              style={styles.quickAccessScroll}
            >
              {QUICK_ITEMS.filter(item => enabledCategories.includes(item.category)).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.quickButton}
                  onPress={() => handleQuickPress(item)}
                  activeOpacity={0.75}
                >
                  <View style={[
                    styles.quickIconWrapper,
                    activePin?.category === item.category && styles.quickIconActive,
                  ]}>
                    <MaterialIcons
                      name={item.icon}
                      size={20}
                      color={activePin?.category === item.category ? '#ffffff' : '#9937d6'}
                    />
                  </View>
                  <Text style={styles.quickLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.walletCard}>
              <View style={styles.walletInfo}>
                <TouchableOpacity
                  style={styles.walletIcon}
                  onPress={() => setUIHideBalance(!hideBalance)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="account-balance-wallet"
                    size={18}
                    color={hideBalance ? '#9ca3af' : '#6A1B9A'}
                  />
                </TouchableOpacity>
                <View>
                  <Text style={styles.walletLabel}>Wallet Balance</Text>
                  <Text style={styles.walletValue}>
                    {hideBalance ? '●●●●●●' : formatAmount(walletBalance)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.topUpButton} onPress={onNavigateToWallet}>
                <Text style={styles.topUpText}>Top Up</Text>
                <MaterialIcons name="add" size={16} color="#1a1c1c" />
              </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
              {activeRide ? (
                <TouchableOpacity style={styles.bookRideButton} onPress={onViewRideStatus}>
                  <MaterialIcons name="directions-car" size={18} color="#ffffff" />
                  <Text style={styles.bookRideText}>Ride Status</Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.bookRideButton, locationStatus === 'outOfAxis' && styles.bookRideButtonDisabled]}
                  disabled={locationStatus === 'outOfAxis'}
                  onPress={onBookRide}
                >
                  <Text style={[styles.bookRideText, locationStatus === 'outOfAxis' && styles.bookRideTextDisabled]}>
                    Book Ride
                  </Text>
                  <MaterialIcons
                    name="arrow-forward"
                    size={18}
                    color={locationStatus === 'outOfAxis' ? '#f3f3f3' : '#ffffff'}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.scanButton, isScanDisabled && styles.scanButtonDisabled]}
                onPress={handleOpenScanner}
                disabled={isScanDisabled}
              >
                <MaterialIcons name="qr-code-scanner" size={20} color={isScanDisabled ? '#b0b0b0' : '#9937d6'} />
                <Text style={[styles.scanText, isScanDisabled && styles.scanTextDisabled]}>Scan</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <Modal
        visible={!!activeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActiveModal(null)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {activeModal ? MODAL_CATEGORIES[activeModal] : ''}
            </Text>
            <FlatList
              data={modalItems}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  activeOpacity={0.75}
                  onPress={() => flyToLocation(item)}
                >
                  <View style={styles.modalItemIcon}>
                    <MaterialIcons name="place" size={18} color="#9937d6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemName}>{item.name}</Text>
                    <Text style={styles.modalItemSub}>{item.description}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#dadada" />
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={scannerVisible}
        animationType="fade"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerFull}>
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleScan}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrameBox} />
          </View>
          <View style={[styles.scannerTopBar, { paddingTop: Math.max(insets.top, 10) }]}>
            <TouchableOpacity style={styles.scannerClose} onPress={() => setScannerVisible(false)}>
              <MaterialIcons name="close" size={20} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scan QR Code</Text>
            <View style={styles.scannerSpacer} />
          </View>
          <View style={styles.scannerHintWrap}>
            <Text style={styles.scannerHint}>Align the QR code within the frame</Text>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  mapCanvas: { flex: 1 },
  map: { width: '100%', height: '100%' },
  pinDrop: { alignItems: 'center', justifyContent: 'center' },

  userMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(15,169,88,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0fa958',
  },
  callout: {
    backgroundColor: '#ffffff', borderRadius: 10, padding: 12,
    minWidth: 180, maxWidth: 240, elevation: 6,
    borderWidth: 1, borderColor: '#e2e2e2',
  },
  calloutName: { fontSize: 14, fontWeight: '700', color: '#1a1c1c', marginBottom: 4 },
  calloutDesc: { fontSize: 12, color: '#5e5e5e', lineHeight: 16 },
  calloutDivider: { height: 1, backgroundColor: '#f3f3f3', marginVertical: 8 },
  calloutFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calloutCoords: { fontSize: 11, color: '#9937d6' },
  calloutArrow: {
    width: 12, height: 12, backgroundColor: '#ffffff',
    alignSelf: 'center', marginTop: -2,
    transform: [{ rotate: '45deg' }],
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#e2e2e2',
  },
  mapLoadingBadge: {
    position: 'absolute', top: 74, alignSelf: 'center',
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e2e2',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
    flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 3,
  },
  mapLoadingText: { fontSize: 12, fontWeight: '600', color: '#5e5e5e' },
  mapErrorCard: {
    position: 'absolute', top: 116, left: 20, right: 20,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e2e2',
    borderRadius: 12, padding: 12, alignItems: 'center',
  },
  mapErrorTitle: { fontSize: 14, fontWeight: '700', color: '#1a1c1c' },
  mapErrorBody: { marginTop: 4, fontSize: 12, color: '#5e5e5e' },
  mapRetryButton: {
    marginTop: 10, backgroundColor: '#0fa958',
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
  },
  mapRetryText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  searchBar: {
    position: 'absolute', top: 16, left: 20, right: 20,
    backgroundColor: '#ffffff', borderRadius: 999, borderWidth: 1, borderColor: '#e2e2e2',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, elevation: 4,
    zIndex: 10,
  },
  searchInput: {
    marginLeft: 8,
    flex: 1,
    fontSize: 16,
    color: '#1a1c1c',
    padding: 0,
    minHeight: 20,
  },
  searchPlaceholder: { marginLeft: 8, fontSize: 16, color: '#5e5e5e', flex: 1 },
  searchResultsContainer: {
    position: 'absolute',
    top: 72,
    left: 20,
    right: 20,
    maxHeight: 260,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    paddingVertical: 8,
    paddingHorizontal: 0,
    elevation: 6,
    zIndex: 9,
  },
  searchResultsList: {
    width: '100%',
  },
  searchResultsContent: {
    paddingVertical: 4,
  },
  searchResultItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  searchResultCategory: {
    fontSize: 11,
    color: '#5e5e5e',
    textTransform: 'capitalize',
  },
  searchResultDescription: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b6b6b',
  },
  searchResultSeparator: {
    height: 1,
    backgroundColor: '#f2f2f2',
    marginHorizontal: 16,
  },
  searchNoResults: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  searchNoResultsText: {
    color: '#5e5e5e',
    fontSize: 13,
  },
  recenterButton: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center',
  },
  locationBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  locationBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#1a1c1c',
  },
  bottomSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 10, paddingBottom: 24, paddingTop: 12, elevation: 10,
  },
  bottomSheetCollapsed: { paddingBottom: 12 },
  sheetHandle: {
    width: 48, height: 4, borderRadius: 999,
    backgroundColor: '#dadada', alignSelf: 'center', marginBottom: 10,
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
  sheetHeaderButton: { marginBottom: 6 },
  sheetHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 4,
  },
  sheetHeaderTitle: { fontSize: 13, fontWeight: '700', color: '#5e5e5e' },
  quickAccessScroll: { marginBottom: 14 },
  quickAccessRow: { paddingRight: 8, gap: 8 },
  quickButton: { alignItems: 'center', width: 64 },
  quickIconWrapper: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#f3f3f3', alignItems: 'center',
    justifyContent: 'center', marginBottom: 6,
  },
  quickIconActive: { backgroundColor: '#6A1B9A' },
  quickLabel: { fontSize: 11, fontWeight: '600', color: '#3d4a3e', textAlign: 'center' },
  walletCard: {
    backgroundColor: '#eeeeee', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#e2e2e2',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 18,
  },
  walletInfo: { flexDirection: 'row', alignItems: 'center' },
  walletIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#ffffff', alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  walletLabel: { fontSize: 12, fontWeight: '600', color: '#5e5e5e' },
  walletValue: { fontSize: 20, fontWeight: '700', color: '#1a1c1c', marginTop: 2 },
  topUpButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dadada',
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
  },
  topUpText: { fontSize: 14, fontWeight: '600', color: '#1a1c1c', marginRight: 4 },
  bookRideButton: {
    flex: 1,
    backgroundColor: '#6A1B9A',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  bookRideButtonDisabled: {
    backgroundColor: '#c9c9c9',
  },
  bookRideText: { color: '#ffffff', fontSize: 16, fontWeight: '600', marginRight: 6 },
  bookRideTextDisabled: {
    color: '#f3f3f3',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scanButton: {
    width: 110,
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  scanButtonDisabled: {
    backgroundColor: '#f3f3f3',
    borderColor: '#dadada',
  },
  scanText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  scanTextDisabled: {
    color: '#b0b0b0',
  },
  scannerFull: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  scannerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerSpacer: {
    width: 36,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrameBox: {
    width: 340,
    height: 340,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 20,
  },
  scannerHintWrap: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  scannerHint: {
    textAlign: 'center',
    fontSize: 13,
    color: '#ffffff',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: 32, maxHeight: '60%',
  },
  modalHandle: {
    width: 48, height: 4, borderRadius: 999,
    backgroundColor: '#dadada', alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1a1c1c', paddingHorizontal: 20, marginBottom: 8 },
  modalDivider: { height: 1, backgroundColor: '#f3f3f3', marginLeft: 72 },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  modalItemIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f3f3f3', alignItems: 'center',
    justifyContent: 'center', marginRight: 16,
  },
  modalItemName: { fontSize: 14, fontWeight: '600', color: '#1a1c1c' },
  modalItemSub: { fontSize: 12, color: '#5e5e5e', marginTop: 2 },
})
