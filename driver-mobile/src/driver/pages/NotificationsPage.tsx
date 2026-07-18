import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Alert, Modal, ScrollView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme';
import { notificationsApi } from '../../core/api';
import CustomRefreshFlatList from '../components/CustomRefreshFlatList';
import LoadingOverlay from '../components/LoadingOverlay';

interface Props {
  onBack: () => void;
}

export default function NotificationsPage({ onBack }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;
  const insets = useSafeAreaInsets();
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);

  const fetchNotifications = async () => {
    try {
      setError('');
      const response = await notificationsApi.getNotifications();
      // Assuming paginated response with `results`, or a direct array
      const data = response.data?.results || response.data || [];
      setNotifications(data);
    } catch (err: any) {
      console.warn('Failed to fetch notifications:', err);
      setError('Failed to load notifications. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.warn('Failed to mark all as read:', err);
      Alert.alert('Error', 'Could not mark all notifications as read.');
    }
  };

  const handleNotificationPress = (item: any) => {
    if (!item.is_read) {
      handleMarkAsRead(item.id);
    }
    setSelectedNotification(item);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const renderItem = ({ item }: { item: any }) => {
    const isUnread = !item.is_read;
    return (
      <TouchableOpacity 
        style={[styles.notificationRow, isUnread && styles.notificationRowUnread]} 
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.iconSlimContainer}>
          <MaterialIcons 
            name={item.type === 'ride_update' ? 'directions-car' : item.type === 'wallet' ? 'account-balance-wallet' : 'notifications'} 
            size={20} 
            color={COLORS.primary} 
          />
        </View>
        <View style={styles.rowContent}>
          <View style={styles.rowHeader}>
            <Text style={[FONTS.labelLg, { color: isUnread ? COLORS.onSurface : COLORS.onSurfaceVariant, flex: 1 }]} numberOfLines={1}>
              {item.title || 'Notification'}
            </Text>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant, opacity: 0.7, marginLeft: 8 }]}>
              {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
            </Text>
          </View>
          <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant }]} numberOfLines={1}>
            {item.message || item.body || ''}
          </Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, flex: 1 }]}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllButton} onPress={handleMarkAllAsRead}>
            <MaterialIcons name="done-all" size={20} color={COLORS.primary} />
            <Text style={[FONTS.labelMd, { color: COLORS.primary, marginLeft: 4 }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <LoadingOverlay visible={true} inline size={60} />
          <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, marginTop: 16 }]}>Loading notifications...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color={COLORS.error} />
          <Text style={[FONTS.bodyLg, { color: COLORS.onSurface, marginTop: 12, textAlign: 'center' }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchNotifications}>
            <Text style={[FONTS.labelLg, { color: COLORS.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="notifications-none" size={64} color={COLORS.surfaceVariant} />
          <Text style={[FONTS.titleLg, { color: COLORS.onSurfaceVariant, marginTop: 16 }]}>No notifications yet</Text>
          <Text style={[FONTS.bodyMd, { color: COLORS.onSurfaceVariant, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }]}>
            You're all caught up. We'll notify you when there's an update.
          </Text>
        </View>
      ) : (
        <CustomRefreshFlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={[styles.listContent, isWide && styles.listContentWide]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Notification Detail Modal */}
      <Modal
        visible={!!selectedNotification}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedNotification(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedNotification(null)}>
              <MaterialIcons name="close" size={24} color={COLORS.onSurface} />
            </TouchableOpacity>
            <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, flex: 1 }]} numberOfLines={1}>
              Details
            </Text>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <MaterialIcons 
                name={selectedNotification?.type === 'ride_update' ? 'directions-car' : selectedNotification?.type === 'wallet' ? 'account-balance-wallet' : 'notifications'} 
                size={40} 
                color={COLORS.primary} 
              />
            </View>
            <Text style={[FONTS.headlineMd, { color: COLORS.onSurface, textAlign: 'center', marginBottom: 8 }]}>
              {selectedNotification?.title || 'Notification'}
            </Text>
            <Text style={[FONTS.labelMd, { color: COLORS.onSurfaceVariant, textAlign: 'center', marginBottom: 24 }]}>
              {selectedNotification?.created_at ? new Date(selectedNotification.created_at).toLocaleString() : ''}
            </Text>
            <View style={styles.modalBodyWrap}>
              <Text style={[FONTS.bodyLg, { color: COLORS.onSurfaceVariant, lineHeight: 24 }]}>
                {selectedNotification?.message || selectedNotification?.body || ''}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    marginLeft: -8,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceVariant,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 40,
  },
  listContentWide: {
    paddingHorizontal: '20%',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.surfaceVariant,
    marginLeft: 64, // Align with text content
  },
  notificationRow: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  notificationRowUnread: {
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  iconSlimContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  closeButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 16,
  },
  modalContent: {
    padding: 24,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalBodyWrap: {
    backgroundColor: COLORS.surfaceContainerLowest,
    padding: 24,
    borderRadius: 16,
    width: '100%',
    ...AMBIENT_SHADOW,
  },
});
