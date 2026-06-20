import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import LoadingOverlay from '../components/LoadingOverlay'
import { MaterialIcons } from '@expo/vector-icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme'
import { verificationApi } from '../../core/api'

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT (Abuja)','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
  'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara',
]

interface Props { onBack: () => void; onSuccess: () => void }

type Step = 'personal' | 'nin' | 'review'

export default function AccountVerificationScreen({ onBack, onSuccess }: Props) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('personal')

  // Form state
  const [fullName, setFullName] = useState('')
  const [age, setAge] = useState('')
  const [stateOfOrigin, setStateOfOrigin] = useState('')
  const [address, setAddress] = useState('')
  const [ninNumber, setNinNumber] = useState('')
  const [ninScan, setNinScan] = useState<{ uri: string; name: string; type: string } | null>(null)
  const [showStateDropdown, setShowStateDropdown] = useState(false)

  const submitMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append('full_name', fullName.trim())
      formData.append('age', age)
      formData.append('state_of_origin', stateOfOrigin.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '').replace('fct_', 'fct'))
      formData.append('address', address.trim())
      formData.append('nin_number', ninNumber.trim())
      if (ninScan) {
        formData.append('nin_scan', {
          uri: ninScan.uri,
          name: ninScan.name,
          type: ninScan.type,
        } as any)
      }
      return verificationApi.submitAccount(formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-progress'] })
      queryClient.invalidateQueries({ queryKey: ['account-verification-status'] })
      onSuccess()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ||
        Object.values(err?.response?.data || {}).flat().join('\n') ||
        'Submission failed. Please try again.'
      Alert.alert('Submission Failed', msg)
    },
  })

  const pickNinScan = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.85,
        allowsEditing: false,
      })
      console.log('[NIN Picker] result:', JSON.stringify(result))
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]
        const uri = asset.uri
        const ext = uri.split('.').pop()?.split('?')[0] || 'jpg'
        setNinScan({ uri, name: `nin_scan.${ext}`, type: `image/${ext === 'png' ? 'png' : 'jpeg'}` })
      }
    } catch (err: any) {
      console.warn('[NIN Picker] error:', err)
      Alert.alert('Image Picker Error', err?.message || 'Failed to pick image.')
    }
  }

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access.')
        return
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.85 })
      console.log('[NIN Camera] result:', JSON.stringify(result))
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]
        const uri = asset.uri
        const ext = uri.split('.').pop()?.split('?')[0] || 'jpg'
        setNinScan({ uri, name: `nin_scan.${ext}`, type: `image/${ext === 'png' ? 'png' : 'jpeg'}` })
      }
    } catch (err: any) {
      console.warn('[NIN Camera] error:', err)
      Alert.alert('Camera Error', err?.message || 'Failed to take photo.')
    }
  }

  const validatePersonal = () => {
    if (!fullName.trim()) { Alert.alert('Required', 'Full name is required.'); return false }
    const ageNum = parseInt(age)
    if (!age || isNaN(ageNum) || ageNum < 18 || ageNum > 80) { Alert.alert('Invalid Age', 'Age must be between 18 and 80.'); return false }
    if (!stateOfOrigin) { Alert.alert('Required', 'State of origin is required.'); return false }
    if (!address.trim()) { Alert.alert('Required', 'Address is required.'); return false }
    return true
  }

  const validateNin = () => {
    if (!ninNumber.trim() || ninNumber.length !== 11 || !/^\d+$/.test(ninNumber)) {
      Alert.alert('Invalid NIN', 'NIN must be exactly 11 digits.')
      return false
    }
    if (!ninScan) { Alert.alert('Required', 'Please upload or take a photo of your NIN.'); return false }
    return true
  }

  const stepTitles: Record<Step, string> = {
    personal: 'Personal Details',
    nin: 'NIN Verification',
    review: 'Review & Submit',
  }

  const steps: Step[] = ['personal', 'nin', 'review']
  const stepIdx = steps.indexOf(step)

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={COLORS.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>Account Verification</Text>
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>{stepTitles[step]}</Text>
        </View>
      </View>

      {/* Step Indicator */}
      <View style={s.stepRow}>
        {steps.map((st, i) => (
          <View key={st} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[s.stepDot, i <= stepIdx && s.stepDotActive]}>
              {i < stepIdx ? (
                <MaterialIcons name="check" size={14} color="#fff" />
              ) : (
                <Text style={{ color: i <= stepIdx ? '#fff' : COLORS.onSurfaceVariant, fontSize: 12, fontWeight: '700' }}>{i + 1}</Text>
              )}
            </View>
            {i < steps.length - 1 && (
              <View style={[s.stepLine, i < stepIdx && s.stepLineActive]} />
            )}
          </View>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Step 1: Personal Details ── */}
        {step === 'personal' && (
          <View style={s.card}>
            <Field label="Full Name (as on NIN)" value={fullName} onChange={setFullName} placeholder="e.g. Oluwaseun Adebayo" />
            <Field label="Age" value={age} onChange={setAge} placeholder="e.g. 27" keyboardType="number-pad" maxLength={2} />

            {/* State of Origin */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>State of Origin</Text>
              <TouchableOpacity style={s.dropdown} onPress={() => setShowStateDropdown(!showStateDropdown)}>
                <Text style={[s.dropdownText, !stateOfOrigin && { color: COLORS.onSurfaceVariant }]}>
                  {stateOfOrigin || 'Select state…'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
              {showStateDropdown && (
                <View style={s.dropdownList}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {NIGERIAN_STATES.map(st => (
                      <TouchableOpacity key={st} style={s.dropdownItem} onPress={() => { setStateOfOrigin(st); setShowStateDropdown(false) }}>
                        <Text style={[FONTS.bodySm, { color: COLORS.onSurface }]}>{st}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <Field label="Home Address" value={address} onChange={setAddress} placeholder="e.g. 12 Unity Road, Minna, Niger State" multiline />
          </View>
        )}

        {/* ── Step 2: NIN ── */}
        {step === 'nin' && (
          <View style={s.card}>
            <Field
              label="NIN Number"
              value={ninNumber}
              onChange={setNinNumber}
              placeholder="Enter 11-digit NIN"
              keyboardType="number-pad"
              maxLength={11}
            />
            <View style={s.fieldWrap}>
              <Text style={s.label}>NIN Document Scan</Text>
              <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant, marginBottom: 8 }]}>
                Upload a clear photo of your NIN slip or National ID card.
              </Text>
              {ninScan ? (
                <View style={s.scanPreviewWrap}>
                  <MaterialIcons name="image" size={48} color={COLORS.primaryContainer} />
                  <Text style={[FONTS.labelLg, { color: COLORS.onSurface, marginTop: 8 }]}>{ninScan.name}</Text>
                  <TouchableOpacity onPress={() => setNinScan(null)} style={s.clearScan}>
                    <MaterialIcons name="close" size={18} color={COLORS.error} />
                    <Text style={[FONTS.labelMd, { color: COLORS.error }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.scanActions}>
                  <TouchableOpacity style={[s.scanBtn, AMBIENT_SHADOW]} onPress={takePhoto}>
                    <MaterialIcons name="camera-alt" size={28} color={COLORS.primaryContainer} />
                    <Text style={[FONTS.labelLg, { color: COLORS.onSurface, marginTop: 6 }]}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.scanBtn, AMBIENT_SHADOW]} onPress={pickNinScan}>
                    <MaterialIcons name="photo-library" size={28} color={COLORS.primaryContainer} />
                    <Text style={[FONTS.labelLg, { color: COLORS.onSurface, marginTop: 6 }]}>Choose File</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Step 3: Review ── */}
        {step === 'review' && (
          <View>
            <View style={s.card}>
              <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, marginBottom: 16 }]}>Review Your Details</Text>
              {[
                { label: 'Full Name', value: fullName },
                { label: 'Age', value: age },
                { label: 'State of Origin', value: stateOfOrigin },
                { label: 'Address', value: address },
                { label: 'NIN Number', value: `${ninNumber.slice(0, 3)}****${ninNumber.slice(-4)}` },
                { label: 'NIN Document', value: ninScan ? '✓ Uploaded' : 'Not uploaded' },
              ].map(({ label, value }) => (
                <View key={label} style={s.reviewRow}>
                  <Text style={s.reviewLabel}>{label}</Text>
                  <Text style={s.reviewValue}>{value}</Text>
                </View>
              ))}
            </View>

            <View style={[s.card, { backgroundColor: COLORS.primaryContainer + '15', borderColor: COLORS.primaryContainer + '40' }]}>
              <MaterialIcons name="security" size={24} color={COLORS.primaryContainer} style={{ marginBottom: 8 }} />
              <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Data Privacy</Text>
              <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant, marginTop: 4 }]}>
                Your personal information will only be used for identity verification by LR Ride campus administrators. We do not share your data with third parties.
              </Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Navigation Buttons */}
      <View style={s.navRow}>
        {step !== 'personal' ? (
          <TouchableOpacity style={s.backNavBtn} onPress={() => {
            if (step === 'nin') setStep('personal')
            else if (step === 'review') setStep('nin')
          }}>
            <MaterialIcons name="arrow-back" size={18} color={COLORS.onSurface} />
            <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}

        {step !== 'review' ? (
          <TouchableOpacity
            style={s.nextBtn}
            onPress={() => {
              if (step === 'personal' && validatePersonal()) setStep('nin')
              else if (step === 'nin' && validateNin()) setStep('review')
            }}
          >
            <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Next</Text>
            <MaterialIcons name="arrow-forward" size={18} color={COLORS.onPrimary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.nextBtn, submitMutation.isPending && { opacity: 0.6 }]}
            onPress={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
          >
            <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Submit</Text>
            <MaterialIcons name="check" size={18} color={COLORS.onPrimary} />
          </TouchableOpacity>
        )}
      </View>
      <LoadingOverlay visible={submitMutation.isPending} />
    </View>
  )
}

// ─── Field Component ─────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, keyboardType, maxLength, multiline }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; keyboardType?: any; maxLength?: number; multiline?: boolean
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.onSurfaceVariant}
        keyboardType={keyboardType || 'default'}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 16,
    backgroundColor: COLORS.surfaceContainerLowest, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerLow,
  },
  backBtn: { padding: 4 },
  stepRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.surfaceContainerLowest,
  },
  stepDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: COLORS.primaryContainer },
  stepLine: { flex: 1, height: 2, backgroundColor: COLORS.surfaceContainerHigh, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: COLORS.primaryContainer },
  scroll: { padding: 20, gap: 16, paddingBottom: 32 },
  card: {
    backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16,
    padding: 20, gap: 16, borderWidth: 1, borderColor: COLORS.surfaceContainerLow,
    ...AMBIENT_SHADOW,
  },
  fieldWrap: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.onSurfaceVariant, letterSpacing: 0.4 },
  input: {
    backgroundColor: COLORS.surfaceContainer, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.onSurface, borderWidth: 1, borderColor: COLORS.surfaceContainerHigh,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  dropdown: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceContainer, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.surfaceContainerHigh,
  },
  dropdownText: { fontSize: 15, color: COLORS.onSurface },
  dropdownList: {
    backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.surfaceContainerHigh,
    ...AMBIENT_SHADOW,
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerLow },
  scanPreviewWrap: {
    backgroundColor: COLORS.surfaceContainer, borderRadius: 12,
    padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primaryContainer + '40',
  },
  clearScan: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  scanActions: { flexDirection: 'row', gap: 12 },
  scanBtn: {
    flex: 1, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 12,
    padding: 20, alignItems: 'center', borderWidth: 1, borderColor: COLORS.surfaceContainerLow,
  },
  reviewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerLow,
  },
  reviewLabel: { fontSize: 12, fontWeight: '600', color: COLORS.onSurfaceVariant, flex: 1 },
  reviewValue: { fontSize: 14, color: COLORS.onSurface, fontWeight: '600', flex: 2, textAlign: 'right' },
  navRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderTopWidth: 1, borderTopColor: COLORS.surfaceContainerLow,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  backNavBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 10, backgroundColor: COLORS.surfaceContainerLow,
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: 10, backgroundColor: COLORS.primaryContainer,
  },
})
