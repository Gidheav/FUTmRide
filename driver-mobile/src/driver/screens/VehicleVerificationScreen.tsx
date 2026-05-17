import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { MaterialIcons } from '@expo/vector-icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme'
import { verificationApi } from '../../core/api'

type DocType = 'drivers_license' | 'vehicle_registration' | 'vehicle_insurance'

interface DocConfig {
  type: DocType
  label: string
  icon: keyof typeof MaterialIcons.glyphMap
  description: string
}

const DOC_CONFIGS: DocConfig[] = [
  { type: 'drivers_license', label: "Driver's Licence", icon: 'badge', description: 'Upload a clear photo of your valid National Driver\'s Licence.' },
  { type: 'vehicle_registration', label: 'Vehicle Registration', icon: 'directions-car', description: 'Upload your vehicle\'s registration document (Motor Certificate).' },
  { type: 'vehicle_insurance', label: 'Comprehensive Insurance', icon: 'security', description: 'Upload your current vehicle insurance certificate.' },
]

interface DocState {
  file: { uri: string; name: string; type: string } | null
  uploaded: boolean
  uploading: boolean
  error: string | null
}

interface Props { onBack: () => void; onAllUploaded: () => void }

export default function VehicleVerificationScreen({ onBack, onAllUploaded }: Props) {
  const queryClient = useQueryClient()
  const [activeDoc, setActiveDoc] = useState<DocType>('drivers_license')

  const [docStates, setDocStates] = useState<Record<DocType, DocState>>({
    drivers_license: { file: null, uploaded: false, uploading: false, error: null },
    vehicle_registration: { file: null, uploaded: false, uploading: false, error: null },
    vehicle_insurance: { file: null, uploaded: false, uploading: false, error: null },
  })

  const setDocState = (type: DocType, patch: Partial<DocState>) =>
    setDocStates(prev => ({ ...prev, [type]: { ...prev[type], ...patch } }))

  const pickFile = async (type: DocType, fromCamera = false) => {
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') { Alert.alert('Permission Required', 'Camera access needed.'); return }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.85 })
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0]
        const ext = asset.uri.split('.').pop() || 'jpg'
        setDocState(type, { file: { uri: asset.uri, name: `${type}.${ext}`, type: `image/${ext}` }, error: null })
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') { Alert.alert('Permission Required', 'Photo library access needed.'); return }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 })
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0]
        const ext = asset.uri.split('.').pop() || 'jpg'
        setDocState(type, { file: { uri: asset.uri, name: `${type}.${ext}`, type: `image/${ext}` }, error: null })
      }
    }
  }

  const uploadDoc = async (type: DocType) => {
    const st = docStates[type]
    if (!st.file) { Alert.alert('No File', 'Please select a file first.'); return }
    setDocState(type, { uploading: true, error: null })
    try {
      const formData = new FormData()
      formData.append('document_type', type)
      formData.append('file', {
        uri: st.file.uri, name: st.file.name, type: st.file.type,
      } as any)
      await verificationApi.uploadDocument(formData)
      setDocState(type, { uploading: false, uploaded: true })
      queryClient.invalidateQueries({ queryKey: ['verification-progress'] })

      // Auto-advance to next doc
      const nextMap: Record<DocType, DocType | null> = {
        drivers_license: 'vehicle_registration',
        vehicle_registration: 'vehicle_insurance',
        vehicle_insurance: null,
      }
      const next = nextMap[type]
      if (next) setActiveDoc(next)
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ||
        Object.values(err?.response?.data || {}).flat().join('\n') ||
        'Upload failed.'
      setDocState(type, { uploading: false, error: msg })
    }
  }

  const allUploaded = DOC_CONFIGS.every(d => docStates[d.type].uploaded)

  const activeConfig = DOC_CONFIGS.find(d => d.type === activeDoc)!
  const activeSt = docStates[activeDoc]

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={COLORS.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>Vehicle Verification</Text>
          <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Upload required vehicle documents</Text>
        </View>
      </View>

      {/* Document Tab Strip */}
      <View style={s.docTabs}>
        {DOC_CONFIGS.map((cfg) => {
          const st = docStates[cfg.type]
          const isActive = cfg.type === activeDoc
          return (
            <TouchableOpacity
              key={cfg.type}
              style={[s.docTab, isActive && s.docTabActive]}
              onPress={() => setActiveDoc(cfg.type)}
            >
              <View style={[s.docTabIcon, st.uploaded && s.docTabIconDone, isActive && !st.uploaded && s.docTabIconActive]}>
                {st.uploaded
                  ? <MaterialIcons name="check" size={18} color="#fff" />
                  : <MaterialIcons name={cfg.icon} size={18} color={isActive ? COLORS.onPrimary : COLORS.onSurfaceVariant} />
                }
              </View>
              <Text style={[s.docTabLabel, isActive && s.docTabLabelActive]} numberOfLines={2}>
                {cfg.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Active Document Section */}
        <View style={s.card}>
          <Text style={[FONTS.headlineMd, { color: COLORS.onSurface }]}>{activeConfig.label}</Text>
          <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant }]}>{activeConfig.description}</Text>

          {activeSt.uploaded ? (
            <View style={s.successBadge}>
              <MaterialIcons name="check-circle" size={28} color={COLORS.primaryContainer} />
              <View>
                <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Uploaded Successfully</Text>
                <Text style={[FONTS.bodySm, { color: COLORS.onSurfaceVariant }]}>Pending admin review</Text>
              </View>
            </View>
          ) : activeSt.file ? (
            <View>
              <View style={s.filePreview}>
                <MaterialIcons name="image" size={40} color={COLORS.primaryContainer} />
                <View style={{ flex: 1 }}>
                  <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]} numberOfLines={1}>{activeSt.file.name}</Text>
                  <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant }]}>Ready to upload</Text>
                </View>
                <TouchableOpacity onPress={() => setDocState(activeDoc, { file: null })}>
                  <MaterialIcons name="close" size={22} color={COLORS.error} />
                </TouchableOpacity>
              </View>
              {activeSt.error && (
                <Text style={s.errorText}>{activeSt.error}</Text>
              )}
              <TouchableOpacity
                style={[s.uploadBtn, activeSt.uploading && { opacity: 0.6 }]}
                onPress={() => uploadDoc(activeDoc)}
                disabled={activeSt.uploading}
              >
                {activeSt.uploading
                  ? <ActivityIndicator color={COLORS.onPrimary} />
                  : <>
                    <MaterialIcons name="cloud-upload" size={20} color={COLORS.onPrimary} />
                    <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Upload Document</Text>
                  </>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.pickActions}>
              <TouchableOpacity style={[s.pickBtn, AMBIENT_SHADOW]} onPress={() => pickFile(activeDoc, true)}>
                <MaterialIcons name="camera-alt" size={28} color={COLORS.primaryContainer} />
                <Text style={[FONTS.labelLg, { color: COLORS.onSurface, marginTop: 6 }]}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.pickBtn, AMBIENT_SHADOW]} onPress={() => pickFile(activeDoc, false)}>
                <MaterialIcons name="photo-library" size={28} color={COLORS.primaryContainer} />
                <Text style={[FONTS.labelLg, { color: COLORS.onSurface, marginTop: 6 }]}>Choose File</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Progress Summary */}
        <View style={[s.card, { gap: 12 }]}>
          <Text style={[FONTS.labelLg, { color: COLORS.onSurface }]}>Upload Progress</Text>
          {DOC_CONFIGS.map(cfg => (
            <View key={cfg.type} style={s.progressRow}>
              <MaterialIcons
                name={docStates[cfg.type].uploaded ? 'check-circle' : 'radio-button-unchecked'}
                size={20}
                color={docStates[cfg.type].uploaded ? COLORS.primaryContainer : COLORS.onSurfaceVariant}
              />
              <Text style={[FONTS.bodySm, {
                color: docStates[cfg.type].uploaded ? COLORS.onSurface : COLORS.onSurfaceVariant,
                fontWeight: docStates[cfg.type].uploaded ? '600' : '400',
              }]}>
                {cfg.label}
              </Text>
            </View>
          ))}
        </View>

        {allUploaded && (
          <TouchableOpacity style={s.doneBtn} onPress={onAllUploaded}>
            <MaterialIcons name="check-circle" size={22} color={COLORS.onPrimary} />
            <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>All Documents Submitted</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 16,
    backgroundColor: COLORS.surfaceContainerLowest, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerLow,
  },
  backBtn: { padding: 4 },
  docTabs: {
    flexDirection: 'row', backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerLow, paddingHorizontal: 12,
  },
  docTab: {
    flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  docTabActive: { borderBottomColor: COLORS.primaryContainer },
  docTabIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  docTabIconActive: { backgroundColor: COLORS.primaryContainer },
  docTabIconDone: { backgroundColor: COLORS.primaryContainer },
  docTabLabel: { fontSize: 10, fontWeight: '600', color: COLORS.onSurfaceVariant, textAlign: 'center' },
  docTabLabelActive: { color: COLORS.primaryContainer },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 20,
    gap: 16, borderWidth: 1, borderColor: COLORS.surfaceContainerLow, ...AMBIENT_SHADOW,
  },
  successBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.primaryContainer + '15', borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: COLORS.primaryContainer + '40',
  },
  filePreview: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surfaceContainer, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: COLORS.surfaceContainerHigh, marginBottom: 12,
  },
  errorText: { color: COLORS.error, fontSize: 13, marginBottom: 8 },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primaryContainer, borderRadius: 10, paddingVertical: 14,
  },
  pickActions: { flexDirection: 'row', gap: 12 },
  pickBtn: {
    flex: 1, backgroundColor: COLORS.surfaceContainer, borderRadius: 12,
    padding: 20, alignItems: 'center', borderWidth: 1, borderColor: COLORS.surfaceContainerHigh,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.primaryContainer, borderRadius: 12, paddingVertical: 16,
  },
})
