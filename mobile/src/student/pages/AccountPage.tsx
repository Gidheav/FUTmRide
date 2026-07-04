import { useEffect, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import LoadingOverlay from '../components/LoadingOverlay'
import { MaterialIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useAuthStore } from '../../core/authStore'
import { useStudentProfileStore } from '../../core/studentProfileStore'
import api from '../../core/api'

type AccountPageProps = {
  onEditProfile: () => void
  onOpenNotifications: () => void
  onOpenSettings: () => void
  onOpenSecurity: () => void
  onLogout: () => void
  refreshKey: number
}

export default function StudentAccountPage({ onEditProfile, onOpenNotifications, onOpenSettings, onOpenSecurity, onLogout, refreshKey }: AccountPageProps) {
  const { user, setUser } = useAuthStore()
  const userId = user?.id || null
  const cachedProfileEntry = useStudentProfileStore((state) => userId ? state.profilesByUserId[userId] : null)
  const setCachedStudentProfile = useStudentProfileStore((state) => state.setStudentProfile)
  const setCachedUserProfile = useStudentProfileStore((state) => state.setUserProfile)

  const getInitials = () => {
    if (!user?.full_name) return '?'
    const parts = user.full_name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0][0].toUpperCase()
  }

  const profile = cachedProfileEntry?.studentProfile || null
  const userProfile = cachedProfileEntry?.userProfile || null
  const [refreshingProfile, setRefreshingProfile] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const matricRegex = /^\d{4}\/\d\/\d{5}[A-Za-z]{0,3}$/

  useEffect(() => {
    if (!userId) return
    let isMounted = true
    const requestUserId = userId
    const loadProfile = async () => {
      setRefreshingProfile(true)
      try {
        const [profileRes, userRes] = await Promise.all([
          api.get('users/me/student-profile/'),
          api.get('users/me/'),
        ])
        const currentUserId = useAuthStore.getState().user?.id
        if (isMounted && currentUserId === requestUserId) {
          setCachedStudentProfile(requestUserId, profileRes.data)
          setCachedUserProfile(requestUserId, userRes.data)
          setUser(userRes.data)
        }
      } catch (err) {
        // Keep the last good cached profile on transient network/API failures.
      } finally {
        if (isMounted) setRefreshingProfile(false)
      }
    }
    loadProfile()
    return () => {
      isMounted = false
    }
  }, [refreshKey, setCachedStudentProfile, setCachedUserProfile, setUser, userId])

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
        headers: {
          Accept: 'application/json',
          'Content-Type': 'multipart/form-data',
        },
        transformRequest: (data) => data,
      })
      const currentUserId = useAuthStore.getState().user?.id
      if (userId && currentUserId === userId) {
        setCachedUserProfile(userId, response.data)
        setUser(response.data)
      }
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Unable to upload profile photo.'
      setPhotoError(String(message))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const emptyValue = refreshingProfile && !profile ? 'Loading...' : 'Not set'
  const matricValue = profile?.matric_number && matricRegex.test(String(profile.matric_number))
    ? profile.matric_number
    : emptyValue

  const details = [
    { icon: 'phone', label: 'Phone Number', value: userProfile?.phone_number || user?.phone_number || emptyValue },
    { icon: 'badge', label: 'Matric Number', value: matricValue },
    { icon: 'school', label: 'Department', value: profile?.department || emptyValue },
    { icon: 'business', label: 'Campus', value: profile?.campus?.name || emptyValue },
    { icon: 'trending-up', label: 'Level', value: profile?.level ? `${profile.level} Level` : emptyValue },
  ]

  const settings = [
    { icon: 'manage-accounts', label: 'Edit Profile', danger: false, chevron: true },
    { icon: 'settings', label: 'Settings', danger: false, chevron: true },
    { icon: 'tune', label: 'Notification Settings', danger: false, chevron: true },
    { icon: 'security', label: 'Security', danger: false, chevron: true },
    { icon: 'logout', label: 'Log Out', danger: true, chevron: false },
  ]
  const avatarUri = userProfile?.profile_photo || user?.profile_photo || null

  return (
    <View style={styles.page}>
    <ScrollView contentContainerStyle={styles.pageContent}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.initialsContainer}>
              <Text style={styles.initialsText}>{getInitials()}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.editBadge} activeOpacity={0.85} onPress={handlePickPhoto}>
              <MaterialIcons name="edit" size={14} color="#ffffff" />
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
                : item.label === 'Settings'
                  ? onOpenSettings
                : item.label === 'Notification Settings'
                  ? onOpenNotifications
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
    <LoadingOverlay visible={uploadingPhoto} />
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  pageContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 12,
  },
  profileHeader: {
    alignItems: 'center',
    gap: 6,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
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
  initialsContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f3e5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#6A1B9A',
  },
  editBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#4d2c62',
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
    backgroundColor: '#ffffffc7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eeeeee',
    padding: 16,
    shadowColor: '#00000010',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 },
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
