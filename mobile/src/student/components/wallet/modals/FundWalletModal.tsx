import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import PremiumBottomSheet from '../../premium/PremiumBottomSheet';

interface FundWalletModalProps {
  visible: boolean;
  onClose: () => void;
  onTopUp: (amount: string) => void;
  loading: boolean;
  error?: string | null;
  clearError?: () => void;
}

export const FundWalletModal = React.memo(({ visible, onClose, onTopUp, loading, error, clearError }: FundWalletModalProps) => {
  const [amount, setAmount] = useState('');

  // Reset state when opened
  useEffect(() => {
    if (visible) {
      setAmount('');
    }
  }, [visible]);

  return (
    <PremiumBottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.modalTitle}>Fund Wallet</Text>
      <Text style={styles.modalSubtitle}>Enter the amount you want to add to your wallet.</Text>
      
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
        <TouchableOpacity
          style={styles.modalCancelInline}
          onPress={() => {
            onClose();
            clearError?.();
            setAmount('');
          }}
        >
          <Text style={styles.modalCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryActionCompact, (loading || Number(amount) < 100) && styles.primaryActionDisabled]}
          activeOpacity={0.9}
          onPress={() => {
            onTopUp(amount);
          }}
          disabled={loading || Number(amount) < 100}
        >
          <MaterialIcons name="add-circle" size={18} color="#ffffff" />
          <Text style={styles.primaryActionText}>Top Up</Text>
        </TouchableOpacity>
      </View>
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
