import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import { useAuthStore } from '../../core/authStore';
import { authApi, driverApi } from '../../core/api';

type Props = { onBack: () => void };

// ─── Small sub-components ────────────────────────────────────────────────────

function SettingsRow({
  icon,
  title,
  subtitle,
  trailing,
  isLast,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  isLast?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsRow,
        !isLast && styles.settingsRowBorder,
        pressed && { backgroundColor: COLORS.surfaceContainerHighest },
      ]}
      onPress={onPress}
    >
      <View style={styles.settingsRowLeft}>
        <MaterialIcons name={icon} size={22} color={COLORS.tertiary} />
        <View style={{ flex: 1 }}>
          <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]}>{title}</Text>
          {subtitle ? (
            <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <View>
        {trailing || (
          <MaterialIcons name="chevron-right" size={22} color={COLORS.tertiaryFixedDim} />
        )}
      </View>
    </Pressable>
  );
}

function ToggleSwitch({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: COLORS.surfaceContainerHighest, true: COLORS.primaryContainer }}
      thumbColor={value ? COLORS.primary : COLORS.tertiary}
      style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
    />
  );
}

function ValueChevron({ value }: { value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>{value}</Text>
      <MaterialIcons name="chevron-right" size={22} color={COLORS.tertiaryFixedDim} />
    </View>
  );
}

function InputField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        <MaterialIcons name={icon} size={18} color={COLORS.outline} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? label}
          placeholderTextColor={COLORS.outline}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'sentences'}
        />
      </View>
    </View>
  );
}

function SaveButton({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.saveButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

// ─── Modal screen definitions ─────────────────────────────────────────────────

type ModalId =
  | 'personalDetails'
  | 'homeAddress'
  | 'vehicleDetails'
  | 'documents'
  | 'language'
  | 'navigationApp'
  | 'changePin'
  | 'twoFactor'
  | 'terms'
  | 'privacy'
  | 'help'
  | 'about';

const MODAL_TITLES: Record<ModalId, string> = {
  personalDetails: 'Personal Details',
  homeAddress: 'Home Address',
  vehicleDetails: 'Vehicle Details',
  documents: 'Documents',
  language: 'Language',
  navigationApp: 'Navigation App',
  changePin: 'Change PIN',
  twoFactor: 'Two-Factor Auth',
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  help: 'Help Center',
  about: 'About LR Ride',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountSettingsPage({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { user, setUser, logout } = useAuthStore();

  // ── toggles
  const [pushNotifications, setPushNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [biometricLock, setBiometricLock] = useState(true);

  // ── active sub-page
  const [activeModal, setActiveModal] = useState<ModalId | null>(null);

  // ── loading
  const [saving, setSaving] = useState(false);

  // ── personal details form
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [phone, setPhone] = useState(user?.phone_number ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  // ── home address form
  const [homeAddress, setHomeAddress] = useState(user?.home_address ?? '');

  // ── vehicle form
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleLoading, setVehicleLoading] = useState(true);

  // Sync from updated user after login changes
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
      setPhone(user.phone_number ?? '');
      setEmail(user.email ?? '');
      setHomeAddress(user.home_address ?? '');
    }
  }, [user]);

  // Fetch live driver profile on mount
  useEffect(() => {
    setVehicleLoading(true);
    driverApi
      .getProfile()
      .then((res) => {
        const d = res.data;
        setVehicleMake(d.vehicle_make ?? '');
        setVehicleModel(d.vehicle_model ?? '');
        setVehicleColor(d.vehicle_color ?? '');
        setPlateNumber(d.plate_number ?? '');
      })
      .catch((err) => {
        console.warn('[AccountSettings] driver profile fetch failed:', err?.response?.data ?? err.message);
      })
      .finally(() => setVehicleLoading(false));
  }, []);

  // ─── Save handlers ──────────────────────────────────────────────────────────

  const savePersonalDetails = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      Alert.alert('Missing fields', 'First name, last name and phone are required.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await authApi.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim(),
        email: email.trim(),
      });
      setUser(data);
      Alert.alert('Saved', 'Personal details updated.', [
        { text: 'OK', onPress: () => setActiveModal(null) },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.phone_number?.[0]
        ?? err?.response?.data?.email?.[0]
        ?? err?.response?.data?.detail
        ?? 'Failed to save. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const saveHomeAddress = async () => {
    setSaving(true);
    try {
      const { data } = await authApi.updateMe({ home_address: homeAddress.trim() });
      setUser(data);
      Alert.alert('Saved', 'Home address updated.', [
        { text: 'OK', onPress: () => setActiveModal(null) },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Failed to save address.');
    } finally {
      setSaving(false);
    }
  };

  const saveVehicleDetails = async () => {
    if (!vehicleMake.trim() || !vehicleModel.trim() || !plateNumber.trim() || !vehicleColor.trim()) {
      Alert.alert('Missing fields', 'All vehicle fields are required.');
      return;
    }
    setSaving(true);
    try {
      await driverApi.updateProfile({
        vehicle_make: vehicleMake.trim(),
        vehicle_model: vehicleModel.trim(),
        vehicle_color: vehicleColor.trim(),
        plate_number: plateNumber.trim().toUpperCase(),
      });
      Alert.alert('Saved', 'Vehicle details updated.', [
        { text: 'OK', onPress: () => setActiveModal(null) },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.plate_number?.[0]
        ?? err?.response?.data?.detail
        ?? 'Failed to save vehicle details.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  // ─── Modal content ──────────────────────────────────────────────────────────

  const renderModalContent = () => {
    switch (activeModal) {
      case 'personalDetails':
        return (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={120}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <InputField label="First Name" icon="person" value={firstName} onChangeText={setFirstName} />
              <InputField label="Last Name" icon="person" value={lastName} onChangeText={setLastName} />
              <InputField
                label="Phone Number"
                icon="phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              <InputField
                label="Email Address"
                icon="email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <SaveButton label="Save Personal Details" onPress={savePersonalDetails} loading={saving} />
            </ScrollView>
          </KeyboardAvoidingView>
        );

      case 'homeAddress':
        return (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={120}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <InputField
                label="Home Address"
                icon="home"
                value={homeAddress}
                onChangeText={setHomeAddress}
                placeholder="e.g. Block C, Main Hostel, FUT Minna"
              />
              <Text style={[FONTS.bodySm, { color: COLORS.tertiary, marginBottom: 24, marginTop: -8 }]}>
                This will be your default navigation destination.
              </Text>
              <SaveButton label="Save Home Address" onPress={saveHomeAddress} loading={saving} />
            </ScrollView>
          </KeyboardAvoidingView>
        );

      case 'vehicleDetails':
        if (vehicleLoading) {
          return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          );
        }
        return (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={120}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <InputField label="Vehicle Make" icon="directions-car" value={vehicleMake} onChangeText={setVehicleMake} placeholder="e.g. Toyota" />
              <InputField label="Vehicle Model" icon="commute" value={vehicleModel} onChangeText={setVehicleModel} placeholder="e.g. Camry" />
              <InputField label="Color" icon="palette" value={vehicleColor} onChangeText={setVehicleColor} placeholder="e.g. Silver" />
              <InputField
                label="License Plate"
                icon="pin"
                value={plateNumber}
                onChangeText={setPlateNumber}
                placeholder="e.g. ABC-123-XY"
                autoCapitalize="characters"
              />
              <SaveButton label="Update Vehicle" onPress={saveVehicleDetails} loading={saving} />
            </ScrollView>
          </KeyboardAvoidingView>
        );

      case 'terms':
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formContent}>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurface, lineHeight: 26 }]}>
              These Terms of Service govern your use of the LR Ride driver application. By using this application, you agree to comply with all university transportation guidelines and maintain professional conduct at all times while providing rides to students.{'\n\n'}
              You must not use the platform for any unauthorized purposes, and you agree to keep your vehicle and licence details accurate and up to date at all times. Failure to comply may result in account suspension.
            </Text>
          </ScrollView>
        );

      case 'privacy':
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formContent}>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurface, lineHeight: 26 }]}>
              Your privacy is important to us. We collect and securely store your location data, personal information, and vehicle details solely for the purpose of matching you with riders and ensuring campus security.{'\n\n'}
              Your data is never sold to third parties and is fully encrypted in transit and at rest. You may request deletion of your account data at any time by contacting support.
            </Text>
          </ScrollView>
        );

      case 'help':
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formContent}>
            <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, marginBottom: 16 }]}>Help Center</Text>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurface, lineHeight: 26 }]}>
              For assistance, contact us via:{'\n\n'}
              📧 support@lrride.app{'\n'}
              📞 +234 800 000 0000{'\n\n'}
              Response time is within 24 hours on business days.
            </Text>
          </ScrollView>
        );

      case 'about':
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formContent}>
            <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, marginBottom: 16 }]}>LR Ride — Driver App</Text>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurface, lineHeight: 26 }]}>
              Version: 1.0.0{'\n'}
              Build: Production{'\n\n'}
              LR Ride connects FUTMINNA students with trusted campus drivers for safe and affordable rides within campus.{'\n\n'}
              © 2026 LR Ride. All rights reserved.
            </Text>
          </ScrollView>
        );

      default:
        return (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="construction" size={48} color={COLORS.outline} />
            <Text style={[FONTS.bodyMd, { color: COLORS.outline, marginTop: 12 }]}>Coming soon</Text>
          </View>
        );
    }
  };

  // ─── Sub-page screen (replaces list entirely) ───────────────────────────────

  if (activeModal) {
    return (
      <View style={[styles.root, { backgroundColor: COLORS.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top, height: 64 + insets.top }]}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
            onPress={() => setActiveModal(null)}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
          </Pressable>
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, fontWeight: '700', flex: 1, textAlign: 'center' }]}>
            {MODAL_TITLES[activeModal]}
          </Text>
          <View style={styles.backButton} />
        </View>
        <View style={{ flex: 1 }}>
          {renderModalContent()}
        </View>
      </View>
    );
  }

  // ─── Main settings list ─────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top, height: 64 + insets.top }]}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          onPress={onBack}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, fontWeight: '700', flex: 1, textAlign: 'center' }]}>
          Account Settings
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Snapshot */}
        <View style={[styles.profileCard, AMBIENT_SHADOW]}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(user?.first_name?.[0] ?? '') + (user?.last_name?.[0] ?? '')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, fontWeight: '700' }]}>
              {user?.full_name ?? (`${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Driver')}
            </Text>
            <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>
              {user?.phone_number ?? '—'}
            </Text>
          </View>
        </View>

        {/* Personal Information */}
        <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
        <View style={[styles.card, AMBIENT_SHADOW]}>
          <SettingsRow
            icon="person"
            title="Personal Details"
            subtitle="Name, phone, email"
            onPress={() => setActiveModal('personalDetails')}
          />
          <SettingsRow
            icon="home"
            title="Home Address"
            subtitle={homeAddress || 'Not set'}
            isLast
            onPress={() => setActiveModal('homeAddress')}
          />
        </View>

        {/* Vehicle */}
        <Text style={styles.sectionTitle}>VEHICLE</Text>
        <View style={[styles.card, AMBIENT_SHADOW]}>
          <SettingsRow
            icon="directions-car"
            title="Vehicle Details"
            subtitle={vehicleMake ? `${vehicleMake} ${vehicleModel} · ${plateNumber}` : 'Not configured'}
            onPress={() => setActiveModal('vehicleDetails')}
          />
          <SettingsRow
            icon="description"
            title="Documents"
            subtitle="Licence & insurance"
            isLast
            onPress={() => setActiveModal('documents')}
          />
        </View>

        {/* App Settings */}
        <Text style={styles.sectionTitle}>APP SETTINGS</Text>
        <View style={[styles.card, AMBIENT_SHADOW]}>
          <SettingsRow
            icon="language"
            title="Language"
            trailing={<ValueChevron value="English" />}
            onPress={() => setActiveModal('language')}
          />
          <SettingsRow
            icon="notifications"
            title="Push Notifications"
            trailing={<ToggleSwitch value={pushNotifications} onValueChange={setPushNotifications} />}
          />
          <SettingsRow
            icon="dark-mode"
            title="Dark Mode"
            trailing={<ToggleSwitch value={darkMode} onValueChange={setDarkMode} />}
          />
          <SettingsRow
            icon="map"
            title="Navigation App"
            trailing={<ValueChevron value="Google Maps" />}
            isLast
            onPress={() => setActiveModal('navigationApp')}
          />
        </View>

        {/* Security */}
        <Text style={styles.sectionTitle}>SECURITY</Text>
        <View style={[styles.card, AMBIENT_SHADOW]}>
          <SettingsRow icon="lock" title="Change PIN" onPress={() => setActiveModal('changePin')} />
          <SettingsRow
            icon="verified-user"
            title="Two-Factor Auth"
            onPress={() => setActiveModal('twoFactor')}
          />
          <SettingsRow
            icon="fingerprint"
            title="Biometric Lock"
            trailing={<ToggleSwitch value={biometricLock} onValueChange={setBiometricLock} />}
            isLast
          />
        </View>

        {/* Legal */}
        <Text style={styles.sectionTitle}>LEGAL & SUPPORT</Text>
        <View style={[styles.card, AMBIENT_SHADOW]}>
          <SettingsRow icon="gavel" title="Terms of Service" onPress={() => setActiveModal('terms')} />
          <SettingsRow icon="privacy-tip" title="Privacy Policy" onPress={() => setActiveModal('privacy')} />
          <SettingsRow icon="help" title="Help Center" onPress={() => setActiveModal('help')} />
          <SettingsRow icon="info" title="About LR Ride" isLast onPress={() => setActiveModal('about')} />
        </View>

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.75 }]}
          onPress={() => {
            Alert.alert('Logout', 'Are you sure you want to logout?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: () => { logout(); onBack(); } },
            ]);
          }}
        >
          <MaterialIcons name="logout" size={20} color={COLORS.error} />
          <Text style={[FONTS.labelLg, { color: COLORS.error }]}>Logout</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    paddingBottom: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHighest,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...FONTS.headlineMd,
    color: COLORS.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: COLORS.primary,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHighest,
    overflow: 'hidden',
    marginBottom: 20,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 60,
  },
  settingsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceContainerHighest,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    marginRight: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.errorContainer,
    paddingVertical: 16,
    marginBottom: 8,
  },
  // Form styles
  formContent: {
    padding: 20,
    paddingBottom: 48,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHighest,
    paddingHorizontal: 14,
    height: 52,
  },
  textInput: {
    flex: 1,
    ...FONTS.bodyMd,
    color: COLORS.onSurface,
    height: '100%',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
