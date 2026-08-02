import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import PremiumBottomSheet from '../../premium/PremiumBottomSheet';
import LoadingOverlay from '../../../components/LoadingOverlay';

interface TransferIdModalProps {
  visible: boolean;
  onClose: () => void;
  onContinue: (studentId: string) => void;
  loading: boolean;
  clearError?: () => void;
}

export const TransferIdModal = React.memo(({ visible, onClose, onContinue, loading, clearError }: TransferIdModalProps) => {
  const [studentId, setStudentId] = useState('');

  useEffect(() => {
    if (visible) {
      setStudentId('');
    }
  }, [visible]);

  return (
    <PremiumBottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.modalTitle}>Send to Student</Text>
      <Text style={styles.modalSubtitle}>Enter the recipient student ID to continue.</Text>
      
      <TextInput
        style={styles.modalInput}
        placeholder="Student ID"
        value={studentId}
        onChangeText={setStudentId}
        autoCapitalize="characters"
        editable={!loading}
      />
      
      <View style={styles.modalButtonRow}>
        <TouchableOpacity
          style={styles.modalCancelInline}
          onPress={() => {
            onClose();
            clearError?.();
            setStudentId('');
          }}
        >
          <Text style={styles.modalCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryActionCompact, (!studentId.trim() || loading) && styles.primaryActionDisabled]}
          activeOpacity={0.9}
          onPress={() => onContinue(studentId)}
          disabled={!studentId.trim() || loading}
        >
          <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
          <Text style={styles.primaryActionText}>Continue</Text>
        </TouchableOpacity>
      </View>
      
      <LoadingOverlay visible={loading} />
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
    marginBottom: 24,
    lineHeight: 20,
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
