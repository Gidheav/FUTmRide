import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface TransactionReceiptModalProps {
  transaction: any | null;
  onClose: () => void;
  onDispute?: (tx: any) => void;
}

export const TransactionReceiptModal = React.memo(({ transaction, onClose, onDispute }: TransactionReceiptModalProps) => {
  const formatAmount = (value: number | string) => {
    const numeric = Number(value || 0);
    return numeric.toLocaleString('en-NG', { minimumFractionDigits: 2 });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (!transaction) return null;

  const isCredit = transaction.transaction_type === 'credit';
  const txDate = new Date(transaction.created_at);
  const hoursDiff = (Date.now() - txDate.getTime()) / (1000 * 60 * 60);
  const canDispute = !isCredit && !transaction.has_dispute && hoursDiff <= 72;

  return (
    <Modal
      visible={!!transaction}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.modalBackdropReceipt} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.receiptCard} activeOpacity={1}>
          <View style={styles.receiptHeader}>
            <MaterialIcons 
              name={isCredit ? 'check-circle' : 'receipt'} 
              size={40} 
              color={isCredit ? '#2e7d32' : '#6A1B9A'} 
            />
            <Text style={styles.receiptTitle}>Transaction Receipt</Text>
            <Text style={styles.receiptDate}>{formatDate(transaction.created_at)}</Text>
          </View>

          <View style={styles.receiptDivider} />

          <View style={styles.receiptBody}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Amount</Text>
              <Text style={[styles.receiptValue, isCredit ? styles.receiptAmountPositive : undefined]}>
                {isCredit ? '+ NGN ' : '- NGN '}
                {formatAmount(transaction.amount)}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Type</Text>
              <Text style={styles.receiptValue}>
                {isCredit ? 'Credit' : 'Debit'}
                {transaction.source ? ` • ${transaction.source.replace(/_/g, ' ')}` : ''}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Description</Text>
              <Text style={styles.receiptValue}>{transaction.narration}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Reference</Text>
              <Text style={styles.receiptValue}>{transaction.reference || 'N/A'}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Status</Text>
              <Text style={[styles.receiptValue, { color: '#2e7d32' }]}>Successful</Text>
            </View>
            
            {transaction.has_dispute && (
              <View style={[styles.receiptRow, { marginTop: 8 }]}>
                <Text style={styles.receiptLabel}>Dispute Status</Text>
                <Text style={[styles.receiptValue, { color: '#b91c1c' }]}>
                  {transaction.dispute_status ? transaction.dispute_status.replace('_', ' ').toUpperCase() : 'IN PROGRESS'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.receiptDivider} />
          
          {canDispute && (
            <TouchableOpacity 
              style={styles.receiptDisputeButton}
              onPress={() => {
                onClose();
                onDispute?.(transaction);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.receiptDisputeText}>Dispute Transaction</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.receiptCloseButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.receiptCloseText}>Close Receipt</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalBackdropReceipt: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  receiptCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  receiptHeader: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    backgroundColor: '#f8fafc',
  },
  receiptTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#0f172a',
    marginTop: 12,
    marginBottom: 4,
  },
  receiptDate: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#64748b',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    borderStyle: 'dashed',
    marginHorizontal: 24,
  },
  receiptBody: {
    padding: 24,
    gap: 16,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  receiptLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  receiptValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#0f172a',
    flex: 2,
    textAlign: 'right',
  },
  receiptAmountPositive: {
    color: '#2e7d32',
  },
  receiptDisputeButton: {
    marginHorizontal: 24,
    marginTop: 24,
    backgroundColor: '#fef2f2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  receiptDisputeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#b91c1c',
  },
  receiptCloseButton: {
    margin: 24,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  receiptCloseText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#334155',
  },
});
