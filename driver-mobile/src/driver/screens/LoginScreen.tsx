import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { COLORS, FONTS } from '../../core/theme'
import LoadingOverlay from '../components/LoadingOverlay'
import { useAuthStore } from '../../core/authStore'
import api, { settingsApi } from '../../core/api'
import { API_BASE_URL } from '../../../config/apiConfig'

const HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAA82KcXqZA4aHsjymqPMgdvEZRGk709r3ShwzbAzJ8J02R4R9yYQBuSRB6CipocQbryqJU-vvfYEul4xdS4YCAM8FXGE4GyIBFMZwr62VcRKfKHrr4UW3lmGmpM5LoX5kAryoXAqHZNXu9sHQbSZFX6V740qIlrjIKL-OgE_3WngEHD6H2X2e3HmRdeYb7PmCuwu78N8Yad9Yv79YyclATBuXvhZXk2TywTHX2VYzFseo0xADkxCP9y1vThe2hUuhW1Kv2UR176W0'

export default function DriverLoginScreen() {
  const [isRegistering, setIsRegistering] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registerFirstName, setRegisterFirstName] = useState('')
  const [registerLastName, setRegisterLastName] = useState('')
  const [registerPhone, setRegisterPhone] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')
  const [registerConsent, setRegisterConsent] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState('')
  const [twoFactorRequired, setTwoFactorRequired] = useState(false)
  const [twoFactorMethods, setTwoFactorMethods] = useState<string[]>([])
  const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'sms' | 'email' | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorChallenge, setTwoFactorChallenge] = useState('')
  const [twoFactorBusy, setTwoFactorBusy] = useState(false)
  const setAuth = useAuthStore((state) => state.setAuth)
  const availableTwoFactorMethods = twoFactorMethods.length
    ? twoFactorMethods
    : ['totp', 'sms', 'email']

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 10000)
      return () => clearTimeout(timer)
    }
  }, [error])

  useEffect(() => {
    if (registerError) {
      const timer = setTimeout(() => setRegisterError(''), 10000)
      return () => clearTimeout(timer)
    }
  }, [registerError])

  // Clear errors when switching tabs
  const handleTabSwitch = (isReg: boolean) => {
    setIsRegistering(isReg)
    setError('')
    setRegisterError('')
  }

  const getApiErrorMessage = (err: any, fallback: string) => {
    const message = err?.response?.data?.error?.message
    if (message && message !== 'An error occurred.') {
      return message
    }

    const details = err?.response?.data?.error?.details
    if (details && typeof details === 'object') {
      const firstDetail = Object.values(details)[0] as any
      if (Array.isArray(firstDetail) && firstDetail.length > 0) {
        return String(firstDetail[0])
      }
      if (typeof firstDetail === 'string') {
        return firstDetail
      }
    }

    if (!err?.response) {
      const msg = err?.message ? ` (${err.message})` : ''
      return `Cannot reach server${msg}. Ensure backend is reachable at ${API_BASE_URL}`
    }

    return fallback
  }

  const handleLogin = async () => {
    if (!identifier || !password) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    setError('')

    const trimmedIdentifier = identifier.trim()
    const payload = trimmedIdentifier.includes('@')
      ? { email: trimmedIdentifier, password }
      : { phone_number: trimmedIdentifier, password }

    const MAX_RETRIES = 2
    try {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const loginRes = await api.post('auth/login/', payload, { timeout: 25000 })

          if (loginRes.data?.two_factor_required) {
            setTwoFactorRequired(true)
            setTwoFactorMethods(loginRes.data.methods || [])
            setTwoFactorChallenge(loginRes.data.login_challenge || '')
            setTwoFactorMethod((loginRes.data.methods || [])[0] || 'totp')
            setTwoFactorCode('')
            return
          }

          // Login response includes enriched user payload — no need for a separate /users/me/ call
          setAuth(loginRes.data.user, loginRes.data.access, loginRes.data.refresh)
          return
        } catch (err: any) {
          const isNetworkError = !err?.response
          const isRetryable = isNetworkError || err?.response?.status >= 500

          if (isRetryable && attempt < MAX_RETRIES) {
            // Exponential backoff: 1s, 2s
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
            continue
          }

          setError(getApiErrorMessage(err, 'Login failed. Please try again.'))
          return
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleTwoFactorRequest = async (method: 'totp' | 'sms' | 'email') => {
    setTwoFactorMethod(method)
    if (method === 'totp') {
      return
    }
    setTwoFactorBusy(true)
    try {
      await settingsApi.requestTwoFactor({ login_challenge: twoFactorChallenge, method })
      Alert.alert('Code sent', `A verification code was sent via ${method}.`)
    } catch (err) {
      Alert.alert('2FA failed', 'Unable to send verification code.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const handleTwoFactorVerify = async () => {
    if (!twoFactorMethod || !twoFactorCode) {
      setError('Enter your verification code')
      return
    }
    setTwoFactorBusy(true)
    setError('')
    try {
      const res = await settingsApi.verifyTwoFactor({
        login_challenge: twoFactorChallenge,
        method: twoFactorMethod,
        code: twoFactorCode,
      })
      setAuth(res.data.user, res.data.access, res.data.refresh)
      setTwoFactorRequired(false)
      setTwoFactorCode('')
      setTwoFactorChallenge('')
      setTwoFactorMethods([])
      setTwoFactorMethod(null)
    } catch (err: any) {
      setError(getApiErrorMessage(err, '2FA verification failed.'))
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const handleRegister = async () => {
    if (!registerFirstName || !registerLastName || !registerPhone || !registerPassword) {
      setRegisterError('Please fill in all fields')
      return
    }

    if (registerPassword !== registerConfirmPassword) {
      setRegisterError('Passwords do not match')
      return
    }

    if (!registerConsent) {
      setRegisterError('You must accept the data consent policy')
      return
    }

    setRegisterLoading(true)
    setRegisterError('')

    try {
      const payload = {
        phone_number: registerPhone.trim(),
        first_name: registerFirstName.trim(),
        last_name: registerLastName.trim(),
        password: registerPassword,
        confirm_password: registerConfirmPassword,
        role: 'driver',
        data_consent_given: registerConsent,
      }

      await api.post('auth/register/', payload)

      Alert.alert('Create Account', 'Account created. Please log in with your phone number and password.')
      setIsRegistering(false)
      setIdentifier(registerPhone.trim())
      setPassword('')
      setRegisterPassword('')
      setRegisterConfirmPassword('')
    } catch (err: any) {
      setRegisterError(getApiErrorMessage(err, 'Registration failed. Please try again.'))
    } finally {
      setRegisterLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      {(error || registerError) ? (
        <View style={styles.floatingPill}>
          <MaterialIcons name="error-outline" size={18} color={COLORS.error} />
          <Text style={styles.pillText}>{error || registerError}</Text>
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.card}>
            <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.hero} resizeMode="cover">
              <View style={styles.heroOverlay} />
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroTitle}>Driver Portal</Text>
                <Text style={styles.heroSubtitle}>LR Ride Campus Transit</Text>
              </View>
            </ImageBackground>

            <ScrollView
              contentContainerStyle={styles.formScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <View style={styles.formArea}>
            <View style={styles.tabs}>
              <Pressable
                style={[styles.tab, !isRegistering && styles.tabActive]}
                onPress={() => handleTabSwitch(false)}
              >
                <Text style={!isRegistering ? styles.tabActiveText : styles.tabText}>Login</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, isRegistering && styles.tabActive]}
                onPress={() => handleTabSwitch(true)}
              >
                <Text style={isRegistering ? styles.tabActiveText : styles.tabText}>Create Account</Text>
              </Pressable>
            </View>

            {isRegistering ? (
              <>
                <View style={styles.inputGroup}>
                  <MaterialIcons name="person" size={20} color="#5e5e5e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="First Name"
                    placeholderTextColor="#7b7b7b"
                    value={registerFirstName}
                    onChangeText={setRegisterFirstName}
                    autoCapitalize="words"
                    editable={!registerLoading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <MaterialIcons name="person" size={20} color="#5e5e5e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Last Name"
                    placeholderTextColor="#7b7b7b"
                    value={registerLastName}
                    onChangeText={setRegisterLastName}
                    autoCapitalize="words"
                    editable={!registerLoading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <MaterialIcons name="phone" size={20} color="#5e5e5e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Phone Number"
                    placeholderTextColor="#7b7b7b"
                    value={registerPhone}
                    onChangeText={setRegisterPhone}
                    autoCapitalize="none"
                    keyboardType="phone-pad"
                    editable={!registerLoading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <MaterialIcons name="lock" size={20} color="#5e5e5e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#7b7b7b"
                    value={registerPassword}
                    onChangeText={setRegisterPassword}
                    secureTextEntry={!showPassword}
                    editable={!registerLoading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <MaterialIcons name="lock" size={20} color="#5e5e5e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#7b7b7b"
                    value={registerConfirmPassword}
                    onChangeText={setRegisterConfirmPassword}
                    secureTextEntry={!showPassword}
                    editable={!registerLoading}
                  />
                  <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeButton}>
                    <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#5e5e5e" />
                  </Pressable>
                </View>

                <Pressable
                  style={styles.consentRow}
                  onPress={() => setRegisterConsent((prev) => !prev)}
                >
                  <MaterialIcons
                    name={registerConsent ? 'check-box' : 'check-box-outline-blank'}
                    size={20}
                    color={registerConsent ? '#6A1B9A' : '#7b7b7b'}
                  />
                  <Text style={styles.consentText}>I accept the data consent policy</Text>
                </Pressable>

                <TouchableOpacity
                  style={[styles.primaryButton, registerLoading && styles.primaryButtonDisabled]}
                  onPress={handleRegister}
                  disabled={registerLoading}
                  activeOpacity={0.9}
                >
                  <Text style={styles.primaryButtonText}>Create Driver Account</Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
                </TouchableOpacity>

              </>
            ) : (
              <>
                {twoFactorRequired ? (
                  <>
                    <Text style={styles.sectionTitle}>Two-Factor Verification</Text>
                    <View style={styles.methodRow}>
                      {availableTwoFactorMethods.includes('totp') ? (
                        <TouchableOpacity
                          style={[styles.methodChip, twoFactorMethod === 'totp' && styles.methodChipActive]}
                          onPress={() => handleTwoFactorRequest('totp')}
                        >
                          <Text style={twoFactorMethod === 'totp' ? styles.methodChipTextActive : styles.methodChipText}>TOTP</Text>
                        </TouchableOpacity>
                      ) : null}
                      {availableTwoFactorMethods.includes('sms') ? (
                        <TouchableOpacity
                          style={[styles.methodChip, twoFactorMethod === 'sms' && styles.methodChipActive]}
                          onPress={() => handleTwoFactorRequest('sms')}
                        >
                          <Text style={twoFactorMethod === 'sms' ? styles.methodChipTextActive : styles.methodChipText}>SMS</Text>
                        </TouchableOpacity>
                      ) : null}
                      {availableTwoFactorMethods.includes('email') ? (
                        <TouchableOpacity
                          style={[styles.methodChip, twoFactorMethod === 'email' && styles.methodChipActive]}
                          onPress={() => handleTwoFactorRequest('email')}
                        >
                          <Text style={twoFactorMethod === 'email' ? styles.methodChipTextActive : styles.methodChipText}>Email</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <View style={styles.inputGroup}>
                      <MaterialIcons name="verified-user" size={20} color="#5e5e5e" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Verification code"
                        placeholderTextColor="#7b7b7b"
                        value={twoFactorCode}
                        onChangeText={setTwoFactorCode}
                        keyboardType="number-pad"
                        editable={!twoFactorBusy}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.primaryButton, twoFactorBusy && styles.primaryButtonDisabled]}
                      onPress={handleTwoFactorVerify}
                      disabled={twoFactorBusy}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.primaryButtonText}>Verify & Continue</Text>
                      <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                <View style={styles.inputGroup}>
                  <MaterialIcons name="person" size={20} color="#5e5e5e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email or Phone Number"
                    placeholderTextColor="#7b7b7b"
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <MaterialIcons name="lock" size={20} color="#5e5e5e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password or PIN"
                    placeholderTextColor="#7b7b7b"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                  />
                  <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeButton}>
                    <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#5e5e5e" />
                  </Pressable>
                </View>

                <View style={styles.forgotWrap}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  <Text style={styles.primaryButtonText}>Secure Login</Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
                </TouchableOpacity>

                  </>
                )}
              </>
            )}

            <View style={styles.securityBadge}>
              <MaterialIcons name="verified-user" size={14} color="#7b7b7b" />
              <Text style={styles.securityText}>VERIFIED SECURE PORTAL</Text>
            </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
      <LoadingOverlay visible={loading || registerLoading || twoFactorBusy} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  formScrollContent: {
    flexGrow: 1,
  },
  hero: {
    height: 190,
    justifyContent: 'flex-end',
    padding: 24,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  heroTextWrap: {
    position: 'relative',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#e5e5e5',
  },
  formArea: {
    paddingHorizontal: 12,
    paddingBottom: 32,
    paddingTop: 18,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7b7b7b',
  },
  tabActiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 10,
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f3f3f3',
    borderWidth: 1,
    borderColor: '#e2e2e2',
  },
  methodChipActive: {
    backgroundColor: '#6A1B9A',
    borderColor: '#6A1B9A',
  },
  methodChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  methodChipTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f3f3',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1a1c1c',
  },
  eyeButton: {
    padding: 4,
  },
  forgotWrap: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  primaryButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6A1B9A',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e2e2',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7b7b7b',
  },
  secondaryButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f3f3f3',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e2e2',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  consentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6a6a6a',
  },
  switchModeRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  switchModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  securityBadge: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  securityText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7b7b7b',
    letterSpacing: 1.2,
  },
  floatingPill: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorContainer || '#ffdad6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 100,
  },
  pillText: {
    fontSize: 13,
    color: COLORS.error || '#ba1a1a',
    fontWeight: '600',
  },
})
