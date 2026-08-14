import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import LoadingOverlay from '../components/LoadingOverlay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../core/theme';
import { useAuthStore } from '../../core/authStore';
import { authApi, driverApi } from '../../core/api';
import { useDriverProfileStore } from '../../core/driverProfileStore';
import { useDriverRidesStore } from '../../core/driverRidesStore';

type Props = { onBack: () => void };

const DEFAULT_DRIVER_PROFILE = {
  vehicle_type: 'sedan',
  vehicle_make: 'Unknown',
  vehicle_model: 'Unknown',
  vehicle_year: 2020,
  vehicle_color: 'Unknown',
  plate_number: 'PENDING',
  vehicle_seats: 5,
};

const VEHICLE_TYPES = [
  { value: 'motorbike', label: 'Motorbike', icon: 'two-wheeler' as const, seats: 2 },
  { value: 'tricycle', label: 'Tricycle (Keke)', icon: 'electric-rickshaw' as const, seats: 4 },
  { value: 'sedan', label: 'Sedan', icon: 'directions-car' as const, seats: 5 },
  { value: 'mpv', label: 'MPV / Minivan', icon: 'airport-shuttle' as const, seats: 9 },
  { value: 'minibus', label: 'Minibus', icon: 'directions-bus' as const, seats: 14 },
  { value: 'coach', label: 'Coach', icon: 'directions-bus' as const, seats: 40 },
];

const VEHICLE_CAPACITY: Record<string, number> = Object.fromEntries(
  VEHICLE_TYPES.map((v) => [v.value, v.seats]),
);

const getVehicleLabel = (value: string) =>
  VEHICLE_TYPES.find((v) => v.value === value)?.label ?? value;

const getVehicleIcon = (value: string): string =>
  VEHICLE_TYPES.find((v) => v.value === value)?.icon ?? 'directions-car';

export default function EditProfilePage({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();
  const { profile: cachedProfile, setProfile: setCachedProfile } = useDriverProfileStore();
  const { setDriverProfile } = useDriverRidesStore();
  const [loading, setLoading] = useState(true);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [vehiclePicker, setVehiclePicker] = useState(false);
  const isSavingProfile = savingPersonal || savingVehicle;

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [phone, setPhone] = useState(user?.phone_number ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [homeAddress, setHomeAddress] = useState(user?.home_address ?? '');

  const [vehicleMake, setVehicleMake] = useState(cachedProfile?.vehicle_make ?? '');
  const [vehicleModel, setVehicleModel] = useState(cachedProfile?.vehicle_model ?? '');
  const [vehicleYear, setVehicleYear] = useState(String(cachedProfile?.vehicle_year ?? ''));
  const [vehicleColor, setVehicleColor] = useState(cachedProfile?.vehicle_color ?? '');
  const [plateNumber, setPlateNumber] = useState(cachedProfile?.plate_number ?? '');
  const [vehicleType, setVehicleType] = useState(cachedProfile?.vehicle_type ?? DEFAULT_DRIVER_PROFILE.vehicle_type);

  // Back handler for modal
  useEffect(() => {
    const handler = () => {
      if (vehiclePicker) {
        setVehiclePicker(false);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [vehiclePicker]);

  useEffect(() => {
    setFirstName(user?.first_name ?? '');
    setLastName(user?.last_name ?? '');
    setPhone(user?.phone_number ?? '');
    setEmail(user?.email ?? '');
    setHomeAddress(user?.home_address ?? '');
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      if (!cachedProfile) setLoading(true);
      try {
        const response = await driverApi.getProfile();
        if (!isMounted) return;
        setVehicleMake(response?.data?.vehicle_make ?? '');
        setVehicleModel(response?.data?.vehicle_model ?? '');
        setVehicleYear(String(response?.data?.vehicle_year ?? ''));
        setVehicleColor(response?.data?.vehicle_color ?? '');
        setPlateNumber(response?.data?.plate_number ?? '');
        setVehicleType(response?.data?.vehicle_type ?? DEFAULT_DRIVER_PROFILE.vehicle_type);
        setCachedProfile(response?.data ?? null);
        setDriverProfile({ vehicle_type: response?.data?.vehicle_type ?? null });
      } catch (error: any) {
        if (error?.response?.status === 404) {
          try {
            await driverApi.createProfile(DEFAULT_DRIVER_PROFILE);
            const retry = await driverApi.getProfile();
            if (!isMounted) return;
            setVehicleMake(retry?.data?.vehicle_make ?? '');
            setVehicleModel(retry?.data?.vehicle_model ?? '');
            setVehicleYear(String(retry?.data?.vehicle_year ?? ''));
            setVehicleColor(retry?.data?.vehicle_color ?? '');
            setPlateNumber(retry?.data?.plate_number ?? '');
            setVehicleType(retry?.data?.vehicle_type ?? DEFAULT_DRIVER_PROFILE.vehicle_type);
            setCachedProfile(retry?.data ?? null);
            setDriverProfile({ vehicle_type: retry?.data?.vehicle_type ?? null });
          } catch (createErr: any) {
            console.warn('[EditProfile] driver profile fetch failed:', createErr?.response?.data ?? createErr.message);
          }
        } else {
          console.warn('[EditProfile] driver profile fetch failed:', error?.response?.data ?? error.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [setCachedProfile]);

  const savePersonalDetails = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      Alert.alert('Missing fields', 'First name, last name, and phone are required.');
      return;
    }
    setSavingPersonal(true);
    try {
      const { data } = await authApi.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim(),
        email: email.trim(),
        home_address: homeAddress.trim(),
      });
      setUser(data);
      Alert.alert('Saved', 'Profile details updated.');
    } catch (error: any) {
      const msg =
        error?.response?.data?.phone_number?.[0] ||
        error?.response?.data?.email?.[0] ||
        error?.response?.data?.detail ||
        'Failed to update profile.';
      Alert.alert('Error', msg);
    } finally {
      setSavingPersonal(false);
    }
  };

  const saveVehicleDetails = async () => {
    if (!vehicleMake.trim() || !vehicleModel.trim() || !plateNumber.trim() || !vehicleColor.trim()) {
      Alert.alert('Missing fields', 'All vehicle fields are required.');
      return;
    }
    setSavingVehicle(true);
    try {
      const payload = {
        vehicle_type: vehicleType,
        vehicle_make: vehicleMake.trim(),
        vehicle_model: vehicleModel.trim(),
        vehicle_color: vehicleColor.trim(),
        vehicle_year: vehicleYear ? Number(vehicleYear) : undefined,
        plate_number: plateNumber.trim().toUpperCase(),
        vehicle_seats: VEHICLE_CAPACITY[vehicleType] || 4,
      };
      await driverApi.updateProfile(payload);
      setCachedProfile({ ...(cachedProfile ?? {}), ...payload });
      setDriverProfile({ vehicle_type: payload.vehicle_type });
      Alert.alert('Saved', 'Vehicle details updated.');
    } catch (error: any) {
      if (error?.response?.status === 404) {
        try {
          const createPayload = {
            ...DEFAULT_DRIVER_PROFILE,
            vehicle_type: vehicleType,
            vehicle_make: vehicleMake.trim(),
            vehicle_model: vehicleModel.trim(),
            vehicle_color: vehicleColor.trim(),
            vehicle_year: vehicleYear ? Number(vehicleYear) : DEFAULT_DRIVER_PROFILE.vehicle_year,
            plate_number: plateNumber.trim().toUpperCase(),
            vehicle_seats: VEHICLE_CAPACITY[vehicleType] || 4,
          };
          await driverApi.createProfile(createPayload);
          setCachedProfile({ ...(cachedProfile ?? {}), ...createPayload });
          setDriverProfile({ vehicle_type: createPayload.vehicle_type });
          Alert.alert('Saved', 'Vehicle details updated.');
        } catch (createErr: any) {
          const msg =
            createErr?.response?.data?.plate_number?.[0] ||
            createErr?.response?.data?.detail ||
            'Failed to update vehicle details.';
          Alert.alert('Error', msg);
        }
      } else {
        const msg =
          error?.response?.data?.plate_number?.[0] ||
          error?.response?.data?.detail ||
          'Failed to update vehicle details.';
        Alert.alert('Error', msg);
      }
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleSelectVehicle = useCallback((value: string) => {
    setVehicleType(value);
    setVehiclePicker(false);
  }, []);

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top, height: 56 + insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Edit Profile</Text>
        <View style={styles.backButton} />
      </View>

      {isSavingProfile && (
        <View style={styles.saveStatusWrap}>
          <LoadingOverlay
            visible={true}
            inline
            size={28}
            message={savingPersonal ? 'Saving personal details...' : 'Saving vehicle details...'}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <LoadingOverlay visible={true} inline size={60} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* ─── Personal Information ─── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personal Information</Text>

              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>First name</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    placeholderTextColor="#9c9c9c"
                  />
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Last name</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                    placeholderTextColor="#9c9c9c"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Phone number</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  placeholderTextColor="#9c9c9c"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#9c9c9c"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Home address</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={homeAddress}
                  onChangeText={setHomeAddress}
                  autoCapitalize="sentences"
                  placeholderTextColor="#9c9c9c"
                />
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.saveBtn} onPress={savePersonalDetails} disabled={savingPersonal} activeOpacity={0.8}>
                  <Text style={styles.saveBtnText}>{savingPersonal ? 'Saving...' : 'Save'}</Text>
                  {!savingPersonal && <MaterialIcons name="check" size={16} color="#ffffff" />}
                </TouchableOpacity>
              </View>
            </View>

            {/* ─── Vehicle Details ─── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Vehicle Details</Text>

              {/* Vehicle type dropdown */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Vehicle category</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setVehiclePicker(true)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name={getVehicleIcon(vehicleType) as any} size={18} color="#6A1B9A" />
                  <Text style={styles.dropdownText} numberOfLines={1}>{getVehicleLabel(vehicleType)}</Text>
                  <MaterialIcons name="keyboard-arrow-down" size={18} color="#8b8b8b" />
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Make</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={vehicleMake}
                    onChangeText={setVehicleMake}
                    placeholder="e.g. Toyota"
                    autoCapitalize="words"
                    placeholderTextColor="#9c9c9c"
                  />
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Model</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={vehicleModel}
                    onChangeText={setVehicleModel}
                    placeholder="e.g. Camry"
                    autoCapitalize="words"
                    placeholderTextColor="#9c9c9c"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Year</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={vehicleYear}
                    onChangeText={setVehicleYear}
                    placeholder="e.g. 2022"
                    keyboardType="numeric"
                    placeholderTextColor="#9c9c9c"
                  />
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Color</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                    placeholder="e.g. White"
                    autoCapitalize="words"
                    placeholderTextColor="#9c9c9c"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Plate number</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={plateNumber}
                  onChangeText={setPlateNumber}
                  placeholder="e.g. ABC 123 XY"
                  autoCapitalize="characters"
                  placeholderTextColor="#9c9c9c"
                />
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.saveBtn} onPress={saveVehicleDetails} disabled={savingVehicle} activeOpacity={0.8}>
                  <Text style={styles.saveBtnText}>{savingVehicle ? 'Saving...' : 'Save'}</Text>
                  {!savingVehicle && <MaterialIcons name="check" size={16} color="#ffffff" />}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ─── Vehicle picker modal (same pattern as BookRidePage) ─── */}
      {vehiclePicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Vehicle Category</Text>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {VEHICLE_TYPES.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={styles.modalItem}
                  onPress={() => handleSelectVehicle(item.value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.modalItemIcon, vehicleType === item.value && styles.modalItemIconActive]}>
                    <MaterialIcons name={item.icon as any} size={18} color={vehicleType === item.value ? '#ffffff' : '#6A1B9A'} />
                  </View>
                  <View style={styles.modalItemContent}>
                    <Text style={[styles.modalItemTitle, vehicleType === item.value && styles.modalItemTitleActive]}>{item.label}</Text>
                    <Text style={styles.modalItemSub}>{item.seats} {item.seats === 1 ? 'passenger seat' : 'passenger seats'}</Text>
                  </View>
                  {vehicleType === item.value && (
                    <MaterialIcons name="check-circle" size={20} color="#6A1B9A" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setVehiclePicker(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  topBar: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 5,
    paddingBottom: 32,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveStatusWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  loadingText: {
    fontSize: 14,
    color: '#8b8b8b',
    marginTop: 12,
  },

  // ── Cards ──
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    padding: 12,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    gap: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#8b8b8b',
    marginBottom: 2,
    letterSpacing: 0.6,
  },

  // ── Fields ──
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b8b8b',
  },
  fieldInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#1a1c1c',
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: '#ffffff',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCol: {
    flex: 1,
    gap: 6,
  },

  // ── Dropdown button (vehicle type) ──
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    gap: 10,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },

  // ── Action row ──
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#6A1B9A',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Modal overlay (same as BookRidePage) ──
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    padding: 20,
    paddingHorizontal: 10,
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderColor: '#6b2e916a',
    borderWidth: 1,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 12,
  },
  modalList: {
    marginTop: 4,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  modalItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5effb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalItemIconActive: {
    backgroundColor: '#6A1B9A',
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  modalItemTitleActive: {
    color: '#6A1B9A',
    fontWeight: '700',
  },
  modalItemSub: {
    fontSize: 12,
    color: '#8b8b8b',
  },
  modalClose: {
    marginTop: 14,
    alignSelf: 'flex-end',
  },
  modalCloseText: {
    color: '#6A1B9A',
    fontWeight: '600',
    fontSize: 14,
  },
});
