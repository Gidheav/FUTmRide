import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import { useAuthStore } from '../../core/authStore';

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

// ─── Modal screen definitions ─────────────────────────────────────────────────

type ModalId =
  | 'language'
  | 'navigationApp'
  | 'changePin'
  | 'twoFactor'
  | 'terms'
  | 'privacy'
  | 'help'
  | 'about';

const MODAL_TITLES: Record<ModalId, string> = {
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
  const { logout } = useAuthStore();

  // ── toggles
  const [pushNotifications, setPushNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [biometricLock, setBiometricLock] = useState(true);

  // ── active sub-page
  const [activeModal, setActiveModal] = useState<ModalId | null>(null);

  // ─── Modal content ──────────────────────────────────────────────────────────

  const renderModalContent = () => {
    switch (activeModal) {
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
              support@lrride.app{'\n'}
              +234 800 000 0000{'\n\n'}
            </Text>
          </ScrollView>
        );

      case 'about':
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formContent}>
            <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, marginBottom: 16 }]}>LR Ride - Driver App</Text>
            <Text style={[FONTS.bodyMd, { color: COLORS.onSurface, lineHeight: 26 }]}>
              Version: 1.0.0{'\n'}
              Build: Production{'\n\n'}
              LR Ride connects FUTMINNA students with trusted campus drivers for safe and affordable rides within campus.{'\n\n'}
              (c) 2026 LR Ride. All rights reserved.
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
});
