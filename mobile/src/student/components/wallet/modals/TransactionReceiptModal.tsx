import React, { useCallback, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import PremiumBottomSheet from '../../premium/PremiumBottomSheet';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

interface TransactionReceiptModalProps {
  transaction: any | null;
  onClose: () => void;
  onDispute?: (tx: any) => void;
}

export const TransactionReceiptModal = React.memo(({ transaction, onClose, onDispute }: TransactionReceiptModalProps) => {
  const viewShotRef = useRef<ViewShot>(null);

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

  const shareAsImage = useCallback(async () => {
    if (!viewShotRef.current?.capture || !transaction) return;
    try {
      const uri = await viewShotRef.current.capture();
      // On some versions of expo-file-system/legacy, copyAsync fails silently or throws.
      // We will just share the original URI which already has a valid path.
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `Transaction-Receipt-${transaction.reference || 'FUTMRIDE'}`,
        });
      }
    } catch (e) {
      console.warn('Share image error:', e);
    }
  }, [transaction]);

  const shareAsPdf = useCallback(async () => {
    if (!transaction) return;
    const isCredit = transaction.transaction_type === 'credit';
    const amountStr = `${isCredit ? '+' : '-'} NGN ${formatAmount(transaction.amount)}`;
    const txType = `${isCredit ? 'Credit' : 'Debit'}${transaction.source ? ` · ${transaction.source.replace(/_/g, ' ')}` : ''}`;
    const dateStr = formatDate(transaction.created_at);
    const ref = transaction.reference || 'N/A';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body { 
            margin: 0; 
            padding: 40px; 
            background-color: #f1f5f9; 
            font-family: 'Inter', -apple-system, sans-serif; 
            color: #0f172a; 
            -webkit-print-color-adjust: exact; 
          }
          .receipt-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            overflow: hidden;
            position: relative;
          }
          .watermark {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background-image: url('data:image/svg+xml;utf8,<svg width="250" height="250" xmlns="http://www.w3.org/2000/svg"><text x="0" y="50" font-size="24" font-weight="bold" fill="rgba(100,116,139,0.04)" transform="rotate(-35 100 100)" font-family="sans-serif">FUTMRIDE APPROVED</text></svg>');
            pointer-events: none;
            z-index: 1;
          }
          .header-accent {
            height: 8px;
            background: linear-gradient(90deg, #6A1B9A 0%, #9C27B0 100%);
          }
          .header { 
            text-align: center; 
            padding: 40px 40px 20px; 
            position: relative;
            z-index: 2;
          }
          .icon-wrap {
            width: 64px; height: 64px; 
            border-radius: 20px;
            background: ${isCredit ? '#dcfce7' : '#f3e8ff'};
            color: ${isCredit ? '#16a34a' : '#6A1B9A'};
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin-bottom: 16px;
          }
          .header h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: -0.5px; }
          .header p { color: #64748b; font-size: 15px; margin: 0; font-weight: 500; }
          
          .amount-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            margin: 0 40px 30px;
            padding: 24px;
            text-align: center;
            position: relative;
            z-index: 2;
          }
          .amount-label { color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px; }
          .amount-value { color: ${isCredit ? '#16a34a' : '#0f172a'}; font-size: 32px; font-weight: 700; letter-spacing: -1px; margin: 0; }
          
          .details {
            padding: 0 40px 20px;
            position: relative;
            z-index: 2;
          }
          .row { 
            display: flex; 
            justify-content: space-between; 
            padding: 16px 0; 
            border-bottom: 1px solid #f1f5f9;
          }
          .row:last-child { border-bottom: none; }
          .label { color: #64748b; font-size: 14px; font-weight: 500; }
          .value { font-weight: 600; font-size: 14px; text-align: right; max-width: 60%; }
          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #dcfce7;
            color: #16a34a;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
          }
          .status-dot { width: 6px; height: 6px; background: #16a34a; border-radius: 50%; }
          
          .footer { 
            text-align: center; 
            padding: 30px 40px 40px; 
            background: #f8fafc;
            color: #94a3b8; 
            font-size: 13px; 
            font-weight: 500;
            position: relative;
            z-index: 2;
            border-top: 1px dashed #e2e8f0;
          }
          .footer strong { color: #64748b; }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="watermark"></div>
          <div class="header-accent"></div>
          
          <div class="header">
            <div class="icon-wrap">
              ${isCredit ? '✓' : '🧾'}
            </div>
            <h1>Transaction Receipt</h1>
            <p>${dateStr}</p>
          </div>
          
          <div class="amount-box">
            <div class="amount-label">Transaction Amount</div>
            <h2 class="amount-value">${amountStr}</h2>
          </div>
          
          <div class="details">
            <div class="row">
              <span class="label">Type</span>
              <span class="value">${txType}</span>
            </div>
            <div class="row">
              <span class="label">Description</span>
              <span class="value">${transaction.narration || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Reference</span>
              <span class="value" style="font-family: monospace;">${ref}</span>
            </div>
            <div class="row">
              <span class="label">Status</span>
              <span class="value">
                <div class="status-badge">
                  <div class="status-dot"></div>
                  Successful
                </div>
              </span>
            </div>
          </div>
          
          <div class="footer">
            <strong>FUTMRIDE</strong> · Powered by FUTMinna<br/>
            <span style="font-size: 11px; margin-top: 8px; display: inline-block;">Generated on ${new Date().toLocaleString('en-NG')}</span>
          </div>
        </div>
      </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Transaction-Receipt-${ref}`,
        });
      }
    } catch (e) {
      console.warn('Share PDF error:', e);
    }
  }, [transaction]);

  if (!transaction) return null;

  const isCredit = transaction.transaction_type === 'credit';
  const txDate = new Date(transaction.created_at);
  const hoursDiff = (Date.now() - txDate.getTime()) / (1000 * 60 * 60);
  const canDispute = !isCredit && !transaction.has_dispute && hoursDiff <= 72;
  
  const txStatus = transaction.status || 'successful';
  const isPending = txStatus === 'processing' || txStatus === 'pending';
  const isFailed = txStatus === 'failed';
  
  const getStatusColor = () => {
    if (isPending) return '#f59e0b'; // amber
    if (isFailed) return '#ef4444'; // red
    return '#16a34a'; // green
  };
  const getStatusBg = () => {
    if (isPending) return '#fef3c7';
    if (isFailed) return '#fef2f2';
    return '#dcfce7';
  };
  const getStatusText = () => {
    if (isPending) return 'Processing...';
    if (isFailed) return 'Failed';
    return 'Successful';
  };

  return (
    <PremiumBottomSheet
      visible={!!transaction}
      onClose={onClose}
      snapPoints={['75%', '88%']}
    >
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
        <View style={styles.receiptContent}>
          {/* Watermark Overlay for the Image capture */}
          <View style={styles.watermarkContainer} pointerEvents="none">
            {Array.from({ length: 6 }).map((_, i) => (
              <Text key={i} style={styles.watermarkText}>FUTMRIDE</Text>
            ))}
          </View>

          {/* Header */}
          <View style={styles.receiptHeader}>
            <View style={[styles.receiptIconWrap, isCredit ? styles.receiptIconCredit : styles.receiptIconDebit]}>
              <MaterialIcons 
                name={isCredit ? 'check-circle' : 'receipt'} 
                size={32} 
                color={isCredit ? '#2e7d32' : '#6A1B9A'} 
              />
            </View>
            <Text style={styles.receiptTitle}>Transaction Receipt</Text>
            <Text style={styles.receiptDate}>{formatDate(transaction.created_at)}</Text>
          </View>

          {/* Amount */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={[styles.amountValue, isCredit && styles.amountValuePositive]}>
              {isCredit ? '+' : '-'} ₦{formatAmount(transaction.amount)}
            </Text>
          </View>

          {/* Details */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>
                {isCredit ? 'Credit' : 'Debit'}
                {transaction.source ? ` · ${transaction.source.replace(/_/g, ' ')}` : ''}
              </Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValue} numberOfLines={2}>{transaction.narration || 'N/A'}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reference</Text>
              <Text style={[styles.detailValue, styles.detailValueMono]}>{transaction.reference || 'N/A'}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusBg() }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
              </View>
            </View>

            {transaction.has_dispute && (
              <>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Dispute</Text>
                  <Text style={[styles.detailValue, { color: '#b91c1c' }]}>
                    {transaction.dispute_status ? transaction.dispute_status.replace('_', ' ').toUpperCase() : 'IN PROGRESS'}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Image Capture Footer */}
          <View style={styles.captureFooter}>
            <Text style={styles.captureFooterText}>
              <Text style={{ fontFamily: 'Inter-Bold', color: '#64748b' }}>FUTMRIDE</Text> · Powered by FUTMinna
            </Text>
          </View>
        </View>
      </ViewShot>

      {/* Share Buttons */}
      <View style={styles.shareRow}>
        <TouchableOpacity style={[styles.shareBtn, isPending && { opacity: 0.5 }]} onPress={shareAsImage} activeOpacity={0.8} disabled={isPending}>
          <MaterialIcons name="image" size={20} color="#6A1B9A" />
          <Text style={styles.shareBtnText}>Share as Image</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.shareBtn, isPending && { opacity: 0.5 }]} onPress={shareAsPdf} activeOpacity={0.8} disabled={isPending}>
          <MaterialIcons name="picture-as-pdf" size={20} color="#6A1B9A" />
          <Text style={styles.shareBtnText}>Share as PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Dispute Button */}
      {canDispute && (
        <TouchableOpacity 
          style={[styles.disputeButton, isPending && { opacity: 0.5 }]}
          onPress={() => {
            onClose();
            onDispute?.(transaction);
          }}
          activeOpacity={0.8}
          disabled={isPending}
        >
          <MaterialIcons name="flag" size={18} color="#b91c1c" />
          <Text style={styles.disputeButtonText}>Dispute Transaction</Text>
        </TouchableOpacity>
      )}
    </PremiumBottomSheet>
  );
});

const styles = StyleSheet.create({
  receiptContent: {
    paddingHorizontal: 4,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    opacity: 0.03,
    transform: [{ rotate: '-35deg' }, { scale: 1.5 }],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    zIndex: 0,
  },
  watermarkText: {
    fontFamily: 'Inter-Bold',
    fontSize: 48,
    color: '#0f172a',
    letterSpacing: 4,
  },
  receiptHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
    zIndex: 1,
  },
  receiptIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  receiptIconCredit: {
    backgroundColor: '#dcfce7',
  },
  receiptIconDebit: {
    backgroundColor: '#F3E8FF',
  },
  receiptTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  receiptDate: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#64748b',
  },

  // Amount Card
  amountCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 1,
  },
  amountLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#64748b',
    marginBottom: 6,
  },
  amountValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#0f172a',
    letterSpacing: -1,
  },
  amountValuePositive: {
    color: '#16a34a',
  },

  // Details Card
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f1f5f9',
  },
  detailLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#64748b',
  },
  detailValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#0f172a',
    flex: 1,
    textAlign: 'right',
  },
  detailValueMono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 13,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  statusText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#16a34a',
  },

  captureFooter: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    borderStyle: 'dashed',
    zIndex: 1,
  },
  captureFooterText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#94a3b8',
  },

  // Share Row
  shareRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 8,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  shareBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#6A1B9A',
  },

  // Dispute
  disputeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 4,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  disputeButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#b91c1c',
  },
});
