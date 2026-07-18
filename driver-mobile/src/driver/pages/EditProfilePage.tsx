import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
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
  vehicle_seats: 4,
};

const VEHICLE_TYPES = [
  { value: 'motorbike', label: 'Motorbike' },
  { value: 'tricycle', label: 'Tricycle' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'mpv', label: 'MPV' },
];

const InputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
}) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.outline}
      keyboardType={keyboardType ?? 'default'}
      autoCapitalize={autoCapitalize ?? 'sentences'}
    />
  </View>
);

export default function EditProfilePage({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();
  const { profile: cachedProfile, setProfile: setCachedProfile } = useDriverProfileStore();
  const { setDriverProfile } = useDriverRidesStore();
  const [loading, setLoading] = useState(true);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);

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
  const [vehicleSeats, setVehicleSeats] = useState(String(cachedProfile?.vehicle_seats ?? '4'));
  const [vehicleType, setVehicleType] = useState(cachedProfile?.vehicle_type ?? DEFAULT_DRIVER_PROFILE.vehicle_type);

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
        setVehicleSeats(String(response?.data?.vehicle_seats ?? '4'));
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
            setVehicleSeats(String(retry?.data?.vehicle_seats ?? '4'));
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
        vehicle_seats: vehicleSeats ? Number(vehicleSeats) : 4,
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
            vehicle_seats: vehicleSeats ? Number(vehicleSeats) : 4,
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

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top, height: 64 + insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, fontWeight: '700', flex: 1, textAlign: 'center' }]}>Edit Profile</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <LoadingOverlay visible={true} inline size={60} />
          <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, marginTop: 12 }]}>Loading profile...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, AMBIENT_SHADOW]}>
            <Text style={[FONTS.labelLg, styles.sectionTitle]}>Personal information</Text>
            <InputField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
            <InputField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
            <InputField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" />
            <InputField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <InputField label="Home address" value={homeAddress} onChangeText={setHomeAddress} autoCapitalize="sentences" />
            <TouchableOpacity style={styles.primaryButton} onPress={savePersonalDetails} disabled={savingPersonal}>
              {savingPersonal ? (
                <LoadingOverlay visible={true} inline size={24} />
              ) : (
                <Text style={[FONTS.labelLg, styles.primaryButtonText]}>Save personal details</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.card, AMBIENT_SHADOW]}>
            <Text style={[FONTS.labelLg, styles.sectionTitle]}>Vehicle details</Text>
            <View style={styles.vehicleTypeWrap}>
              <Text style={styles.inputLabel}>Vehicle category</Text>
              <View style={styles.vehicleTypeRow}>
                {VEHICLE_TYPES.map((item) => {
                  const isActive = vehicleType === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[styles.vehicleTypeChip, isActive && styles.vehicleTypeChipActive]}
                      onPress={() => setVehicleType(item.value)}
                    >
                      <Text style={isActive ? styles.vehicleTypeTextActive : styles.vehicleTypeText}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <InputField label="Vehicle make" value={vehicleMake} onChangeText={setVehicleMake} autoCapitalize="words" />
            <InputField label="Vehicle model" value={vehicleModel} onChangeText={setVehicleModel} autoCapitalize="words" />
            <InputField label="Vehicle year" value={vehicleYear} onChangeText={setVehicleYear} keyboardType="numeric" autoCapitalize="none" />
            <InputField label="Vehicle color" value={vehicleColor} onChangeText={setVehicleColor} autoCapitalize="words" />
            <InputField label="Plate number" value={plateNumber} onChangeText={setPlateNumber} autoCapitalize="characters" />
            <InputField label="Number of passenger seats" value={vehicleSeats} onChangeText={setVehicleSeats} keyboardType="numeric" autoCapitalize="none" />
            <TouchableOpacity style={styles.primaryButton} onPress={saveVehicleDetails} disabled={savingVehicle}>
              {savingVehicle ? (
                <LoadingOverlay visible={true} inline size={24} />
              ) : (
                <Text style={[FONTS.labelLg, styles.primaryButtonText]}>Save vehicle details</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    gap: 12,
  },
  sectionTitle: {
    color: COLORS.onSurface,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  vehicleTypeWrap: {
    gap: 8,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHigh,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  vehicleTypeChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryContainer,
  },
  vehicleTypeText: {
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
    fontSize: 12,
  },
  vehicleTypeTextActive: {
    color: COLORS.onPrimaryContainer,
    fontWeight: '700',
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHigh,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.onSurface,
    ...FONTS.bodyMd,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  primaryButton: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
});
