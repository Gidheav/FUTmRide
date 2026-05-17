import {
  ActivityIndicator,
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
import { useState } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { useAuthStore } from '../../core/authStore'
import api from '../../core/api'
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
  const setAuth = useAuthStore((state) => state.setAuth)

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

    try {
      const trimmedIdentifier = identifier.trim()
      const payload = trimmedIdentifier.includes('@')
        ? { email: trimmedIdentifier, password }
        : { phone_number: trimmedIdentifier, password }
      const loginRes = await api.post('auth/login/', payload)

      const userRes = await api.get('users/me/', {
        headers: { Authorization: `Bearer ${loginRes.data.access}` },
      })

      setAuth(userRes.data, loginRes.data.access, loginRes.data.refresh)
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Login failed. Please try again.'))
    } finally {
      setLoading(false)
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
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.hero} resizeMode="cover">
            <View style={styles.heroOverlay} />
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>Driver Portal</Text>
              <Text style={styles.heroSubtitle}>LR Ride Campus Transit</Text>
            </View>
          </ImageBackground>

          <View style={styles.formArea}>
            <View style={styles.tabs}>
              <Pressable
                style={[styles.tab, !isRegistering && styles.tabActive]}
                onPress={() => setIsRegistering(false)}
              >
                <Text style={!isRegistering ? styles.tabActiveText : styles.tabText}>Login</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, isRegistering && styles.tabActive]}
                onPress={() => setIsRegistering(true)}
              >
                <Text style={isRegistering ? styles.tabActiveText : styles.tabText}>Create Account</Text>
              </Pressable>
            </View>

            {isRegistering ? (
              <>
                {registerError ? <Text style={styles.errorText}>{registerError}</Text> : null}

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
                  {registerLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Create Driver Account</Text>
                      <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
                    </>
                  )}
                </TouchableOpacity>

                <Pressable style={styles.switchModeRow} onPress={() => setIsRegistering(false)}>
                  <Text style={styles.switchModeText}>Already have an account? Login</Text>
                </Pressable>
              </>
            ) : (
              <>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Secure Login</Text>
                      <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>New to the fleet?</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  activeOpacity={0.9}
                  onPress={() => setIsRegistering(true)}
                >
                  <MaterialIcons name="directions-car" size={18} color="#1a1c1c" />
                  <Text style={styles.secondaryButtonText}>Create Driver Account</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.securityBadge}>
              <MaterialIcons name="verified-user" size={14} color="#7b7b7b" />
              <Text style={styles.securityText}>VERIFIED SECURE PORTAL</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
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
  errorText: {
    color: '#ba1a1a',
    fontWeight: '600',
    fontSize: 12,
    marginBottom: 8,
  },
})
