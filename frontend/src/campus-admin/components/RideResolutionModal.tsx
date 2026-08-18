import React, { useState, useEffect } from 'react'
import { X, AlertTriangle, ArrowRight, CheckCircle2, UserX, Bus } from 'lucide-react'
import { apiService } from '../../services/api.service'
import { theme } from '../../theme'

const T = theme.colors

interface RideResolutionModalProps {
  ride: any
  onClose: () => void
  onResolved: () => void
}

export default function RideResolutionModal({ ride, onClose, onResolved }: RideResolutionModalProps) {
  const [impact, setImpact] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'IMPACT' | 'MIGRATE' | 'CANCEL_CONFIRM' | 'SUCCESS'>('IMPACT')
  const [compatibleRides, setCompatibleRides] = useState<any[]>([])
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [successResult, setSuccessResult] = useState<any>(null)
  const [confirmRef, setConfirmRef] = useState('')

  useEffect(() => {
    loadImpact()
  }, [])

  const loadImpact = async () => {
    try {
      const data = await apiService.getCancellationImpact(ride.id)
      setImpact(data)
      if (data.can_cancel && data.total_passengers > 0) {
        const rides = await apiService.getCompatibleRides(ride.id)
        setCompatibleRides(rides)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load impact data.')
    } finally {
      setLoading(false)
    }
  }

  const handleMigrate = async () => {
    if (!selectedRideId) return
    setProcessing(true)
    setError(null)
    try {
      const res = await apiService.migrateRide(ride.id, selectedRideId)
      setSuccessResult({ type: 'migrate', ...res })
      setStep('SUCCESS')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Migration failed.')
    } finally {
      setProcessing(false)
    }
  }

  const handleCancel = async () => {
    if (confirmRef !== ride.reference) {
      setError('Reference does not match.')
      return
    }
    setProcessing(true)
    setError(null)
    try {
      await apiService.cancelScheduledRide(ride.id)
      setSuccessResult({ type: 'cancel', refunded: impact.total_passengers, released: impact.assigned_drivers })
      setStep('SUCCESS')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Cancellation failed.')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
          <div style={{ padding: 32, textAlign: 'center', color: T.textSecondary }}>
            Loading impact assessment...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle color="#ef4444" size={20} />
            Resolve Ride: {ride.reference}
          </h2>
          {step !== 'SUCCESS' && !processing && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textSecondary, cursor: 'pointer' }}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: 24, maxHeight: '70vh', overflowY: 'auto' }}>
          {error && (
            <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
              {error}
            </div>
          )}

          {step === 'IMPACT' && (
            <div>
              <p style={{ margin: '0 0 20px 0', color: T.textSecondary, fontSize: 14 }}>
                Review the impact of cancelling this ride before proceeding.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 16, background: T.bgMain, borderRadius: 8, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 24, fontWeight: 600, color: T.text, marginBottom: 4 }}>{impact?.total_passengers || 0}</div>
                  <div style={{ fontSize: 13, color: T.textSecondary }}>Students Affected</div>
                  <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>NGN {impact?.total_refund_amount} total refund liability</div>
                </div>
                <div style={{ padding: 16, background: T.bgMain, borderRadius: 8, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 24, fontWeight: 600, color: T.text, marginBottom: 4 }}>{impact?.assigned_drivers || 0}</div>
                  <div style={{ fontSize: 13, color: T.textSecondary }}>Drivers Assigned</div>
                  <div style={{ fontSize: 12, color: '#eab308', marginTop: 4 }}>Will be released to pool</div>
                </div>
              </div>

              {!impact?.can_cancel && (
                <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', borderRadius: 8, marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>Cancellation Blocked</div>
                  <div style={{ fontSize: 14, color: '#ef4444' }}>Vehicles have already departed. You cannot cancel this ride.</div>
                </div>
              )}

              {impact?.boarded_passengers > 0 && (
                <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', borderRadius: 8, marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>Unboard Required</div>
                  <div style={{ fontSize: 14, color: '#ef4444' }}>{impact.boarded_passengers} students have physically boarded a vehicle. You must unboard them before cancelling.</div>
                </div>
              )}

              {impact?.can_cancel && impact.boarded_passengers === 0 && (
                <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                  {impact.total_passengers > 0 && compatibleRides.length > 0 && (
                    <button 
                      onClick={() => setStep('MIGRATE')}
                      style={{ flex: 1, padding: '12px', background: T.primary, color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                    >
                      <ArrowRight size={16} /> Migrate Students
                    </button>
                  )}
                  <button 
                    onClick={() => impact.total_passengers > 0 ? setStep('CANCEL_CONFIRM') : handleCancel()}
                    disabled={processing}
                    style={{ flex: 1, padding: '12px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {processing ? 'Processing...' : (impact.total_passengers > 0 ? 'Cancel & Refund All' : 'Cancel Ride')}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'MIGRATE' && (
            <div>
              <button 
                onClick={() => setStep('IMPACT')}
                style={{ background: 'none', border: 'none', color: T.textSecondary, cursor: 'pointer', fontSize: 14, marginBottom: 20, padding: 0 }}
              >
                ← Back
              </button>
              <h3 style={{ margin: '0 0 16px 0', color: T.text, fontSize: 16 }}>Select Destination Ride</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {compatibleRides.map(r => (
                  <div 
                    key={r.id}
                    onClick={() => setSelectedRideId(r.id)}
                    style={{ 
                      padding: 16, 
                      border: `2px solid ${selectedRideId === r.id ? T.primary : T.border}`,
                      borderRadius: 8,
                      background: T.bgMain,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, color: T.text }}>{r.reference}</span>
                      <span style={{ color: T.textSecondary, fontSize: 14 }}>{r.window_start} - {r.window_end}</span>
                    </div>
                    <div style={{ fontSize: 13, color: T.textSecondary, display: 'flex', gap: 16 }}>
                      <span><Bus size={12} style={{marginRight: 4}}/>{r.available_seats} seats avail</span>
                      <span style={{color: r.available_seats < impact.total_passengers ? '#ef4444' : '#10b981'}}>
                        {r.available_seats >= impact.total_passengers ? 'Can fit all' : 'Partial fit'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button 
                  onClick={handleMigrate}
                  disabled={!selectedRideId || processing}
                  style={{ padding: '10px 24px', background: T.primary, color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: selectedRideId ? 'pointer' : 'not-allowed', opacity: selectedRideId ? 1 : 0.5 }}
                >
                  {processing ? 'Migrating...' : 'Confirm Migration'}
                </button>
              </div>
            </div>
          )}

          {step === 'CANCEL_CONFIRM' && (
            <div>
              <button 
                onClick={() => setStep('IMPACT')}
                style={{ background: 'none', border: 'none', color: T.textSecondary, cursor: 'pointer', fontSize: 14, marginBottom: 20, padding: 0 }}
              >
                ← Back
              </button>
              <div style={{ padding: 20, background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', marginBottom: 24 }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#ef4444', fontSize: 16 }}>Warning: Full Refund</h3>
                <p style={{ margin: 0, color: '#ef4444', fontSize: 14, lineHeight: 1.5 }}>
                  This will cancel the ride and refund <strong>NGN {impact.total_refund_amount}</strong> back to the wallets of <strong>{impact.total_passengers}</strong> students. Drivers will be unassigned. This action cannot be undone.
                </p>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: T.textSecondary }}>
                  Type <strong>{ride.reference}</strong> to confirm:
                </label>
                <input 
                  type="text" 
                  value={confirmRef}
                  onChange={e => setConfirmRef(e.target.value)}
                  placeholder={ride.reference}
                  style={{ width: '100%', padding: '10px 12px', background: T.bgMain, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={handleCancel}
                  disabled={confirmRef !== ride.reference || processing}
                  style={{ padding: '10px 24px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: confirmRef === ride.reference ? 'pointer' : 'not-allowed', opacity: confirmRef === ride.reference ? 1 : 0.5 }}
                >
                  {processing ? 'Cancelling...' : 'Cancel & Refund'}
                </button>
              </div>
            </div>
          )}

          {step === 'SUCCESS' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle2 color="#10b981" size={48} style={{ marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 16px 0', color: T.text, fontSize: 20 }}>Resolution Complete</h3>
              
              {successResult.type === 'migrate' ? (
                <div style={{ fontSize: 15, color: T.textSecondary, lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 8px 0', color: '#10b981' }}>{successResult.migrated_count} students migrated.</p>
                  {successResult.unmigrated_count > 0 && (
                    <p style={{ margin: 0, color: '#eab308' }}>{successResult.unmigrated_count} students could not be fit and were refunded.</p>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 15, color: T.textSecondary, lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 8px 0' }}>{successResult.refunded} students refunded.</p>
                  <p style={{ margin: 0 }}>{successResult.released} drivers released.</p>
                </div>
              )}

              <button 
                onClick={() => { onClose(); onResolved(); }}
                style={{ marginTop: 32, padding: '10px 32px', background: T.primary, color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const modalContentStyle: React.CSSProperties = {
  background: T.bgPanel,
  borderRadius: 12,
  width: '100%',
  maxWidth: 500,
  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
  border: `1px solid ${T.border}`,
}
