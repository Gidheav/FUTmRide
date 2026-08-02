import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import PremiumBottomSheet from '../../premium/PremiumBottomSheet';
import LoadingOverlay from '../../../components/LoadingOverlay';

interface TransferConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
  loading: boolean;
}

const transferPinRows = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [null, 0, 'back'],
];

export const TransferConfirmModal = React.memo(({ visible, onClose, onConfirm, loading }: TransferConfirmModalProps) => {
  const [pinInput, setPinInput] = useState('');

  // Reset when opened
  useEffect(() => {
    if (visible) {
      setPinInput('');
    }
  }, [visible]);

  const handleDigit = (digit: string | number | null) => {
    if (!digit || loading) return;
    
    if (digit === 'back') {
      setPinInput((prev) => prev.slice(0, -1));
      return;
    }
    
    if (pinInput.length < 4) {
      const newPin = pinInput + digit;
      setPinInput(newPin);
      
      if (newPin.length === 4) {
        onConfirm(newPin);
      }
    }
  };

  return (
    <PremiumBottomSheet visible={visible} onClose={onClose} snapPoints={["75%", "90%"]}>
      <Text style={styles.modalTitle}>Confirm transfer</Text>
      <Text style={styles.modalSubtitle}>Enter your 4-digit Transaction PIN to continue.</Text>
      
      <View style={styles.pinDotsRow}>
        {[0, 1, 2, 3].map((idx) => (
          <View
            key={`pin-dot-${idx}`}
            style={[styles.pinDot, pinInput.length > idx && styles.pinDotFilled]}
          />
        ))}
      </View>
      
      <View style={styles.pinPad}>
        {transferPinRows.map((row, rowIndex) => (
          <View key={`pin-row-${rowIndex}`} style={styles.pinRow}>
            {row.map((digit, colIndex) => (
              <TouchableOpacity
                key={`pin-${rowIndex}-${colIndex}`}
                style={[styles.pinKey, (!digit || loading) && styles.pinKeyDisabled]}
                activeOpacity={0.85}
                onPress={() => handleDigit(digit)}
                disabled={!digit || loading}
              >
                {digit === 'back' ? (
                  <MaterialIcons name="backspace" size={20} color="#1a1c1c" />
                ) : (
                  <Text style={styles.pinKeyText}>{digit}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
      
      <TouchableOpacity
        style={styles.modalCancel}
        onPress={() => {
          onClose();
          setPinInput('');
        }}
        disabled={loading}
      >
        <Text style={styles.modalCancelText}>Cancel</Text>
      </TouchableOpacity>
      
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
    marginBottom: 32,
    lineHeight: 20,
  },
  pinDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 40,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  pinDotFilled: {
    backgroundColor: '#6A1B9A',
  },
  pinPad: {
    gap: 16,
    marginBottom: 32,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  pinKey: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinKeyDisabled: {
    backgroundColor: 'transparent',
  },
  pinKeyText: {
    fontFamily: 'Inter-Medium',
    fontSize: 24,
    color: '#1a1c1c',
  },
  modalCancel: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
  },
  modalCancelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#4b5563',
  },
});
