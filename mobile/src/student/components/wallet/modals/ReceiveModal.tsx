import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import PremiumBottomSheet from '../../premium/PremiumBottomSheet';

interface ReceiveModalProps {
  visible: boolean;
  onClose: () => void;
  matricNumber: string | null;
  qrUrl: string | null;
}

export const ReceiveModal = React.memo(({ visible, onClose, matricNumber, qrUrl }: ReceiveModalProps) => {
  return (
    <PremiumBottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.modalTitle}>Receive via barcode</Text>
      <Text style={styles.modalSubtitle}>Show this barcode to the sender.</Text>
      <View style={styles.barcodeWrap}>
        {qrUrl ? (
          <Image source={{ uri: qrUrl }} style={styles.qrImage} />
        ) : (
          <View style={styles.barcodeFallback}>
            <Text style={styles.barcodeFallbackText}>Unable to load barcode.</Text>
          </View>
        )}
        <Text style={styles.barcodeValue}>{matricNumber || 'Student barcode'}</Text>
      </View>
      <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
        <Text style={styles.modalCancelText}>Close</Text>
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
  barcodeWrap: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  barcodeFallback: {
    width: 200,
    height: 200,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  barcodeFallbackText: {
    fontFamily: 'Inter-Medium',
    color: '#6b7280',
    fontSize: 14,
  },
  barcodeValue: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 16,
    color: '#1a1c1c',
    marginTop: 16,
    letterSpacing: 2,
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
