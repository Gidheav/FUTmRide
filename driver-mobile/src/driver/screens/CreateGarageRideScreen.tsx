import React, { useMemo, useRef, useState, useEffect } from "react"
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, useWindowDimensions } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import LoadingOverlay from "../components/LoadingOverlay"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import QRCode from "react-native-qrcode-svg"
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps"
import Constants from "expo-constants"
import api, { driverApi } from "../../core/api"
import { COLORS, FONTS, AMBIENT_SHADOW } from "../../core/theme"
import { useGarageRideStore } from "../../core/garageRideStore"
import { useDriverRidesStore } from "../../core/driverRidesStore"
import { useLocations } from "../../core/locationDataService"

type CreateGarageRideScreenProps = { onBack: () => void }
type LocationOption = { id: string; label: string; description: string; latitude: number; longitude: number }

const filterLocations = (query: string, locations: LocationOption[]) => {
  const n = query.trim().toLowerCase()
  if (!n) return locations
  return locations.filter((i) => `${i.label} ${i.description}`.toLowerCase().includes(n))
}
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371, r = (v: number) => (v * Math.PI) / 180
  const dLat = r(lat2 - lat1), dLng = r(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
const fmtCur = (v: number | null) => v === null || isNaN(v) ? "---" : `N${v.toFixed(0)}`
const fmtDist = (v: number | null) => v === null || isNaN(v) ? "-- km" : `${v.toFixed(2)} km`
const rc = (v: number) => Number(v.toFixed(6))

const GOOGLE_API_KEY = Constants.expoConfig?.android?.config?.googleMaps?.apiKey || ""

const decodePolyline = (encoded: string): { latitude: number; longitude: number }[] => {
  const pts: { latitude: number; longitude: number }[] = []
  let idx = 0, lat = 0, lng = 0
  while (idx < encoded.length) {
    let b: number, shift = 0, result = 0
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : result >> 1
    pts.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
  }
  return pts
}

const fetchDirectionsRoute = async (
  o: LocationOption,
  d: LocationOption,
): Promise<{ coords: { latitude: number; longitude: number }[]; distanceKm: number } | null> => {
  if (!GOOGLE_API_KEY) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${o.latitude},${o.longitude}&destination=${d.latitude},${d.longitude}&key=${GOOGLE_API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.routes?.length) {
      const leg = data.routes[0].legs?.[0]
      const distanceKm = leg?.distance?.value ? leg.distance.value / 1000 : 0
      const coords = decodePolyline(data.routes[0].overview_polyline.points)
      return { coords, distanceKm }
    }
  } catch { /* fall back to straight line */ }
  return null
}

export default function CreateGarageRideScreen({ onBack }: CreateGarageRideScreenProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const {
    garageRide: cachedGarageRide, garagePassengers: cachedGaragePassengers,
    setGarageRide: setCachedGarageRide, setGaragePassengers: setCachedGaragePassengers,
    savedRoutes, setSavedRoutes, driverProfile, setDriverProfile,
  } = useDriverRidesStore()

  const [origin, setOrigin] = useState<LocationOption | null>(null)
  const [destination, setDestination] = useState<LocationOption | null>(null)
  const [seats, setSeats] = useState(4)
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null)
  const [isTaring, setIsTaring] = useState(false)
  const [isTared, setIsTared] = useState(false)
  const [saveRoute, setSaveRoute] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hydrating, setHydrating] = useState(!cachedGarageRide)
  const [isUpdatingRide, setIsUpdatingRide] = useState(false)
  const [locationPickerOpen, setLocationPickerOpen] = useState<null | "origin" | "destination">(null)
  const [locationQuery, setLocationQuery] = useState("")
  const [isSavedRoutesOpen, setIsSavedRoutesOpen] = useState(false)
  const [ride, setRide] = useState<any>(cachedGarageRide)
  const [passengers, setPassengers] = useState<any[]>(cachedGaragePassengers)
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[] | null>(null)
  const { setStatus } = useGarageRideStore()
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const syncInFlightRef = useRef(false)
  const mapRef = useRef<MapView>(null)
  const ACTIVE_STATUSES = new Set(["open", "full", "departed"])

  useEffect(() => () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current) }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await api.get("rides/garage/mine/")
        const list = Array.isArray(res.data) ? res.data : res.data?.results || []
        const active = list.find((i: any) => ACTIVE_STATUSES.has(i.status)) || null
        if (!mounted) return
        if (active) { setRide(active); setCachedGarageRide(active); startPolling(active.id); setStatus("active") }
      } catch { /* ignore */ } finally { if (mounted) setHydrating(false) }
    })()
    return () => { mounted = false }
  }, [])

  const rawLocations = useLocations()
  const locations = useMemo(() => rawLocations.map((loc) => ({
    id: loc.id, label: loc.name, description: loc.description,
    latitude: Number(loc.latitude), longitude: Number(loc.longitude),
  })), [rawLocations])

  const filteredLocations = useMemo(() => {
    let list = locations
    if (locationPickerOpen === "origin" && destination) list = list.filter((l) => l.id !== destination.id)
    if (locationPickerOpen === "destination" && origin) list = list.filter((l) => l.id !== origin.id)
    return filterLocations(locationQuery, list)
  }, [locationQuery, locations, locationPickerOpen, origin, destination])

  useEffect(() => {
    let mounted = true
    if (!driverProfile) {
      driverApi.getProfile().then((res) => { if (mounted) setDriverProfile({ vehicle_type: res?.data?.vehicle_type || null }) }).catch(() => {})
    }
    return () => { mounted = false }
  }, [driverProfile, setDriverProfile])

  useEffect(() => {
    let mounted = true
    if (savedRoutes.length === 0 && !syncInFlightRef.current) {
      syncInFlightRef.current = true
      driverApi.getSavedRoutes().then((res) => {
        const list = Array.isArray(res?.data) ? res.data : res?.data?.results || []
        if (mounted) setSavedRoutes(list)
      }).catch(() => {}).finally(() => { syncInFlightRef.current = false })
    }
    return () => { mounted = false }
  }, [savedRoutes.length, setSavedRoutes])

  // Fit map + auto-tare whenever both endpoints change
  useEffect(() => {
    if (!origin || !destination) { setRouteCoords(null); setDistanceKm(null); setEstimatedFare(null); setIsTared(false); return }

    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [{ latitude: origin.latitude, longitude: origin.longitude }, { latitude: destination.latitude, longitude: destination.longitude }],
        { edgePadding: { top: 80, right: 40, bottom: 260, left: 40 }, animated: true }
      )
    }, 300)

    setIsTared(false)
    setDistanceKm(null)
    setEstimatedFare(null)

    let cancelled = false
    ;(async () => { await runTare(origin, destination, () => cancelled) })()
    return () => { cancelled = true }
  }, [origin?.id, destination?.id])

  const getVehicleType = () => driverProfile?.vehicle_type ? String(driverProfile.vehicle_type).toLowerCase() : "sedan"
  const getMaxSeats = () => {
    const v = getVehicleType()
    if (v === "suv") return 7
    if (v === "minibus") return 14
    if (v === "coaster") return 30
    return 4
  }

  const runTare = async (o: LocationOption, d: LocationOption, isCancelled: () => boolean = () => false) => {
    if (isCancelled()) return
    setIsTaring(true)
    setIsTared(false)
    try {
      const dirResult = await fetchDirectionsRoute(o, d)
      if (isCancelled()) return
      const roadKm = dirResult?.distanceKm && dirResult.distanceKm > 0
        ? dirResult.distanceKm
        : haversineKm(o.latitude, o.longitude, d.latitude, d.longitude)
      if (!isCancelled() && dirResult?.coords) setRouteCoords(dirResult.coords)
      if (!isCancelled()) setDistanceKm(roadKm)
      const res = await driverApi.pricingEstimate({ vehicle_type: getVehicleType(), distance_km: Number(roadKm.toFixed(2)), surge_multiplier: 1.0 })
      if (isCancelled()) return
      setEstimatedFare(Number(res?.data?.total_fare || 0))
      setIsTared(true)
    } catch { /* stay un-tared */ } finally { if (!isCancelled()) setIsTaring(false) }
  }

  const handleSelectLocation = (item: LocationOption) => {
    if (locationPickerOpen === "origin") setOrigin(item)
    else setDestination(item)
    setLocationQuery(""); setLocationPickerOpen(null)
  }

  const handleSwapRoute = () => {
    if (!origin || !destination) return
    setOrigin(destination); setDestination(origin)
  }

  const handleUseSavedRoute = (route: any) => {
    const o = { id: route.id || "s-o", label: route.origin_address, description: "", latitude: rc(Number(route.origin_latitude)), longitude: rc(Number(route.origin_longitude)) }
    const d = { id: route.id || "s-d", label: route.destination_address, description: "", latitude: rc(Number(route.destination_latitude)), longitude: rc(Number(route.destination_longitude)) }
    setOrigin(o); setDestination(d)
    if (route?.id && !String(route.id).startsWith("local-")) {
      const t = new Date().toISOString()
      upsertSavedRoute({ ...route, last_used_at: t })
      driverApi.updateSavedRoute(route.id, { last_used_at: t }).catch(() => {})
    }
    setIsSavedRoutesOpen(false)
  }

  const upsertSavedRoute = (route: any) => {
    const next = [...savedRoutes]; const idx = next.findIndex((i) => i.id === route.id)
    if (idx >= 0) next[idx] = route; else next.unshift(route)
    setSavedRoutes(next)
  }

  const handleCreate = async () => {
    if (!origin || !destination) { Alert.alert("Missing fields", "Select origin and destination."); return }
    if (!isTared) { void runTare(origin, destination); return }
    setLoading(true)
    try {
      const dist = Number((distanceKm ?? haversineKm(origin.latitude, origin.longitude, destination.latitude, destination.longitude)).toFixed(2))
      const fare = estimatedFare
      if (!fare || isNaN(fare)) { Alert.alert("Pricing unavailable", "Unable to calculate fare. Tap Distance to recalibrate."); return }
      const payload = {
        origin_address: origin.label, origin_latitude: rc(origin.latitude), origin_longitude: rc(origin.longitude),
        destination_address: destination.label, destination_latitude: rc(destination.latitude), destination_longitude: rc(destination.longitude),
        estimated_distance_km: dist,
        estimated_route_geometry: routeCoords?.length ? routeCoords.map((point) => ({ latitude: rc(point.latitude), longitude: rc(point.longitude) })) : [],
        vehicle_type: getVehicleType(), total_seats: seats, fare_per_seat: Number(fare),
      }
      const res = await api.post("rides/garage/create/", payload)
      const createdRide = {
        ...res.data,
        estimated_distance_km: res.data?.estimated_distance_km ?? payload.estimated_distance_km,
        estimated_route_geometry: Array.isArray(res.data?.estimated_route_geometry) && res.data.estimated_route_geometry.length
          ? res.data.estimated_route_geometry
          : payload.estimated_route_geometry,
      }
      setRide(createdRide); setCachedGarageRide(createdRide); setCachedGaragePassengers([])
      startPolling(createdRide.id); setStatus("active")
      if (saveRoute) {
        const oLbl = origin.label, dLbl = destination.label
        const dup = savedRoutes.some((i: any) =>
          (i.origin_address === oLbl && i.destination_address === dLbl) ||
          (i.origin_address === dLbl && i.destination_address === oLbl)
        )
        if (!dup) {
          const tmp: any = { id: `local-${Date.now()}`, name: "", origin_address: oLbl, origin_latitude: rc(origin.latitude), origin_longitude: rc(origin.longitude), destination_address: dLbl, destination_latitude: rc(destination.latitude), destination_longitude: rc(destination.longitude), distance_km: dist, last_used_at: new Date().toISOString() }
          upsertSavedRoute(tmp)
          driverApi.createSavedRoute({ name: tmp.name, origin_address: tmp.origin_address, origin_latitude: tmp.origin_latitude, origin_longitude: tmp.origin_longitude, destination_address: tmp.destination_address, destination_latitude: tmp.destination_latitude, destination_longitude: tmp.destination_longitude, distance_km: tmp.distance_km, last_used_at: tmp.last_used_at }).then((r: any) => {
            if (r?.data?.id) { const nxt = savedRoutes.filter((i: any) => !String(i.id).startsWith("local-") || !(i.origin_address === oLbl && i.destination_address === dLbl)); nxt.unshift(r.data); setSavedRoutes(nxt) }
          }).catch(() => {})
        }
      }
    } catch (err: any) { Alert.alert("Error", err?.response?.data?.error?.message || "Could not create garage ride.") }
    finally { setLoading(false) }
  }

  const startPolling = (rideId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    const fetchP = async () => {
      try { const res = await api.get(`rides/garage/${rideId}/passengers/`); const list = res.data?.results || res.data || []; setPassengers(list); setCachedGaragePassengers(list) } catch { /* ignore */ }
    }
    fetchP(); pollIntervalRef.current = setInterval(fetchP, 5000)
  }

  const handleDepart = () => {
    if (!ride || ride.status === "departed" || isUpdatingRide) return
    Alert.alert("Depart", "Close boarding and depart now?", [
      { text: "Cancel", style: "cancel" },
      { text: "Depart", onPress: async () => {
        try { setIsUpdatingRide(true); const res = await api.post(`rides/garage/${ride.id}/depart/`); const next = res?.data || ride; setRide(next); setCachedGarageRide(next) }
        catch (err: any) { Alert.alert("Error", err?.response?.data?.error?.message || "Failed.") }
        finally { setIsUpdatingRide(false) }
      } },
    ])
  }

  const handleComplete = async () => {
    if (!ride || isUpdatingRide || ride.status !== "departed") return
    try { setIsUpdatingRide(true); await api.post(`rides/garage/${ride.id}/complete/`); Alert.alert("Completed", "Ride completed!"); setRide(null); setPassengers([]); setCachedGarageRide(null); setCachedGaragePassengers([]); setStatus("inactive"); onBack() }
    catch (err: any) { Alert.alert("Error", err?.response?.data?.error?.message || "Failed.") }
    finally { setIsUpdatingRide(false) }
  }

  const handleCancel = () => {
    if (!ride) return
    Alert.alert("Cancel Ride", "Cancel and refund all passengers?", [
      { text: "No", style: "cancel" },
      { text: "Yes, Cancel", style: "destructive", onPress: async () => {
        try { await api.post(`rides/garage/${ride.id}/cancel/`); setRide(null); setPassengers([]); setCachedGarageRide(null); setCachedGaragePassengers([]); setStatus("inactive"); onBack() }
        catch (err: any) { Alert.alert("Error", err?.response?.data?.error?.message || "Failed.") }
      } },
    ])
  }

  if (hydrating && !ride) {
    return <View style={[s.page, { paddingTop: insets.top, alignItems: "center", justifyContent: "center" }]}><LoadingOverlay visible={true} inline size={48} /></View>
  }

  if (ride) {
    const totalEarnings = passengers.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0)
    const bookedSeats = passengers.reduce((sum: number, p: any) => sum + p.seats_booked, 0)
    const isDeparted = ride.status === "departed"
    const qrSize = Math.min(Math.max(width - 120, 220), 280)
    return (
      <View style={[s.page, { paddingTop: 0 }]}>
        <ScrollView contentContainerStyle={[s.boardingContent, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={s.qrCard}>
            <View style={s.qrWrapper}>
              <QRCode value={ride.qr_token} size={qrSize} color="#111" backgroundColor="#fff" />
            </View>
            <Text style={s.rideRef}>#{ride.reference}</Text>
            <Text style={s.qrCaption}>Students scan to pay and board</Text>
          </View>

          <View style={s.boardingActions}>
            {!isDeparted && (
              <TouchableOpacity style={s.inlineCancelBtn} onPress={handleCancel} disabled={isUpdatingRide} activeOpacity={0.85}>
                <MaterialIcons name="close" size={18} color={COLORS.error} />
                <Text style={s.inlineCancelTxt}>Cancel</Text>
              </TouchableOpacity>
            )}
            {isDeparted
              ? <TouchableOpacity style={[s.inlinePrimaryBtn, { backgroundColor: "#2E7D32" }]} onPress={handleComplete} disabled={isUpdatingRide} activeOpacity={0.85}><MaterialIcons name="check-circle-outline" size={19} color="#fff" /><Text style={s.inlinePrimaryTxt}>Complete Ride</Text></TouchableOpacity>
              : <TouchableOpacity style={s.inlinePrimaryBtn} onPress={handleDepart} disabled={isUpdatingRide} activeOpacity={0.85}><MaterialIcons name="directions-car" size={19} color="#fff" /><Text style={s.inlinePrimaryTxt}>Depart Now</Text></TouchableOpacity>
            }
          </View>

          <View style={s.boardingSummary}>
            <View style={s.summaryItem}>
              <MaterialIcons name="event-seat" size={16} color={COLORS.primary} />
              <Text style={s.summaryText}>{bookedSeats}/{ride.total_seats}</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <MaterialIcons name="payments" size={16} color="#2E7D32" />
              <Text style={[s.summaryText, { color: "#2E7D32" }]}>N{totalEarnings.toLocaleString()}</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <MaterialIcons name="confirmation-number" size={16} color={COLORS.onSurfaceVariant} />
              <Text style={s.summaryText}>{ride.fare_per_seat ? `N${Number(ride.fare_per_seat).toFixed(0)}` : "--"}</Text>
            </View>
          </View>
          <Text style={s.sectionTitle}>Passengers <Text style={s.sectionCount}>{passengers.length}</Text></Text>
          {passengers.length === 0
            ? <View style={s.emptyBox}><MaterialIcons name="people-outline" size={32} color={COLORS.surfaceContainerHighest} /><Text style={s.emptyTxt}>Waiting for passengers</Text></View>
            : passengers.map((p: any) => (
              <View key={p.id} style={s.pRow}>
                <View style={s.pAvatar}><MaterialIcons name="person" size={17} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pName}>{p.student?.full_name || "Student"}</Text>
                  <Text style={s.pMeta}>{p.seats_booked} seat{p.seats_booked > 1 ? "s" : ""} · N{Number(p.amount_paid).toLocaleString()}</Text>
                </View>
                <MaterialIcons name="check-circle" size={16} color="#2E7D32" />
              </View>
            ))
          }
        </ScrollView>
        <LoadingOverlay visible={isUpdatingRide} />
      </View>
    )
  }

  const mapRegion = origin && destination
    ? { latitude: (origin.latitude + destination.latitude) / 2, longitude: (origin.longitude + destination.longitude) / 2, latitudeDelta: Math.abs(origin.latitude - destination.latitude) * 2 + 0.04, longitudeDelta: Math.abs(origin.longitude - destination.longitude) * 2 + 0.04 }
    : origin ? { latitude: origin.latitude, longitude: origin.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : { latitude: 9.6171, longitude: 6.5492, latitudeDelta: 0.05, longitudeDelta: 0.05 }

  return (
    <View style={[s.page, { paddingTop: 0 }]}>
      <MapView ref={mapRef} style={StyleSheet.absoluteFillObject} provider={PROVIDER_GOOGLE} region={mapRegion} showsUserLocation>
        {origin && <Marker coordinate={{ latitude: origin.latitude, longitude: origin.longitude }} pinColor="green" title="Origin" tracksViewChanges={false} />}
        {destination && <Marker coordinate={{ latitude: destination.latitude, longitude: destination.longitude }} pinColor="red" title="Destination" tracksViewChanges={false} />}
        {origin && destination && (
          routeCoords && routeCoords.length > 1
            ? <Polyline coordinates={routeCoords} strokeColor={COLORS.primary} strokeWidth={3} />
            : <Polyline coordinates={[{ latitude: origin.latitude, longitude: origin.longitude }, { latitude: destination.latitude, longitude: destination.longitude }]} strokeColor={COLORS.primary} strokeWidth={2} lineDashPattern={[6, 4]} />
        )}
      </MapView>

      <View style={s.formPanel}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={s.formScroll}>
            <View style={s.routeCard}>
              <TouchableOpacity style={s.locRow} onPress={() => setLocationPickerOpen("origin")}>
                <View style={s.dotGreen} />
                <View style={{ flex: 1 }}>
                  <Text style={s.locLbl}>From</Text>
                  <Text style={[s.locVal, !origin && s.locPlaceholder]} numberOfLines={1}>{origin?.label || "Select pickup"}</Text>
                </View>
                <MaterialIcons name="edit" size={15} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
              <View style={s.divRow}>
                <View style={s.divLine} />
                {origin && destination && <TouchableOpacity style={s.swapBtn} onPress={handleSwapRoute}><MaterialIcons name="swap-vert" size={15} color={COLORS.primary} /></TouchableOpacity>}
              </View>
              <TouchableOpacity style={s.locRow} onPress={() => setLocationPickerOpen("destination")}>
                <View style={s.dotRed} />
                <View style={{ flex: 1 }}>
                  <Text style={s.locLbl}>To</Text>
                  <Text style={[s.locVal, !destination && s.locPlaceholder]} numberOfLines={1}>{destination?.label || "Select destination"}</Text>
                </View>
                <MaterialIcons name="edit" size={15} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={s.metricsCard}>
              <TouchableOpacity style={s.metric} onPress={() => origin && destination && runTare(origin, destination)} activeOpacity={0.7}>
                <Text style={s.metLbl}>Distance</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={s.metVal}>{fmtDist(distanceKm)}</Text>
                  {isTaring && <MaterialIcons name="sync" size={12} color={COLORS.primary} />}
                </View>
              </TouchableOpacity>
              <View style={s.metDivider} />
              <View style={s.metric}>
                <Text style={s.metLbl}>Fare / Seat</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={s.metVal}>{fmtCur(estimatedFare)}</Text>
                  {isTaring && <MaterialIcons name="sync" size={12} color={COLORS.primary} />}
                </View>
              </View>
              <View style={s.metDivider} />
              <View style={[s.metric, { flex: 1.2 }]}>
                <Text style={s.metLbl}>Seats</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <TouchableOpacity onPress={() => setSeats(Math.max(1, seats - 1))} disabled={seats <= 1}>
                    <MaterialIcons name="remove-circle-outline" size={22} color={seats <= 1 ? COLORS.surfaceContainerHighest : COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={s.seatsInput}>{seats}</Text>
                  <TouchableOpacity onPress={() => setSeats(Math.min(getMaxSeats(), seats + 1))} disabled={seats >= getMaxSeats()}>
                    <MaterialIcons name="add-circle-outline" size={22} color={seats >= getMaxSeats() ? COLORS.surfaceContainerHighest : COLORS.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          <View style={[s.actionBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={s.actionBarLeft}>
              {savedRoutes.length > 0 && (
                <TouchableOpacity style={s.savedPill} onPress={() => setIsSavedRoutesOpen(true)}>
                  <MaterialIcons name="bookmark" size={13} color={COLORS.primary} />
                  <Text style={s.savedPillTxt}>View</Text>
                  <MaterialIcons name="chevron-right" size={13} color={COLORS.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setSaveRoute(!saveRoute)} style={{ padding: 4 }}>
                <MaterialIcons name={saveRoute ? "bookmark" : "bookmark-border"} size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[s.createBtn, (!origin || !destination || loading) && s.createBtnOff, !isTared && origin && destination && { backgroundColor: "#6750A4" }]}
              onPress={isTared ? handleCreate : () => origin && destination && runTare(origin, destination)}
              disabled={loading || isTaring || !origin || !destination}
              activeOpacity={0.85}
            >
              <MaterialIcons name={isTared ? "qr-code-scanner" : "track-changes"} size={17} color="#fff" />
              <Text style={s.createBtnTxt}>
                {loading ? "Creating..." : isTaring ? "Taring..." : isTared ? "Create" : "Tare"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>

      <Modal visible={Boolean(locationPickerOpen)} animationType="slide" transparent={true} onRequestClose={() => setLocationPickerOpen(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setLocationPickerOpen(null)}><View style={{ flex: 1 }} /></TouchableWithoutFeedback>
          <View style={[s.bottomSheetModal, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>{locationPickerOpen === "origin" ? "Select Origin" : "Select Destination"}</Text>
              <TouchableOpacity onPress={() => setLocationPickerOpen(null)} style={s.pickerBack}><MaterialIcons name="close" size={22} color={COLORS.onSurface} /></TouchableOpacity>
            </View>
            <View style={s.pickerSearch}>
              <MaterialIcons name="search" size={18} color={COLORS.onSurfaceVariant} />
              <TextInput style={s.pickerInput} placeholder="Search..." placeholderTextColor={COLORS.onSurfaceVariant} value={locationQuery} onChangeText={setLocationQuery} autoFocus />
              {locationQuery.length > 0 && <TouchableOpacity onPress={() => setLocationQuery("")}><MaterialIcons name="close" size={16} color={COLORS.onSurfaceVariant} /></TouchableOpacity>}
            </View>
            <ScrollView contentContainerStyle={s.pickerList} keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }}>
              {filteredLocations.map((item) => (
                <TouchableOpacity key={item.id} style={s.pickerItem} onPress={() => handleSelectLocation(item)}>
                  <View style={s.pickerIcon}><MaterialIcons name="place" size={17} color={COLORS.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pickerItemTitle}>{item.label}</Text>
                    {item.description ? <Text style={s.pickerItemSub}>{item.description}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isSavedRoutesOpen} animationType="slide" transparent={true} onRequestClose={() => setIsSavedRoutesOpen(false)}>
        <View style={s.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsSavedRoutesOpen(false)}><View style={{ flex: 1 }} /></TouchableWithoutFeedback>
          <View style={[s.bottomSheetModal, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>Saved Routes</Text>
              <TouchableOpacity onPress={() => setIsSavedRoutesOpen(false)} style={s.pickerBack}><MaterialIcons name="close" size={22} color={COLORS.onSurface} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.pickerList} style={{ maxHeight: 300 }}>
              {savedRoutes.length === 0
                ? <View style={s.emptyBox}><MaterialIcons name="route" size={36} color={COLORS.surfaceContainerHighest} /><Text style={[s.emptyTxt, { marginTop: 10 }]}>No saved routes yet.</Text></View>
                : savedRoutes.map((route: any) => (
                  <TouchableOpacity key={route.id} style={s.savedRouteRow} onPress={() => handleUseSavedRoute(route)}>
                    <MaterialIcons name="route" size={20} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.pickerItemTitle} numberOfLines={1}>{route.origin_address} to {route.destination_address}</Text>
                      <Text style={s.pickerItemSub}>{fmtDist(Number(route.distance_km || 0))}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={17} color={COLORS.onSurfaceVariant} />
                  </TouchableOpacity>
                ))
              }
            </ScrollView>
          </View>
        </View>
      </Modal>
      <LoadingOverlay visible={loading} />
    </View>
  )
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background, justifyContent: "flex-end" },
  formPanel: { backgroundColor: COLORS.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, ...AMBIENT_SHADOW, shadowOpacity: 0.12 },
  formScroll: { padding: 14, paddingTop: 12 },
  savedPill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: COLORS.primaryContainer + "22", borderWidth: 1, borderColor: COLORS.primaryContainer, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
  savedPillTxt: { fontSize: 11, fontWeight: "600", color: COLORS.primary },
  routeCard: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 14, borderWidth: 1, borderColor: COLORS.surfaceContainerHighest, marginBottom: 8, ...AMBIENT_SHADOW },
  locRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  dotGreen: { width: 11, height: 11, borderRadius: 6, backgroundColor: "#2E7D32", borderWidth: 2, borderColor: "#2E7D3244" },
  dotRed: { width: 11, height: 11, borderRadius: 6, backgroundColor: "#B00020", borderWidth: 2, borderColor: "#B0002044" },
  locLbl: { fontSize: 10, fontWeight: "700", color: COLORS.onSurfaceVariant, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  locVal: { fontSize: 14, fontWeight: "600", color: COLORS.onSurface },
  locPlaceholder: { color: COLORS.onSurfaceVariant, fontWeight: "400" },
  divRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  divLine: { flex: 1, height: 1, backgroundColor: COLORS.surfaceContainerHighest },
  swapBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primaryContainer + "22", borderWidth: 1, borderColor: COLORS.primaryContainer, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  metricsCard: { flexDirection: "row", backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 14, borderWidth: 1, borderColor: COLORS.surfaceContainerHighest, marginBottom: 8, overflow: "hidden", ...AMBIENT_SHADOW },
  metric: { flex: 1, paddingVertical: 9, paddingHorizontal: 10, justifyContent: "center" },
  metDivider: { width: 1, backgroundColor: COLORS.surfaceContainerHighest, marginVertical: 8 },
  metLbl: { fontSize: 9, fontWeight: "700", color: COLORS.onSurfaceVariant, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 },
  metVal: { fontSize: 14, fontWeight: "700", color: COLORS.onSurface },
  seatsInput: { fontSize: 14, fontWeight: "700", color: COLORS.primary, minWidth: 24, textAlign: "center" },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 28, ...AMBIENT_SHADOW, shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5, alignSelf: "flex-end" },
  createBtnOff: { backgroundColor: COLORS.surfaceContainerHighest, shadowOpacity: 0, elevation: 0 },
  createBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  actionBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.surfaceContainerLow },
  actionBarLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  boardingContent: { paddingHorizontal: 16 },
  qrCard: { backgroundColor: COLORS.surface, borderRadius: 22, alignItems: "center", paddingVertical: 16, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.surfaceContainerHighest, ...AMBIENT_SHADOW, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  qrWrapper: { padding: 12, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#ECE7F2", ...AMBIENT_SHADOW, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 },
  rideRef: { fontSize: 13, fontWeight: "800", color: COLORS.primary, letterSpacing: 1.2, marginTop: 12 },
  qrCaption: { fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 4, fontWeight: "600" },
  boardingActions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 },
  inlineCancelBtn: { minWidth: 104, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: COLORS.errorContainer, borderWidth: 1, borderColor: COLORS.error + "33", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
  inlineCancelTxt: { color: COLORS.error, fontSize: 13, fontWeight: "800" },
  inlinePrimaryBtn: { minWidth: 128, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 22, ...AMBIENT_SHADOW, shadowColor: COLORS.primary, shadowOpacity: 0.22, shadowRadius: 10, elevation: 4 },
  inlinePrimaryTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
  boardingSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 14, borderWidth: 1, borderColor: COLORS.surfaceContainerHighest, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 14 },
  summaryItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  summaryDivider: { width: 1, height: 18, backgroundColor: COLORS.surfaceContainerHighest },
  summaryText: { fontSize: 13, fontWeight: "800", color: COLORS.onSurface },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  statCard: { flex: 1, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center", gap: 4, borderWidth: 1, borderColor: COLORS.primary + "22", ...AMBIENT_SHADOW },
  statVal: { fontSize: 14, fontWeight: "800", color: COLORS.onSurface },
  statLbl: { fontSize: 10, color: COLORS.onSurfaceVariant, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: COLORS.onSurface, marginBottom: 10 },
  sectionCount: { fontSize: 13, fontWeight: "500", color: COLORS.onSurfaceVariant },
  emptyBox: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyTxt: { fontSize: 13, color: COLORS.onSurfaceVariant, fontStyle: "italic" },
  pRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surfaceContainerLowest, padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.surfaceContainerHighest, gap: 12 },
  pAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primaryContainer + "22", borderWidth: 1, borderColor: COLORS.primaryContainer, alignItems: "center", justifyContent: "center" },
  pName: { fontSize: 13, fontWeight: "600", color: COLORS.onSurface },
  pMeta: { fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  bottomSheetModal: { backgroundColor: COLORS.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10, maxHeight: "75%", ...AMBIENT_SHADOW, shadowOpacity: 0.15 },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerLow },
  pickerBack: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  pickerTitle: { fontSize: 14, fontWeight: "700", color: COLORS.onSurface },
  pickerSearch: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, marginVertical: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 12, borderWidth: 1, borderColor: COLORS.surfaceContainerHighest },
  pickerInput: { flex: 1, fontSize: 14, color: COLORS.onSurface },
  pickerList: { paddingHorizontal: 14, paddingBottom: 20, gap: 6 },
  pickerItem: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surfaceContainerLowest, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: COLORS.surfaceContainerHighest },
  pickerIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primaryContainer + "18", alignItems: "center", justifyContent: "center" },
  pickerItemTitle: { fontSize: 14, fontWeight: "600", color: COLORS.onSurface },
  pickerItemSub: { fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 2 },
  savedRouteRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.surfaceContainerLowest, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: COLORS.surfaceContainerHighest, marginBottom: 6 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 2, marginBottom: 10 },
  toggleLbl: { fontSize: 13, fontWeight: "500", color: COLORS.onSurfaceVariant },
})
