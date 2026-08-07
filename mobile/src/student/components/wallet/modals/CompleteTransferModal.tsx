import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import PremiumBottomSheet from '../../premium/PremiumBottomSheet';
import LoadingOverlay from '../../../components/LoadingOverlay';

interface CompleteTransferModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (amount: string) => void;
  loading: boolean;
  recipient: {
    full_name: string;
    matric_number: string | null;
    campus: { name: string } | null;
  } | null;
  error?: string | null;
  clearError?: () => void;
}

export const CompleteTransferModal = React.memo(({ visible, onClose, onSend, loading, recipient, error, clearError }: CompleteTransferModalProps) => {
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (visible) {
      setAmount('');
    }
  }, [visible]);

  return (
    <PremiumBottomSheet visible={visible} onClose={onClose} snapPoints={["50%", "75%"]}>
      <Text style={styles.modalTitle}>Complete Transfer</Text>
      <Text style={styles.modalSubtitle}>Sending to:</Text>
      
      {recipient && (
        <View style={styles.recipientCardCompact}>
          <Text style={styles.recipientName}>{recipient.full_name}</Text>
          <Text style={styles.recipientMeta}>
            {recipient.matric_number || 'No matric'} {recipient.campus ? `• ${recipient.campus.name}` : ''}
          </Text>
        </View>
      )}
      
      <TextInput
        style={[styles.modalInput, error ? styles.modalInputError : null]}
        placeholder="Amount (NGN)"
        keyboardType="numeric"
        value={amount}
        onChangeText={(txt) => {
          setAmount(txt);
          if (error) clearError?.();
        }}
      />
      
      {error ? (
        <Animated.View 
          entering={FadeInDown.duration(300).springify()} 
          exiting={FadeOutUp.duration(200)}
          style={styles.errorContainer}
        >
          <MaterialIcons name="error-outline" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      ) : null}
      
      <View style={styles.modalButtonRow}>
        <TouchableOpacity style={styles.modalCancelInline} onPress={() => {
          onClose();
          clearError?.();
        }}>
          <Text style={styles.modalCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.primaryActionCompact,
            (loading || Number(amount) < 50) && styles.primaryActionDisabled,
          ]}
          onPress={() => onSend(amount)}
          disabled={loading || Number(amount) < 50}
        >
          <MaterialIcons name="send" size={18} color="#ffffff" />
          <Text style={styles.primaryActionText}>Send</Text>
        </TouchableOpacity>
      </View>
      <LoadingOverlay visible={loading} message="Processing transfer..." />
    </PremiumBottomSheet>
  );
});

const styles = StyleSheet.create({
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: '#1a1c1c',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  recipientCardCompact: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  recipientName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#1a1c1c',
    marginBottom: 4,
  },
  recipientMeta: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#6b7280',
  },
  modalInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: '#1a1c1c',
    marginBottom: 24,
  },
  modalInputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    marginTop: -12,
    gap: 8,
  },
  errorText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#ef4444',
    flex: 1,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  primaryActionCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6A1B9A',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  primaryActionDisabled: {
    backgroundColor: '#e5e7eb',
    opacity: 0.7,
  },
  primaryActionText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#ffffff',
  },
  modalCancelInline: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  modalCancelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#4b5563',
  },
});
