import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Switch, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useSettingsStore } from '../../core/settingsStore'
import { QUICK_ITEMS } from '../screens/DashboardScreen'

type SettingsPageProps = {
  onClose: () => void
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const insets = useSafeAreaInsets()
  const { enabledCategories, toggleCategory } = useSettingsStore()
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false)

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onClose} activeOpacity={0.85}>
            <MaterialIcons name="arrow-back-ios" size={20} color="#1a1c1c" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>MAP DISPLAY</Text>
          <View style={styles.card}>
            <TouchableOpacity 
              style={styles.cardHeader} 
              activeOpacity={0.7}
              onPress={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
            >
              <View style={styles.cardHeaderContent}>
                <Text style={styles.cardTitle}>Quick Categories</Text>
                <Text style={styles.cardSubtitle}>Choose which locations appear on your map dashboard.</Text>
              </View>
              <MaterialIcons 
                name={isCategoriesExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                size={24} 
                color="#8e8e93" 
              />
            </TouchableOpacity>

            {isCategoriesExpanded && QUICK_ITEMS.map((item, index) => {
              const isEnabled = enabledCategories.includes(item.category)
              const isLast = index === QUICK_ITEMS.length - 1
              
              return (
                <View key={item.id} style={[styles.row, !isLast && styles.rowBorder]}>
                  <View style={styles.rowIcon}>
                    <MaterialIcons name={item.icon} size={20} color="#6A1B9A" />
                  </View>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleCategory(item.category)}
                    trackColor={{ false: '#e2e2e2', true: '#ca9ceb' }}
                    thumbColor={isEnabled ? '#6A1B9A' : '#f4f3f4'}
                    ios_backgroundColor="#e2e2e2"
                  />
                </View>
              )
            })}
          </View>
        </View>

        <Text style={styles.versionText}>LR-Ride v1.0.0 (Beta)</Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    paddingLeft: 12,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
    backgroundColor: '#fafafa',
  },
  cardHeaderContent: {
    flex: 1,
    paddingRight: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1c1c',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#5e5e5e',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e2e2',
  },
  rowIcon: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: '#1a1c1c',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#b0b0b0',
    marginTop: 16,
  },
})
