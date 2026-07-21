import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import { settingsApi } from '../../core/api';
import { useSettingsStore } from '../../core/settingsStore';
import { useAppLockStore, type DriverLockTimeoutMinutes } from '../../core/appLockStore';
import { saveDriverSessionSnapshotFromStores, saveOfflinePinVerifier } from '../../core/driverSandbox';
import LocationDataService from '../../core/locationDataService';
type Props = {
  onBack: () => void;
  onLogout: () => void;
  verificationProgress?: any;
  onStartAccountVerification?: () => void;
  onStartVehicleVerification?: () => void;
};


// â”€â”€â”€ Small sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Modal screen definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ModalId =
  | 'language'
  | 'navigationApp'
  | 'lockTimeout'
  | 'changePin'
  | 'twoFactor'
  | 'terms'
  | 'privacy'
  | 'help'
  | 'about';

const MODAL_TITLES: Record<ModalId, string> = {
  language: 'Language',
  navigationApp: 'Navigation App',
  lockTimeout: 'Auto-lock',
  changePin: 'Change PIN',
  twoFactor: 'Two-Factor Auth',
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  help: 'Help Center',
  about: 'About LR Ride',
};

const LOCK_TIMEOUT_OPTIONS: Array<{ label: string; value: DriverLockTimeoutMinutes }> = [
  { label: 'None (Disabled)', value: -1 },
  { label: 'Immediate', value: 0 },
  { label: '15 seconds', value: 0.25 },
  { label: '30 seconds', value: 0.5 },
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
];

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function AccountSettingsPage({ onBack, onLogout, verificationProgress, onStartAccountVerification, onStartVehicleVerification }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { settings, hydrateFromApi, updateLocal } = useSettingsStore();
  const { lockTimeoutMinutes, setLockTimeoutMinutes } = useAppLockStore();
  const [refreshing, setRefreshing] = useState(false);

  // â”€â”€ active sub-page
  const [activeModal, setActiveModal] = useState<ModalId | null>(null);
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'sms' | 'email' | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[]>([]);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [twoFactorStage, setTwoFactorStage] = useState<'idle' | 'verify' | 'disable'>('idle');

  const [mapUpdateAvailable, setMapUpdateAvailable] = useState(false);
  const [mapUpdateVersion, setMapUpdateVersion] = useState<number | null>(null);
  const [mapUpdateBusy, setMapUpdateBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;
    LocationDataService.checkForUpdate()
      .then((res) => {
        if (isMounted) {
          setMapUpdateAvailable(res.updateAvailable);
          setMapUpdateVersion(res.localVersion);
        }
      })
      .catch(() => null);
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateMap = async () => {
    if (mapUpdateBusy) return;
    setMapUpdateBusy(true);
    try {
      const result = await LocationDataService.downloadUpdate();
      if (result.success) {
        Alert.alert('Map updated', 'Map locations have been successfully updated.');
        const check = await LocationDataService.checkForUpdate();
        setMapUpdateAvailable(check.updateAvailable);
        setMapUpdateVersion(check.localVersion);
      } else {
        Alert.alert('Update failed', result.error || 'Please try again later.');
      }
    } catch (e) {
      Alert.alert('Error', 'An unexpected error occurred while updating the map.');
    } finally {
      setMapUpdateBusy(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    settingsApi
      .getPreferences()
      .then((res) => {
        if (isMounted && res?.data) {
          hydrateFromApi(res.data);
        }
      })
      .catch(() => null);
    return () => {
      isMounted = false;
    };
  }, [hydrateFromApi]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['verification-progress'] }),
        settingsApi.getPreferences().then((res) => {
          if (res?.data) hydrateFromApi(res.data);
        })
      ]);
    } catch (e) {
      console.warn('Refresh failed', e);
    } finally {
      setRefreshing(false);
    }
  };

  const updateSetting = async (
    patch: Partial<typeof settings>,
    apiPatch: Record<string, unknown>
  ) => {
    const previous = { ...settings };
    updateLocal(patch);
    try {
      await settingsApi.updatePreferences(apiPatch);
      void saveDriverSessionSnapshotFromStores();
    } catch (error) {
      updateLocal(previous);
      Alert.alert('Update failed', 'Please try again.');
    }
  };

  const languageLabel = settings.language === 'en' ? 'English' : settings.language;
  const navigationLabel = settings.navigationApp === 'google_maps' ? 'Google Maps' : 'Google Maps';
  const lockTimeoutLabel = LOCK_TIMEOUT_OPTIONS.find((option) => option.value === lockTimeoutMinutes)?.label || 'None (Disabled)';
  const hasUnlockMethod = settings.hasPin || settings.biometricEnabled;
  const isDarkMode = settings.themeMode === 'dark';

  const handlePinSave = async () => {
    if (!pinNew || pinNew !== pinConfirm) {
      Alert.alert('PIN mismatch', 'Please confirm your new PIN.');
      return;
    }
    setPinBusy(true);
    try {
      const payload: Record<string, string> = { new_pin: pinNew };
      if (settings.hasPin) {
        payload.current_pin = pinCurrent;
      }
      const response = await settingsApi.setPin(payload);
      await saveOfflinePinVerifier(response.data?.offline_pin_verifier);
      updateLocal({ hasPin: true });
      void saveDriverSessionSnapshotFromStores();
      setPinCurrent('');
      setPinNew('');
      setPinConfirm('');
      Alert.alert('PIN updated', 'Your PIN has been saved.');
      setActiveModal(null);
    } catch (error) {
      Alert.alert('PIN update failed', 'Please check your PIN and try again.');
    } finally {
      setPinBusy(false);
    }
  };

  const handleTwoFactorStart = async (method: 'totp' | 'sms' | 'email') => {
    setTwoFactorBusy(true);
    try {
      const res = await settingsApi.startTwoFactor({ method });
      setTwoFactorMethod(method);
      setTwoFactorCode('');
      setTwoFactorStage('verify');
      if (method === 'totp') {
        setTwoFactorSecret(res?.data?.secret || '');
        setTwoFactorBackupCodes(res?.data?.backup_codes || []);
      } else {
        setTwoFactorSecret('');
        setTwoFactorBackupCodes([]);
      }
    } catch (error) {
      Alert.alert('2FA start failed', 'Please try again.');
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const handleTwoFactorConfirm = async () => {
    if (!twoFactorMethod) {
      return;
    }
    if (!twoFactorCode) {
      Alert.alert('Missing code', 'Enter the verification code.');
      return;
    }
    setTwoFactorBusy(true);
    try {
      const res = await settingsApi.confirmTwoFactor({
        method: twoFactorMethod,
        code: twoFactorCode,
      });
      if (res?.data) {
        hydrateFromApi(res.data);
      }
      setTwoFactorStage('idle');
      setTwoFactorMethod(null);
      setTwoFactorCode('');
      setTwoFactorSecret('');
      setTwoFactorBackupCodes([]);
      Alert.alert('2FA enabled', 'Two-factor authentication is now active.');
      setActiveModal(null);
    } catch (error) {
      Alert.alert('2FA verification failed', 'Please check your code and try again.');
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const handleTwoFactorDisable = async () => {
    if (!pinCurrent) {
      Alert.alert('PIN required', 'Enter your PIN to disable 2FA.');
      return;
    }
    setTwoFactorBusy(true);
    try {
      await settingsApi.disableTwoFactor({ pin: pinCurrent });
      updateLocal({ twoFactorEnabled: false, twoFactorMethods: [] });
      setPinCurrent('');
      setTwoFactorStage('idle');
      Alert.alert('2FA disabled', 'Two-factor authentication has been disabled.');
      setActiveModal(null);
    } catch (error) {
      Alert.alert('Disable failed', 'PIN is incorrect or request failed.');
    } finally {
      setTwoFactorBusy(false);
    }
  };

  // â”€â”€â”€ Modal content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const renderModalContent = () => {
    switch (activeModal) {
      case 'changePin':
        return (
          <View style={styles.formContent}>
            {settings.hasPin ? (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current PIN</Text>
                <TextInput
                  style={styles.input}
                  value={pinCurrent}
                  onChangeText={setPinCurrent}
                  placeholder="Enter current PIN"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                />
              </View>
            ) : (
              <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>Set a secure PIN for app and wallet actions.</Text>
            )}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New PIN</Text>
              <TextInput
                style={styles.input}
                value={pinNew}
                onChangeText={setPinNew}
                placeholder="Enter new PIN"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm PIN</Text>
              <TextInput
                style={styles.input}
                value={pinConfirm}
                onChangeText={setPinConfirm}
                placeholder="Confirm new PIN"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
            </View>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
              onPress={handlePinSave}
              disabled={pinBusy}
            >
              <Text style={styles.primaryButtonText}>{pinBusy ? 'Saving...' : 'Save PIN'}</Text>
            </Pressable>
          </View>
        );

      case 'twoFactor':
        return (
          <View style={styles.formContent}>
            {settings.twoFactorEnabled ? (
              <>
                <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]}>Two-factor authentication is enabled.</Text>
                <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>Methods: {settings.twoFactorMethods.join(', ') || 'totp'}</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Enter PIN to disable</Text>
                  <TextInput
                    style={styles.input}
                    value={pinCurrent}
                    onChangeText={setPinCurrent}
                    placeholder="PIN"
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                  />
                </View>
                <Pressable
                  style={({ pressed }) => [styles.dangerButton, pressed && styles.dangerButtonPressed]}
                  onPress={handleTwoFactorDisable}
                  disabled={twoFactorBusy}
                >
                  <Text style={styles.dangerButtonText}>{twoFactorBusy ? 'Disabling...' : 'Disable 2FA'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                {twoFactorStage === 'verify' ? (
                  <>
                    {twoFactorMethod === 'totp' ? (
                      <View style={styles.noticeCard}>
                        <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]}>TOTP Secret</Text>
                        <Text style={[FONTS.bodyMd, { color: COLORS.primary }]}>{twoFactorSecret || '---'}</Text>
                        {twoFactorBackupCodes.length > 0 ? (
                          <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>Backup codes: {twoFactorBackupCodes.join(' ')}</Text>
                        ) : null}
                      </View>
                    ) : null}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Verification Code</Text>
                      <TextInput
                        style={styles.input}
                        value={twoFactorCode}
                        onChangeText={setTwoFactorCode}
                        placeholder="Enter code"
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                      onPress={handleTwoFactorConfirm}
                      disabled={twoFactorBusy}
                    >
                      <Text style={styles.primaryButtonText}>{twoFactorBusy ? 'Verifying...' : 'Confirm 2FA'}</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]}>Enable two-factor authentication</Text>
                    <Pressable
                      style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
                      onPress={() => handleTwoFactorStart('totp')}
                    >
                      <View style={styles.optionTextWrap}>
                        <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]}>Authenticator App (TOTP)</Text>
                        <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>Recommended</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color={COLORS.tertiary} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
                      onPress={() => handleTwoFactorStart('sms')}
                    >
                      <View style={styles.optionTextWrap}>
                        <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]}>SMS Code</Text>
                        <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>Send code to phone</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color={COLORS.tertiary} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
                      onPress={() => handleTwoFactorStart('email')}
                    >
                      <View style={styles.optionTextWrap}>
                        <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]}>Email Code</Text>
                        <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>Send code to email</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color={COLORS.tertiary} />
                    </Pressable>
                  </>
                )}
              </>
            )}
          </View>
        );

      case 'language':
        return (
          <View style={styles.formContent}>
            <Pressable
              style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
              onPress={() => {
                updateSetting({ language: 'en' }, { language: 'en' });
                setActiveModal(null);
              }}
            >
              <View style={styles.optionTextWrap}>
                <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]}>English</Text>
                <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>Default</Text>
              </View>
              {settings.language === 'en' ? (
                <MaterialIcons name="check" size={20} color={COLORS.primary} />
              ) : null}
            </Pressable>
          </View>
        );

      case 'navigationApp':
        return (
          <View style={styles.formContent}>
            <Pressable
              style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
              onPress={() => {
                updateSetting({ navigationApp: 'google_maps' }, { navigation_app: 'google_maps' });
                setActiveModal(null);
              }}
            >
              <View style={styles.optionTextWrap}>
                <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]}>Google Maps</Text>
                <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>Recommended</Text>
              </View>
              {settings.navigationApp === 'google_maps' ? (
                <MaterialIcons name="check" size={20} color={COLORS.primary} />
              ) : null}
            </Pressable>

            <View style={{ marginTop: 24 }}>
              <Text style={styles.sectionTitle}>MAP LOCATIONS</Text>
              <View style={[styles.card, AMBIENT_SHADOW]}>
                <SettingsRow
                  icon="update"
                  title="Update Map"
                  subtitle={mapUpdateVersion !== null ? `Version ${mapUpdateVersion}` : 'Checking version...'}
                  trailing={
                    mapUpdateBusy ? (
                      <Text style={[FONTS.bodySm, { color: COLORS.primary }]}>Updating...</Text>
                    ) : mapUpdateAvailable ? (
                      <Text style={[FONTS.bodySm, { color: COLORS.error }]}>Recommended</Text>
                    ) : (
                      <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>Up to date</Text>
                    )
                  }
                  isLast
                  onPress={mapUpdateAvailable ? handleUpdateMap : undefined}
                />
              </View>
            </View>
          </View>
        );

      case 'lockTimeout':
        return (
          <View style={styles.formContent}>
            {!hasUnlockMethod ? (
              <View style={{ marginBottom: 16, padding: 12, backgroundColor: COLORS.surfaceContainerHighest, borderRadius: 12 }}>
                <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>
                  Auto-lock requires a PIN or biometric to be set up first.
                </Text>
              </View>
            ) : null}
            {LOCK_TIMEOUT_OPTIONS.map((option) => {
              const selected = option.value === lockTimeoutMinutes;
              // Disable all options except "None" when no unlock method is set
              const isDisabled = !hasUnlockMethod && option.value !== -1;
              return (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    styles.optionRow,
                    pressed && !isDisabled && styles.optionRowPressed,
                    isDisabled && { opacity: 0.35 },
                  ]}
                  onPress={() => {
                    if (isDisabled) return;
                    setLockTimeoutMinutes(option.value);
                    void saveDriverSessionSnapshotFromStores();
                    setActiveModal(null);
                  }}
                >
                  <View style={styles.optionTextWrap}>
                    <Text style={[FONTS.bodyMd, { color: COLORS.onSurface }]}>{option.label}</Text>
                    {option.value === -1 ? (
                      <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>App never locks automatically</Text>
                    ) : null}
                    {option.value === 0 ? (
                      <Text style={[FONTS.bodySm, { color: COLORS.tertiary }]}>Lock as soon as app backgrounds</Text>
                    ) : null}
                  </View>
                  {selected ? (
                    <MaterialIcons name="check" size={20} color={COLORS.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
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

  // â”€â”€â”€ Sub-page screen (replaces list entirely) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ Main settings list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Tasks â€“ verification requirements */}
        {(() => {
          const accountStatus = verificationProgress?.account_verification?.status ?? null;
          const vehicleDocs = verificationProgress?.vehicle_documents ?? [];
          const allVehicleApproved = vehicleDocs.length > 0 && vehicleDocs.every((d: any) => d.status === 'approved');
          const isFullyVerified = accountStatus === 'approved' && allVehicleApproved;

          if (isFullyVerified) return null;

          return (
            <>
              <Text style={styles.sectionTitle}>TASKS</Text>
              <View style={[styles.card, AMBIENT_SHADOW]}>
                {!accountStatus && (
                  <SettingsRow
                    icon="account-circle"
                    title="Complete Account Verification"
                    subtitle="Submit your identity documents to start accepting rides"
                    onPress={onStartAccountVerification}
                  />
                )}
                {accountStatus === 'pending' || accountStatus === 'under_review' ? (
                  <SettingsRow
                    icon="hourglass-top"
                    title="Account Verification Under Review"
                    subtitle="Your submission is being reviewed by campus admin"
                    trailing={<View style={taskStyles.statusPill}><Text style={taskStyles.statusPillText}>Pending</Text></View>}
                  />
                ) : null}
                {accountStatus === 'rejected' ? (
                  <SettingsRow
                    icon="error"
                    title="Account Verification Rejected"
                    subtitle="Your submission was rejected. Please resubmit."
                    onPress={onStartAccountVerification}
                  />
                ) : null}
                {accountStatus === 'approved' && !allVehicleApproved ? (
                  <SettingsRow
                    icon="directions-car"
                    title="Upload Vehicle Documents"
                    subtitle="Account verified! Now upload your vehicle documents."
                    onPress={onStartVehicleVerification}
                    isLast
                  />
                ) : null}
              </View>
            </>
          );
        })()}

        {/* App Settings */}
        <Text style={styles.sectionTitle}>APP SETTINGS</Text>
        <View style={[styles.card, AMBIENT_SHADOW]}>
          <SettingsRow
            icon="language"
            title="Language"
            trailing={<ValueChevron value={languageLabel} />}
            onPress={() => setActiveModal('language')}
          />
          <SettingsRow
            icon="notifications"
            title="Push Notifications"
            trailing={
              <ToggleSwitch
                value={settings.pushEnabled}
                onValueChange={(value) => updateSetting(
                  { pushEnabled: value },
                  { push_enabled: value }
                )}
              />
            }
          />
          <SettingsRow
            icon="dark-mode"
            title="Dark Mode"
            trailing={
              <ToggleSwitch
                value={isDarkMode}
                onValueChange={(value) => updateSetting(
                  { themeMode: value ? 'dark' : 'light' },
                  { theme_mode: value ? 'dark' : 'light' }
                )}
              />
            }
          />
          <SettingsRow
            icon="map"
            title="Navigation App"
            trailing={<ValueChevron value={navigationLabel} />}
            isLast
            onPress={() => setActiveModal('navigationApp')}
          />
        </View>

        {/* Security */}
        <Text style={styles.sectionTitle}>SECURITY</Text>
        <View style={[styles.card, AMBIENT_SHADOW]}>
          <SettingsRow icon="lock" title="Change PIN" onPress={() => setActiveModal('changePin')} />
          <SettingsRow
            icon="timer"
            title="Auto-lock"
            subtitle={hasUnlockMethod ? 'Lock when app is backgrounded' : 'Set a PIN to enable auto-lock'}
            trailing={<ValueChevron value={lockTimeoutLabel} />}
            onPress={() => setActiveModal('lockTimeout')}
          />
          <SettingsRow
            icon="verified-user"
            title="Two-Factor Auth"
            onPress={() => setActiveModal('twoFactor')}
          />
          <SettingsRow
            icon="fingerprint"
            title="Biometric Lock"
            trailing={
              <ToggleSwitch
                value={settings.biometricEnabled}
                onValueChange={async (value) => {
                  if (!value && !settings.hasPin) {
                    Alert.alert('PIN required', 'Set a PIN before turning off biometric lock.');
                    return;
                  }

                  if (value) {
                    try {
                      const LocalAuth = await import('expo-local-authentication');
                      const [hasHardware, enrolled] = await Promise.all([
                        LocalAuth.hasHardwareAsync(),
                        LocalAuth.isEnrolledAsync(),
                      ]);

                      if (!hasHardware || !enrolled) {
                        Alert.alert('Biometrics unavailable', 'Set up biometrics on this device first.');
                        return;
                      }

                      const result = await LocalAuth.authenticateAsync({
                        promptMessage: 'Enable biometric unlock',
                        fallbackLabel: settings.hasPin ? 'Use PIN' : undefined,
                      });

                      if (!result.success) {
                        return;
                      }
                    } catch (error) {
                      Alert.alert('Biometrics unavailable', 'This device cannot enable biometric unlock.');
                      return;
                    }
                  }

                  updateSetting(
                    { biometricEnabled: value },
                    { biometric_enabled: value }
                  );
                }}
              />
            }
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
              { text: 'Logout', style: 'destructive', onPress: () => { onLogout(); onBack(); } },
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

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    ...FONTS.bodySm,
    color: COLORS.tertiary,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerHighest,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surfaceContainerLowest,
    color: COLORS.onSurface,
    fontSize: 16,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    ...FONTS.labelLg,
    color: COLORS.onPrimary,
  },
  dangerButton: {
    marginTop: 12,
    backgroundColor: COLORS.errorContainer,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  dangerButtonPressed: {
    opacity: 0.9,
  },
  dangerButtonText: {
    ...FONTS.labelLg,
    color: COLORS.error,
  },
  noticeCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceContainerLow,
    gap: 6,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  optionRowPressed: {
    backgroundColor: COLORS.surfaceContainerHighest,
  },
  optionTextWrap: {
    gap: 2,
  },
});

const taskStyles = StyleSheet.create({
  statusPill: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1565C0',
  },
});
