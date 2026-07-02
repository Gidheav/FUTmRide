import { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import api from '../../core/api'
import LoadingOverlay from '../components/LoadingOverlay'

const LEVEL_OPTIONS = [100, 200, 300, 400, 500]

const DEPARTMENT_OPTIONS = [
  'Agricultural & Bioresources Engineering',
  'Agricultural Economics & Farm Management',
  'Agricultural Extension & Rural Development',
  'Animal Biology',
  'Animal Production',
  'Architecture',
  'Biochemistry',
  'Building Technology',
  'Chemical Engineering',
  'Chemistry',
  'Civil Engineering',
  'Computer Engineering',
  'Computer Science',
  'Crop Production',
  'Cyber Security Science',
  'Educational Technology',
  'Electrical & Electronics Engineering',
  'Entrepreneurship & Business Studies',
  'Estate Management',
  'Food Science & Technology',
  'Geography',
  'Geology',
  'Horticulture',
  'Industrial & Technology Education',
  'Information & Media Technology',
  'Library & Information Technology',
  'Materials & Metallurgical Engineering',
  'Mathematics',
  'Mechanical Engineering',
  'Mechatronics Engineering',
  'Microbiology',
  'Petroleum & Gas Engineering',
  'Physics',
  'Plant Biology',
  'Project Management Technology',
  'Quantity Surveying',
  'Science Education',
  'Soil Science & Land Management',
  'Statistics',
  'Surveying & Geoinformatics',
  'Telecommunication Engineering',
  'Transport Management Technology',
  'Urban & Regional Planning',
  'Water Resources, Aquaculture & Fisheries Technology',
]

const STATIC_CAMPUSES = [
  { id: 'gidan-kwano', name: 'Gidan Kwano (FUTMINNA)' },
  { id: 'bosso', name: 'Bosso (FUTMINNA)' },
]

const matricRegex = /^\d{4}\/\d\/\d{5}[A-Za-z]{0,3}$/
const phoneRegex = /^(0\d{10}|\+234\d{10})$/
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CampusOption = {
  id: string
  name: string
  code?: string
  key?: string
}

type CampusApiItem = {
  id: string | number
  name: string
  code?: string | null
}

type EditProfileProps = {
  onClose: () => void
  onSaved: () => void
}

export default function StudentEditProfilePage({ onClose, onSaved }: EditProfileProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [matricNumber, setMatricNumber] = useState('')
  const [department, setDepartment] = useState('')
  const [level, setLevel] = useState<number | null>(null)
  const [campusId, setCampusId] = useState<string | null>(null)
  const [campusName, setCampusName] = useState('')

  const [campusOptions, setCampusOptions] = useState<CampusOption[]>([])
  const [campusSource, setCampusSource] = useState<'api' | 'fallback'>('api')

  const [levelModalVisible, setLevelModalVisible] = useState(false)
  const [campusModalVisible, setCampusModalVisible] = useState(false)
  const [departmentModalVisible, setDepartmentModalVisible] = useState(false)

  useEffect(() => {
    let isMounted = true
    const loadProfile = async () => {
      setLoading(true)
      setError('')
      try {
        const [profileRes, campusRes, userRes] = await Promise.all([
          api.get('users/me/student-profile/'),
          api.get('users/campuses/'),
          api.get('users/me/'),
        ])

        if (isMounted) {
          const profile = profileRes.data || {}
          const userProfile = userRes.data || {}
          setFirstName(userProfile.first_name || '')
          setLastName(userProfile.last_name || '')
          setPhoneNumber(userProfile.phone_number ? String(userProfile.phone_number) : '')
          const savedMatric = profile.matric_number
          setMatricNumber(savedMatric && matricRegex.test(String(savedMatric)) ? String(savedMatric) : '')
          setDepartment(profile.department || '')
          setLevel(profile.level || null)
          setCampusId(profile.campus?.id || null)
          setCampusName(profile.campus?.name || '')

          const payload = campusRes.data
          const list: CampusApiItem[] = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.results)
              ? payload.results
              : []
          const normalized: CampusOption[] = list.map((item) => {
            const rawName = String(item.name)
            const nameLower = rawName.toLowerCase()
            const key = nameLower.includes('gidan') && nameLower.includes('kwano')
              ? 'gk'
              : nameLower.includes('bosso')
                ? 'bosso'
                : rawName.toLowerCase()
            const displayName = key === 'gk'
              ? 'Gidan Kwano (FUTMINNA)'
              : key === 'bosso'
                ? 'Bosso (FUTMINNA)'
                : rawName
            return {
              id: String(item.id),
              name: displayName,
              code: item.code ? String(item.code) : undefined,
              key,
            }
          })
          const deduped = normalized.reduce((acc: CampusOption[], item: CampusOption) => {
            const existing = acc.find((entry: CampusOption) => entry.key === item.key)
            if (!existing) {
              acc.push(item)
              return acc
            }
            if (existing && existing.code && !item.code) return acc
            if (existing && !existing.code && item.code) {
              const index = acc.indexOf(existing)
              acc[index] = item
              return acc
            }
            return acc
          }, [])
          if (deduped.length > 0) {
            setCampusOptions(deduped)
            setCampusSource('api')
          } else {
            setCampusOptions(STATIC_CAMPUSES)
            setCampusSource('fallback')
          }
        }
      } catch (err) {
        if (isMounted) {
          setCampusOptions(STATIC_CAMPUSES)
          setCampusSource('fallback')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadProfile()
    return () => {
      isMounted = false
    }
  }, [])

  const selectedCampusLabel = useMemo(() => {
    if (campusName) return campusName
    const option = campusOptions.find((item) => item.id === campusId)
    return option?.name || 'Select campus'
  }, [campusId, campusName, campusOptions])

  const selectedLevelLabel = level ? `${level} Level` : 'Select level'
  const selectedDepartmentLabel = department || 'Select department'

  const validate = () => {
    if (!firstName.trim()) {
      setError('First name is required.')
      return false
    }
    if (!lastName.trim()) {
      setError('Surname is required.')
      return false
    }
    if (phoneNumber && !phoneRegex.test(phoneNumber.trim())) {
      setError('Enter a valid phone number (e.g. +2348012345678).')
      return false
    }
    if (matricNumber && !matricRegex.test(matricNumber.trim())) {
      setError('Matric number must match YYYY/D/#####AAA (e.g. 1983/11/00000ABC).')
      return false
    }
    if (!level) {
      setError('Please select your level.')
      return false
    }
    if (!campusId) {
      setError('Please select your campus.')
      return false
    }
    setError('')
    return true
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    setError('')
    try {
      await api.patch('users/me/', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phoneNumber ? phoneNumber.trim() : null,
      })

      const payload: Record<string, any> = {
        matric_number: matricNumber ? matricNumber.trim() : null,
        department: department ? department.trim() : '',
        level,
      }

      if (campusId && uuidRegex.test(campusId)) {
        payload.campus_id = campusId
      }

      await api.patch('users/me/student-profile/', payload)
      onSaved()
    } catch (err: any) {
      const message = err?.response?.data?.error?.message ||
        err?.response?.data?.non_field_errors?.[0] ||
        err?.response?.data?.phone_number?.[0] ||
        err?.response?.data?.matric_number?.[0] ||
        err?.response?.data?.campus_id?.[0] ||
        'Unable to update profile.'
      setError(String(message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.page}>
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.iconButton} onPress={onClose} activeOpacity={0.85}>
          <MaterialIcons name="chevron-left" size={22} color="#6A1B9A" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <LoadingOverlay visible={true} inline size={32} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : (
        <>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Student Details</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>First Name</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="person" size={18} color="#6A1B9A" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter first name"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Surname</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="person-outline" size={18} color="#6A1B9A" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter surname"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="phone" size={18} color="#6A1B9A" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter phone number"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Matric Number</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="badge" size={18} color="#6A1B9A" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter matric number"
                  value={matricNumber}
                  onChangeText={setMatricNumber}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Department</Text>
              <TouchableOpacity
                style={styles.selector}
                activeOpacity={0.85}
                onPress={() => setDepartmentModalVisible(true)}
              >
                <View style={styles.selectorLeft}>
                  <MaterialIcons name="school" size={18} color="#6A1B9A" />
                  <Text style={styles.selectorText}>{selectedDepartmentLabel}</Text>
                </View>
                <MaterialIcons name="expand-more" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Level</Text>
              <TouchableOpacity
                style={styles.selector}
                activeOpacity={0.85}
                onPress={() => setLevelModalVisible(true)}
              >
                <View style={styles.selectorLeft}>
                  <MaterialIcons name="trending-up" size={18} color="#6A1B9A" />
                  <Text style={styles.selectorText}>{selectedLevelLabel}</Text>
                </View>
                <MaterialIcons name="expand-more" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Campus</Text>
              <TouchableOpacity
                style={styles.selector}
                activeOpacity={0.85}
                onPress={() => setCampusModalVisible(true)}
              >
                <View style={styles.selectorLeft}>
                  <MaterialIcons name="business" size={18} color="#6A1B9A" />
                  <Text style={styles.selectorText}>{selectedCampusLabel}</Text>
                </View>
                <MaterialIcons name="expand-more" size={20} color="#6b7280" />
              </TouchableOpacity>
              {campusSource === 'fallback' ? (
                <Text style={styles.helperText}>Campus list is offline. Try again later.</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
              onPress={handleSave}
              activeOpacity={0.9}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal visible={levelModalVisible} animationType="fade" transparent onRequestClose={() => setLevelModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Level</Text>
            {LEVEL_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.modalRow}
                onPress={() => {
                  setLevel(option)
                  setLevelModalVisible(false)
                }}
              >
                <Text style={styles.modalRowText}>{option} Level</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setLevelModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={campusModalVisible} animationType="fade" transparent onRequestClose={() => setCampusModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Campus</Text>
            {campusOptions.length === 0 ? (
              <Text style={styles.modalEmpty}>No campuses available.</Text>
            ) : (
              campusOptions.map((campus) => {
                const isSelected = campus.id === campusId
                return (
                  <TouchableOpacity
                    key={campus.id}
                    style={styles.modalRow}
                    onPress={() => {
                      setCampusId(campus.id)
                      setCampusName(campus.name)
                      setCampusModalVisible(false)
                    }}
                  >
                    <View style={styles.radioOuter}>
                      {isSelected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={styles.modalRowText}>{campus.name}</Text>
                  </TouchableOpacity>
                )
              })
            )}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setCampusModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={departmentModalVisible} animationType="fade" transparent onRequestClose={() => setDepartmentModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Department</Text>
            <ScrollView style={styles.modalScroll}>
              {DEPARTMENT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.modalRow}
                  onPress={() => {
                    setDepartment(option)
                    setDepartmentModalVisible(false)
                  }}
                >
                  <View style={styles.radioOuter}>
                    {department === option ? <View style={styles.radioInner} /> : null}
                  </View>
                  <Text style={styles.modalRowText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setDepartmentModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
    <LoadingOverlay visible={saving} />
    </View>
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
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3e5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  loadingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#eeeeee',
  },
  loadingText: {
    color: '#6b7280',
  },
  errorText: {
    color: '#ba1a1a',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eeeeee',
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#6d7b6d',
    fontWeight: '600',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1a1c1c',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#ffffff',
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectorText: {
    color: '#1a1c1c',
    fontSize: 14,
  },
  helperText: {
    marginTop: 6,
    color: '#9ca3af',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1a1c1c',
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#6A1B9A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  modalScroll: {
    maxHeight: 320,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#6A1B9A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6A1B9A',
  },
  modalRowText: {
    fontSize: 14,
    color: '#1a1c1c',
  },
  modalEmpty: {
    fontSize: 13,
    color: '#6b7280',
  },
  modalCancel: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelText: {
    color: '#6A1B9A',
    fontWeight: '600',
  },
})
