import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useEffect, useState } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { useAuthStore } from '../../core/authStore'
import api from '../../core/api'

const ILLUSTRATION_IMAGE = require('../../homeslide3-1-1024x499.png')
const studentEmailRegex = /^[A-Za-z]+\.[mM]\d+@st\.futminna\.edu\.ng$/

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
    return 'Cannot reach server. Ensure backend is running on 0.0.0.0:8002 and your phone is on the same Wi-Fi.'
  }

  return fallback
}

export default function StudentLoginScreen() {
  const [isSignup, setIsSignup] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState('')
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const setAuth = useAuthStore((state) => state.setAuth)

  useEffect(() => {
    const keyboardShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const keyboardHideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSubscription = Keyboard.addListener(keyboardShowEvent, () => {
      setIsKeyboardOpen(true)
    })
    const hideSubscription = Keyboard.addListener(keyboardHideEvent, () => {
      setIsKeyboardOpen(false)
    })

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [])

  const handleLogin = async () => {
    const email = identifier.trim().toLowerCase()
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    if (!studentEmailRegex.test(email)) {
      setError('Use format name.m1234567@st.futminna.edu.ng')
      return
    }

    setLoading(true)
    setError('')

    try {
      const loginRes = await api.post('/auth/login/', { email, password })

      const userRes = await api.get('/users/me/', {
        headers: { Authorization: `Bearer ${loginRes.data.access}` },
      })

      setAuth(userRes.data, loginRes.data.access, loginRes.data.refresh)
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Login failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    const email = signupEmail.trim().toLowerCase()
    if (!email || !signupPassword) {
      setSignupError('Please fill in all fields')
      return
    }

    if (!studentEmailRegex.test(email)) {
      setSignupError('Use format name.m1234567@st.futminna.edu.ng')
      return
    }

    setSignupLoading(true)
    setSignupError('')

    try {
      await api.post('/auth/register/', {
        email,
        password: signupPassword,
        confirm_password: signupPassword,
        role: 'student',
        data_consent_given: true,
      })
      setIsSignup(false)
      setIdentifier(email)
      setSignupPassword('')
      Alert.alert('Create Account', 'Account created. Please log in with your email and password.')
    } catch (err: any) {
      setSignupError(getApiErrorMessage(err, 'Registration failed. Please try again.'))
    } finally {
      setSignupLoading(false)
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
        scrollEnabled={isKeyboardOpen}
        bounces={isKeyboardOpen}
      >
        <View style={styles.header}>
          <View style={styles.heroCard}>
            <Image source={ILLUSTRATION_IMAGE} style={styles.heroImage} />
            <View style={styles.heroOverlay} />
            <View style={styles.heroLabelWrap}>
              <Text style={styles.heroLabel}>Campus Transit</Text>
              <Text style={styles.welcomeSubtitle}>
                Secure, fast, and reliable rides across FUTMINNA campus.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, !isSignup && styles.tabActive]}
              onPress={() => setIsSignup(false)}
            >
              <Text style={!isSignup ? styles.tabActiveText : styles.tabText}>Login</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, isSignup && styles.tabActive]}
              onPress={() => setIsSignup(true)}
            >
              <Text style={isSignup ? styles.tabActiveText : styles.tabText}>Create Account</Text>
            </Pressable>
          </View>

          {isSignup ? (
            <>
              {signupError ? <Text style={styles.errorText}>{signupError}</Text> : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>University Email</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="mail" size={20} color="#5e5e5e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Your university student email"
                    placeholderTextColor="#c6c6c6"
                    value={signupEmail}
                    onChangeText={setSignupEmail}
                    editable={!signupLoading}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.passwordRow}>
                  <Text style={styles.label}>Password</Text>
                </View>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="lock" size={20} color="#5e5e5e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#c6c6c6"
                    value={signupPassword}
                    onChangeText={setSignupPassword}
                    secureTextEntry={!showPassword}
                    editable={!signupLoading}
                  />
                  <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeButton}>
                    <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#5e5e5e" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.infoBox}>
                <MaterialIcons name="badge" size={18} color="#5e5e5e" style={styles.infoIcon} />
                <Text style={styles.infoText}>
                  New accounts require FUTMINNA Student ID verification during onboarding.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, signupLoading && styles.primaryButtonDisabled]}
                onPress={handleSignup}
                disabled={signupLoading}
                activeOpacity={0.85}
              >
                {signupLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Create Account</Text>
                    <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>University Email</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="mail" size={20} color="#5e5e5e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Your university student email"
                    placeholderTextColor="#c6c6c6"
                    value={identifier}
                    onChangeText={setIdentifier}
                    editable={!loading}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.passwordRow}>
                  <Text style={styles.label}>Password</Text>
                  <Pressable>
                    <Text style={styles.forgotText}>Forgot?</Text>
                  </Pressable>
                </View>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="lock" size={20} color="#5e5e5e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#c6c6c6"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                  />
                  <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeButton}>
                    <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#5e5e5e" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.infoBox}>
                <MaterialIcons name="badge" size={18} color="#5e5e5e" style={styles.infoIcon} />
                <Text style={styles.infoText}>
                  New accounts require FUTMINNA Student ID verification during onboarding.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Login Securely</Text>
                    <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
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
    paddingHorizontal: 10,
    paddingVertical: 32,
    paddingBottom: 64,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroCard: {
    width: '100%',
    height: 320,
    borderRadius: 24,
    backgroundColor: '#f3f3f3',
    borderWidth: 4,
    borderColor: '#ffffff',
    overflow: 'hidden',
    marginBottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroLabelWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#f9f9f9d2',
    textAlign: 'center',
    maxWidth: 280,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f3f3f3',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    marginBottom: 32,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f3f3',
    padding: 4,
    borderRadius: 999,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabActiveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5e5e5e',
  },
  errorText: {
    color: '#ba1a1a',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3d4a3e',
    marginLeft: 8,
    marginBottom: 6,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 2,
  },
  input: {
    width: '100%',
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    paddingVertical: 12,
    paddingLeft: 44,
    paddingRight: 44,
    fontSize: 16,
    color: '#1a1c1c',
    height: 48,
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 6,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9937d6',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
  },
  infoBox: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#eeeeee',
    borderWidth: 1,
    borderColor: '#e2e2e2',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginTop: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#5e5e5e',
    flex: 1,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#9937d6',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#9937d6',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
})
