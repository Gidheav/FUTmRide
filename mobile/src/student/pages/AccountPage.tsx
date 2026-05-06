import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useAuthStore } from '../../core/authStore'
import api from '../../core/api'

const PROFILE_IMAGE_URI =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBrKWSN2TzBECNjdNXg6cw1aNilC_cpK7SOO0SaUYrlM29ESyY5TpRzqC0foFH6ftkS_6PquBE-k7iysH9hhlDOKFVgw51uhms_KktqBZJEY1QTev4oBn3k4NQQJ_6SNrHFfzBLkAEIjf13ObFRRLWEQ_7pt3joCG9z-J_MITcT1UB24RTc6SQZG8-B2JbpJc5IFSWl01nVIZXP1mHG0YjESCk9j3A09H1_XpYYl4vOMEohek-ZTSa1604_omN0qmA2YcK_tG0IeVE'

type AccountPageProps = {
  onEditProfile: () => void
  onOpenSecurity: () => void
  onLogout: () => void
  refreshKey: number
}

export default function StudentAccountPage({ onEditProfile, onOpenSecurity, onLogout, refreshKey }: AccountPageProps) {
  const { user, setUser } = useAuthStore()
  const [profile, setProfile] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const matricRegex = /^\d{4}\/\d\/\d{5}[A-Za-z]{0,3}$/

  useEffect(() => {
    let isMounted = true
    const loadProfile = async () => {
      try {
        const [profileRes, userRes] = await Promise.all([
          api.get('users/me/student-profile/'),
          api.get('users/me/'),
        ])
        if (isMounted) {
          setProfile(profileRes.data)
          setUserProfile(userRes.data)
          setUser(userRes.data)
        }
      } catch (err) {
        if (isMounted) {
          setProfile(null)
          setUserProfile(null)
        }
      }
    }
    loadProfile()
    return () => {
      isMounted = false
    }
  }, [refreshKey])

  const handlePickPhoto = async () => {
    setPhotoError('')
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setPhotoError('Photo access is required to upload a profile picture.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (result.canceled || !result.assets?.length) return

    const asset = result.assets[0]
    if (!asset.uri) return

    const fileName = asset.fileName || asset.uri.split('/').pop() || 'profile.jpg'
    const extension = fileName.split('.').pop()?.toLowerCase()
    const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg'

    const formData = new FormData()
    formData.append('profile_photo', {
      uri: asset.uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob)

    try {
      setUploadingPhoto(true)
      const response = await api.patch('users/me/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUserProfile(response.data)
      setUser(response.data)
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Unable to upload profile photo.'
      setPhotoError(String(message))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const matricValue = profile?.matric_number && matricRegex.test(profile.matric_number)
    ? profile.matric_number
    : 'Not set'

  const details = [
    { icon: 'badge', label: 'Matric Number', value: matricValue },
    { icon: 'school', label: 'Department', value: profile?.department || 'Not set' },
    { icon: 'business', label: 'Campus', value: profile?.campus?.name || 'Not set' },
    { icon: 'trending-up', label: 'Level', value: profile?.level ? `${profile.level} Level` : 'Not set' },
  ]

  const settings = [
    { icon: 'manage-accounts', label: 'Edit Profile', danger: false, chevron: true },
    { icon: 'security', label: 'Security', danger: false, chevron: true },
    { icon: 'logout', label: 'Log Out', danger: true, chevron: false },
  ]

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrap}>
          <Image source={{ uri: userProfile?.profile_photo || user?.profile_photo || PROFILE_IMAGE_URI }} style={styles.avatar} />
          <TouchableOpacity style={styles.editBadge} activeOpacity={0.85} onPress={handlePickPhoto}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <MaterialIcons name="edit" size={14} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.profileName}>{user?.full_name || 'Adebayo Samuel'}</Text>
        <Text style={styles.profileEmail}>{user?.email || 'samuel.adebayo@st.futminna.edu.ng'}</Text>
      </View>

      {photoError ? <Text style={styles.errorText}>{photoError}</Text> : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Academic Details</Text>
        </View>
        <View style={styles.cardList}>
          {details.map((item) => (
            <View style={styles.detailRow} key={item.label}>
              <View style={styles.detailIconWrap}>
                <MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={18} color="#6A1B9A" />
              </View>
              <View>
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={styles.detailValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        {settings.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.settingRow, index === settings.length - 1 && styles.settingRowLast]}
            activeOpacity={0.85}
            onPress={
              item.label === 'Edit Profile'
                ? onEditProfile
                : item.label === 'Security'
                  ? onOpenSecurity
                  : item.label === 'Log Out'
                    ? onLogout
                    : undefined
            }
          >
            <View style={styles.settingLeft}>
              <MaterialIcons
                name={item.icon as keyof typeof MaterialIcons.glyphMap}
                size={20}
                color={item.danger ? '#ba1a1a' : '#3d4a3e'}
              />
              <Text style={item.danger ? styles.settingTextDanger : styles.settingText}>{item.label}</Text>
            </View>
            {item.chevron ? (
              <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 24,
  },
  profileHeader: {
    alignItems: 'center',
    gap: 6,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: '#ffffff',
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  editBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#6A1B9A',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  profileEmail: {
    fontSize: 14,
    color: '#3d4a3e',
  },
  errorText: {
    color: '#ba1a1a',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eeeeee',
    padding: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f3',
    paddingBottom: 10,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  cardList: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f3e5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#6d7b6d',
  },
  detailValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f3',
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  settingTextDanger: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ba1a1a',
  },
})
