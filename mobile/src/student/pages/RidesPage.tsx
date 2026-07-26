import { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ScheduledTab from '../components/rides/ScheduledTab'
import FindNearbyTab from '../components/rides/FindNearbyTab'
import SharedRideTab from '../components/rides/SharedRideTab'

type Props = {
  isActive?: boolean
  deepLinkShareCode?: string | null
  onDeepLinkConsumed?: () => void
}

export default function StudentRidesPage({ isActive, deepLinkShareCode, onDeepLinkConsumed }: Props) {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'nearby' | 'shared'>('nearby')

  // Auto-switch to Shared tab when a deep-link share code arrives
  useEffect(() => {
    if (deepLinkShareCode) {
      setActiveTab('shared')
    }
  }, [deepLinkShareCode])

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={styles.tabContainer}>
        <View style={styles.segmentedRow}>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'nearby' && styles.segmentActive]}
            onPress={() => setActiveTab('nearby')}
            activeOpacity={0.8}
          >
            <Text style={activeTab === 'nearby' ? styles.segmentTextActive : styles.segmentText}>
              Find nearby
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'scheduled' && styles.segmentActive]}
            onPress={() => setActiveTab('scheduled')}
            activeOpacity={0.8}
          >
            <Text style={activeTab === 'scheduled' ? styles.segmentTextActive : styles.segmentText}>
              Scheduled
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'shared' && styles.segmentActive]}
            onPress={() => setActiveTab('shared')}
            activeOpacity={0.8}
          >
            <Text style={activeTab === 'shared' ? styles.segmentTextActive : styles.segmentText}>
              Shared
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
        <View style={{ display: activeTab === 'shared' ? 'flex' : 'none', flex: 1 }}>
          <SharedRideTab deepLinkShareCode={deepLinkShareCode} onDeepLinkConsumed={onDeepLinkConsumed} />
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
  tabContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
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
