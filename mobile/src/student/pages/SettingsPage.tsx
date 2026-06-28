import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'

type SettingsPageProps = {
  onClose: () => void
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconButton} onPress={onClose} activeOpacity={0.85}>
            <MaterialIcons name="chevron-left" size={22} color="#6A1B9A" />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.iconButtonPlaceholder} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Settings (Placeholder)</Text>
          <Text style={styles.demoText}>This is a placeholder Settings page. Demo content — replace later.</Text>
        </View>
      </ScrollView>
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eeeeee',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 8,
  },
  demoText: {
    fontSize: 14,
    color: '#3d4a3e',
  },
})
