import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
  ActivityIndicator,
} from 'react-native'
import { useEffect, useState } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../core/authStore'
import api from '../../core/api'
import LoadingOverlay from '../components/LoadingOverlay'

const ILLUSTRATION_IMAGE = require('../../homeslide3-1-1024x499.png')
const studentEmailRegex = /^[A-Za-z]+\.[mM]\d+@st\.futminna\.edu\.ng$/
const verificationCodeRegex = /^\d{6}$/

// Keep a short fallback list so mobile can work across minor backend route name differences.
const STUDENT_SIGNUP_OTP_REQUEST_ENDPOINTS = [
  'auth/register/request-email-otp/',
  'auth/register/request-verification-code/',
  'auth/register/student/request-verification/',
  'auth/otp/email/request/',
]

const STUDENT_SIGNUP_OTP_VERIFY_ENDPOINTS = [
  'auth/register/verify-email-otp/',
  'auth/register/verify-verification-code/',
  'auth/register/student/verify-code/',
  'auth/otp/email/verify/',
]

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
    const code = String(err?.code || '').toUpperCase()
    const rawMessage = String(err?.message || '')
    const timeoutLike = code === 'ECONNABORTED' || rawMessage.toLowerCase().includes('timeout')

    if (timeoutLike) {
      return 'The connection is taking too long. Please check your internet connection and try again.'
    }

    return 'Please check your internet connection and try again.'
  }

  return fallback
}

const postToFirstAvailableEndpoint = async (
  endpoints: string[],
  payload: Record<string, unknown>,
  timeoutMs = 10000,
) => {
  let lastError: any = null

  for (const endpoint of endpoints) {
    try {
      return await api.post(endpoint, payload, { timeout: timeoutMs })
    } catch (err: any) {
      const statusCode = err?.response?.status
      if (statusCode === 404 || statusCode === 405) {
        lastError = err
        continue
      }
      throw err
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('Verification service is unavailable.')
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
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationModalVisible, setVerificationModalVisible] = useState(false)
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [verificationResendLoading, setVerificationResendLoading] = useState(false)
  const [verificationError, setVerificationError] = useState('')
  const [verificationStatusMessage, setVerificationStatusMessage] = useState('')
  const [pendingSignupData, setPendingSignupData] = useState<{ email: string; password: string } | null>(null)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const setAuth = useAuthStore((state) => state.setAuth)

  // Forgot Password States
  const [forgotPasswordModalVisible, setForgotPasswordModalVisible] = useState(false)
  const [forgotPasswordStep, setForgotPasswordStep] = useState<1 | 2>(1)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordCode, setForgotPasswordCode] = useState('')
  const [forgotPasswordNewPassword, setForgotPasswordNewPassword] = useState('')
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false)
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordError, setForgotPasswordError] = useState('')
  const [forgotPasswordSuccessMessage, setForgotPasswordSuccessMessage] = useState('')

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

    const MAX_RETRIES = 2
    try {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const loginRes = await api.post('auth/login/', { email, password }, { timeout: 20000 })

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
    setVerificationError('')

    try {
      const verificationResponse = await postToFirstAvailableEndpoint(
        STUDENT_SIGNUP_OTP_REQUEST_ENDPOINTS,
        {
          email,
          password: signupPassword,
          confirm_password: signupPassword,
          role: 'student',
          data_consent_given: true,
        },
        30000,
      )

      setPendingSignupData({ email, password: signupPassword })
      setVerificationCode('')
      setVerificationStatusMessage(
        verificationResponse?.data?.message ||
        `Verification code sent to ${email}. Enter the code to finish creating your account.`,
      )
      setVerificationModalVisible(true)
    } catch (err: any) {
      setSignupError(getApiErrorMessage(err, 'Unable to send verification code. Please try again.'))
    } finally {
      setSignupLoading(false)
    }
  }

  const handleCloseVerificationModal = () => {
    if (verificationLoading || verificationResendLoading) {
      return
    }
    setVerificationModalVisible(false)
    setVerificationCode('')
    setVerificationError('')
    setVerificationStatusMessage('')
    setPendingSignupData(null)
  }

  const handleResendVerificationCode = async () => {
    if (!pendingSignupData?.email) {
      setVerificationError('Signup session expired. Please try creating your account again.')
      return
    }

    setVerificationResendLoading(true)
    setVerificationError('')

    try {
      const resendResponse = await postToFirstAvailableEndpoint(
        STUDENT_SIGNUP_OTP_REQUEST_ENDPOINTS,
        {
          email: pendingSignupData.email,
          password: pendingSignupData.password,
          confirm_password: pendingSignupData.password,
          role: 'student',
          data_consent_given: true,
        },
        30000,
      )
      setVerificationStatusMessage(
        resendResponse?.data?.message ||
        `A new verification code has been sent to ${pendingSignupData.email}.`,
      )
    } catch (err: any) {
      setVerificationError(getApiErrorMessage(err, 'Failed to resend verification code.'))
    } finally {
      setVerificationResendLoading(false)
    }
  }

  const handleVerifyCodeAndCreateAccount = async () => {
    if (!pendingSignupData) {
      setVerificationError('Signup session expired. Please create your account again.')
      return
    }

    const code = verificationCode.trim()
    if (!verificationCodeRegex.test(code)) {
      setVerificationError('Enter the 6-digit verification code sent to your email.')
      return
    }

    setVerificationLoading(true)
    setVerificationError('')

    try {
      const verifyResponse = await postToFirstAvailableEndpoint(
        STUDENT_SIGNUP_OTP_VERIFY_ENDPOINTS,
        {
          email: pendingSignupData.email,
          code,
        },
        30000,
      )

      const verificationToken = verifyResponse?.data?.verification_token
      if (!verificationToken) {
        setVerificationError('Verification succeeded but token was missing. Please request a new code.')
        return
      }

      await api.post('auth/register/', {
        email: pendingSignupData.email,
        password: pendingSignupData.password,
        confirm_password: pendingSignupData.password,
        verification_token: verificationToken,
        role: 'student',
        data_consent_given: true,
      }, { timeout: 30000 })

      setVerificationModalVisible(false)
      setPendingSignupData(null)
      setVerificationCode('')
      setVerificationStatusMessage('')
      setIsSignup(false)
      setIdentifier(pendingSignupData.email)
      setSignupPassword('')
    } catch (err: any) {
      setVerificationError(getApiErrorMessage(err, 'Verification failed. Please try again.'))
    } finally {
      setVerificationLoading(false)
    }
  }

  const handleForgotPasswordRequest = async () => {
    const email = forgotPasswordEmail.trim().toLowerCase()
    if (!email) {
      setForgotPasswordError('Please enter your university email')
      return
    }
    if (!studentEmailRegex.test(email)) {
      setForgotPasswordError('Use format name.m1234567@st.futminna.edu.ng')
      return
    }

    setForgotPasswordLoading(true)
    setForgotPasswordError('')
    setForgotPasswordSuccessMessage('')

    try {
      const response = await api.post('auth/password-reset/request/', { email }, { timeout: 20000 })
      setForgotPasswordSuccessMessage(response.data?.message || `A password reset code has been sent to ${email}.`)
      setForgotPasswordStep(2)
      setForgotPasswordCode('')
      setForgotPasswordNewPassword('')
    } catch (err: any) {
      setForgotPasswordError(getApiErrorMessage(err, 'Failed to send reset code. Please try again.'))
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const handleForgotPasswordConfirm = async () => {
    const email = forgotPasswordEmail.trim().toLowerCase()
    const code = forgotPasswordCode.trim()

    if (!verificationCodeRegex.test(code)) {
      setForgotPasswordError('Enter the 6-digit verification code.')
      return
    }
    if (forgotPasswordNewPassword.length < 8) {
      setForgotPasswordError('New password must be at least 8 characters.')
      return
    }

    setForgotPasswordLoading(true)
    setForgotPasswordError('')

    try {
      await api.post('auth/password-reset/confirm/', {
        email,
        code,
        new_password: forgotPasswordNewPassword,
        confirm_password: forgotPasswordNewPassword
      }, { timeout: 20000 })

      setForgotPasswordModalVisible(false)
      setIdentifier(email)
      setPassword('')
      Alert.alert('Success', 'Your password has been reset successfully. You can now log in.')
    } catch (err: any) {
      setForgotPasswordError(getApiErrorMessage(err, 'Failed to reset password. Please verify the code and try again.'))
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const handleCloseForgotPasswordModal = () => {
    if (forgotPasswordLoading) return
    setForgotPasswordModalVisible(false)
    setForgotPasswordError('')
    setForgotPasswordSuccessMessage('')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      <KeyboardAvoidingView
        style={styles.page}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.header}>
            <View style={styles.heroCard}>
              <Image source={ILLUSTRATION_IMAGE} style={styles.heroImage} />
              <View style={styles.heroOverlay} />
              <View style={styles.heroLabelWrap}>
                <Text style={styles.heroLabel}>Campus Transit</Text>
                <Text style={styles.welcomeSubtitle}>
                  Secure, fast, and reliable rides across Minna.
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



                <TouchableOpacity
                  style={[styles.primaryButton, signupLoading && styles.primaryButtonDisabled]}
                  onPress={handleSignup}
                  disabled={signupLoading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Create Account</Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
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
                    <Pressable onPress={() => {
                      setForgotPasswordModalVisible(true)
                      setForgotPasswordStep(1)
                      setForgotPasswordEmail(identifier)
                      setForgotPasswordError('')
                      setForgotPasswordSuccessMessage('')
                    }}>
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

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Secure Login</Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
                </TouchableOpacity>
              </>
            )}
          </View>

        </ScrollView>

        <Modal
          visible={verificationModalVisible}
          animationType="fade"
          transparent
          onRequestClose={handleCloseVerificationModal}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.verificationModalCard}>
              <Text style={styles.verificationModalTitle}>Verify Email</Text>
              <Text style={styles.verificationModalSubtitle}>
                Enter the 6-digit code sent to {pendingSignupData?.email || signupEmail.trim().toLowerCase()}.
              </Text>

              <TextInput
                style={styles.verificationInput}
                placeholder="Enter 6-digit code"
                placeholderTextColor="#b8b8b8"
                value={verificationCode}
                onChangeText={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                editable={!verificationLoading && !verificationResendLoading}
              />

              {verificationError ? (
                <Text style={[styles.errorText, styles.verificationInlineStatus]}>{verificationError}</Text>
              ) : verificationStatusMessage ? (
                <Text style={styles.verificationStatusText}>{verificationStatusMessage}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryButton, verificationLoading && styles.primaryButtonDisabled]}
                onPress={handleVerifyCodeAndCreateAccount}
                disabled={verificationLoading || verificationResendLoading}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Verify</Text>
                <MaterialIcons name="check-circle" size={18} color="#ffffff" />
              </TouchableOpacity>

              <View style={styles.verificationActionsRow}>
                <TouchableOpacity
                  style={styles.verificationSecondaryAction}
                  onPress={handleResendVerificationCode}
                  disabled={verificationLoading || verificationResendLoading}
                  activeOpacity={0.75}
                >
                  <Text style={styles.resendText}>Resend Code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.verificationSecondaryAction}
                  onPress={handleCloseVerificationModal}
                  disabled={verificationLoading || verificationResendLoading}
                  activeOpacity={0.75}
                >
                  <Text style={styles.verificationSecondaryActionText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Forgot Password Modal */}
        <Modal
          visible={forgotPasswordModalVisible}
          animationType="fade"
          transparent
          onRequestClose={handleCloseForgotPasswordModal}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.verificationModalCard}>
              <Text style={styles.verificationModalTitle}>
                {forgotPasswordStep === 1 ? 'Reset Password' : 'Create New Password'}
              </Text>
              <Text style={styles.verificationModalSubtitle}>
                {forgotPasswordStep === 1
                  ? 'Enter your university email to receive a password reset code.'
                  : `Enter the 6-digit code sent to ${forgotPasswordEmail} and your new password.`}
              </Text>

              {forgotPasswordStep === 1 ? (
                <View style={styles.fieldGroup}>
                  <View style={styles.inputWrap}>
                    <MaterialIcons name="mail" size={20} color="#5e5e5e" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { height: 48, backgroundColor: '#f3f3f3', paddingLeft: 44, fontSize: 16, textAlign: 'left', letterSpacing: 0, borderWidth: 0 }]}
                      placeholder="name.m1234567@st.futminna.edu.ng"
                      placeholderTextColor="#b8b8b8"
                      value={forgotPasswordEmail}
                      onChangeText={setForgotPasswordEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      editable={!forgotPasswordLoading}
                    />
                  </View>
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  <TextInput
                    style={styles.verificationInput}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor="#b8b8b8"
                    value={forgotPasswordCode}
                    onChangeText={(value) => setForgotPasswordCode(value.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!forgotPasswordLoading}
                  />

                  <View style={styles.inputWrap}>
                    <MaterialIcons name="lock" size={20} color="#5e5e5e" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { height: 48, backgroundColor: '#f3f3f3', paddingLeft: 44, paddingRight: 44, fontSize: 16, textAlign: 'left', letterSpacing: 0, borderWidth: 0 }]}
                      placeholder="New Password"
                      placeholderTextColor="#b8b8b8"
                      value={forgotPasswordNewPassword}
                      onChangeText={setForgotPasswordNewPassword}
                      secureTextEntry={!showForgotNewPassword}
                      editable={!forgotPasswordLoading}
                    />
                    <Pressable onPress={() => setShowForgotNewPassword((prev) => !prev)} style={styles.eyeButton}>
                      <MaterialIcons name={showForgotNewPassword ? 'visibility-off' : 'visibility'} size={20} color="#5e5e5e" />
                    </Pressable>
                  </View>
                </View>
              )}

              {forgotPasswordError ? (
                <Text style={[styles.errorText, styles.verificationInlineStatus]}>{forgotPasswordError}</Text>
              ) : forgotPasswordSuccessMessage ? (
                <Text style={styles.verificationStatusText}>{forgotPasswordSuccessMessage}</Text>
              ) : null}

              {forgotPasswordStep === 1 ? (
                <TouchableOpacity
                  style={[styles.primaryButton, forgotPasswordLoading && styles.primaryButtonDisabled]}
                  onPress={handleForgotPasswordRequest}
                  disabled={forgotPasswordLoading}
                  activeOpacity={0.85}
                >
                  {forgotPasswordLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Send Code</Text>
                      <MaterialIcons name="send" size={18} color="#ffffff" />
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryButton, forgotPasswordLoading && styles.primaryButtonDisabled]}
                  onPress={handleForgotPasswordConfirm}
                  disabled={forgotPasswordLoading}
                  activeOpacity={0.85}
                >
                  {forgotPasswordLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Reset Password</Text>
                      <MaterialIcons name="lock-reset" size={18} color="#ffffff" />
                    </>
                  )}
                </TouchableOpacity>
              )}

              <View style={styles.verificationActionsRow}>
                {forgotPasswordStep === 2 ? (
                  <TouchableOpacity
                    style={styles.verificationSecondaryAction}
                    onPress={handleForgotPasswordRequest}
                    disabled={forgotPasswordLoading}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.resendText}>Resend Code</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flex: 1 }} />
                )}

                <TouchableOpacity
                  style={styles.verificationSecondaryAction}
                  onPress={handleCloseForgotPasswordModal}
                  disabled={forgotPasswordLoading}
                  activeOpacity={0.75}
                >
                  <Text style={styles.verificationSecondaryActionText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
      <LoadingOverlay visible={loading || signupLoading || verificationLoading || verificationResendLoading || forgotPasswordLoading} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 16,
    paddingBottom: 4,
    flexGrow: 1,
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
    elevation: 2,
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
    elevation: 1,
    marginBottom: 2,
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



  primaryButton: {
    marginTop: 16,
    minWidth: 184,
    maxWidth: 260,
    alignSelf: 'center',
    backgroundColor: '#9937d6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  verificationModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  verificationModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 8,
  },
  verificationModalSubtitle: {
    fontSize: 14,
    color: '#5e5e5e',
    marginBottom: 16,
    lineHeight: 20,
  },
  verificationInput: {
    width: '100%',
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    paddingHorizontal: 14,
    fontSize: 18,
    letterSpacing: 4,
    color: '#1a1c1c',
    height: 52,
    textAlign: 'center',
  },
  verificationInlineStatus: {
    marginTop: 12,
    marginBottom: 0,
  },
  verificationStatusText: {
    marginTop: 12,
    fontSize: 13,
    color: '#3d4a3e',
    lineHeight: 18,
  },
  verificationActionsRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  verificationSecondaryAction: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a', // Using a green color for primary secondary action, adjust as needed
  },
  verificationSecondaryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5e5e5e',
  },
})
