import {
  ActivityIndicator,
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

const HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAA82KcXqZA4aHsjymqPMgdvEZRGk709r3ShwzbAzJ8J02R4R9yYQBuSRB6CipocQbryqJU-vvfYEul4xdS4YCAM8FXGE4GyIBFMZwr62VcRKfKHrr4UW3lmGmpM5LoX5kAryoXAqHZNXu9sHQbSZFX6V740qIlrjIKL-OgE_3WngEHD6H2X2e3HmRdeYb7PmCuwu78N8Yad9Yv79YyclATBuXvhZXk2TywTHX2VYzFseo0xADkxCP9y1vThe2hUuhW1Kv2UR176W0'

export default function DriverLoginScreen() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setAuth = useAuthStore((state) => state.setAuth)

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
      const loginRes = await api.post('/auth/login/', payload)

      const userRes = await api.get('/users/me/', {
        headers: { Authorization: `Bearer ${loginRes.data.access}` },
      })

      setAuth(userRes.data, loginRes.data.access, loginRes.data.refresh)
    } catch (err: any) {
      const apiError = err?.response?.data?.error
      const apiMessage = typeof apiError === 'string' ? apiError : apiError?.message
      setError(apiMessage || err?.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
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
              <Pressable style={[styles.tab, styles.tabActive]}>
                <Text style={styles.tabActiveText}>Phone / Email</Text>
              </Pressable>
              <Pressable style={styles.tab}>
                <Text style={styles.tabText}>Driver ID</Text>
              </Pressable>
            </View>

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

            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9}>
              <MaterialIcons name="directions-car" size={18} color="#1a1c1c" />
              <Text style={styles.secondaryButtonText}>Register Vehicle</Text>
            </TouchableOpacity>

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
