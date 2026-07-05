import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View, SafeAreaView } from 'react-native'
import ScheduledTab from '../components/rides/ScheduledTab'
import FindNearbyTab from '../components/rides/FindNearbyTab'

export default function StudentRidesPage({ isActive }: { isActive?: boolean }) {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'nearby'>('scheduled')

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rides</Text>
      </View>

      <View style={styles.tabContainer}>
        <View style={styles.segmentedRow}>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'scheduled' && styles.segmentActive]}
            onPress={() => setActiveTab('scheduled')}
            activeOpacity={0.8}
          >
            <Text style={activeTab === 'scheduled' ? styles.segmentTextActive : styles.segmentText}>
              Scheduled Rides
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'nearby' && styles.segmentActive]}
            onPress={() => setActiveTab('nearby')}
            activeOpacity={0.8}
          >
            <Text style={activeTab === 'nearby' ? styles.segmentTextActive : styles.segmentText}>
              Find nearby
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={{ display: activeTab === 'scheduled' ? 'flex' : 'none', flex: 1 }}>
          <ScheduledTab isActive={isActive && activeTab === 'scheduled'} />
        </View>
        <View style={{ display: activeTab === 'nearby' ? 'flex' : 'none', flex: 1 }}>
          <FindNearbyTab />
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1c1c',
  },
  tabContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  segmentTextActive: {
    color: '#1a1c1c',
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
})
