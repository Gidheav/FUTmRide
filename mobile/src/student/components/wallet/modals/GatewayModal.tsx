import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PremiumBottomSheet from '../../premium/PremiumBottomSheet';

interface GatewayModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGateway: (gateway: 'paystack' | 'flutterwave') => void;
  loading: boolean;
}

export const GatewayModal = React.memo(({ visible, onClose, onSelectGateway, loading }: GatewayModalProps) => {
  return (
    <PremiumBottomSheet visible={visible} onClose={onClose} snapPoints={["40%"]}>
      <Text style={styles.modalTitle}>Choose payment gateway</Text>
      <Text style={styles.modalSubtitle}>Select Paystack or Flutterwave to continue.</Text>
      
      <TouchableOpacity
        style={styles.radioRow}
        onPress={() => onSelectGateway('paystack')}
        disabled={loading}
      >
        <View style={styles.radioOuter}>
          <View style={styles.radioInner} />
        </View>
        <Text style={styles.radioLabel}>Paystack</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.radioRow}
        onPress={() => onSelectGateway('flutterwave')}
        disabled={loading}
      >
        <View style={styles.radioOuter}>
          <View style={styles.radioInnerMuted} />
        </View>
        <Text style={styles.radioLabel}>Flutterwave</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.modalCancel}
        onPress={onClose}
        disabled={loading}
      >
        <Text style={styles.modalCancelText}>Cancel</Text>
      </TouchableOpacity>
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
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#6A1B9A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6A1B9A',
  },
  radioInnerMuted: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  radioLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#1a1c1c',
  },
  modalCancel: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    marginTop: 24,
  },
  modalCancelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#4b5563',
  },
});
