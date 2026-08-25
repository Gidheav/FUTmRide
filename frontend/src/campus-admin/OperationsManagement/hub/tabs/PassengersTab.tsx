import React from 'react'
import { User, CreditCard, Ticket, CheckCircle2, XCircle } from 'lucide-react'
import { campusPanel } from '../../../shared/campusPanelStyles'
import { T } from '../../../theme'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../../../core/api'
import { useOperationsStore } from '../../../operationsStore'

interface PassengersTabProps {
  search: string
}

export const PassengersTab: React.FC<PassengersTabProps> = ({ search }) => {
  const { refreshSeq } = useOperationsStore()
  const { data, isLoading, error } = useQuery({
    queryKey: ['operations-live-passengers', refreshSeq],
    queryFn: async () => {
      const res = await api.get('/rides/operations/passengers/live/')
      return res.data.results
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const passengers = (data || []).filter((p: any) => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.ticket_ref && p.ticket_ref.toLowerCase().includes(search.toLowerCase())) || 
    (p.route && p.route.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{ padding: 0, marginTop: 4, flex: 1, overflowX: 'auto' }}>
      <div style={{ border: `1px solid ${T.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.bgInput, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Passenger</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Ticket Ref</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Route & Time</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Payment</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: T.textMuted }}>
                  Loading live passengers...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
                  Failed to load passengers.
                </td>
              </tr>
            ) : passengers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: T.textMuted }}>
                  No passengers found.
                </td>
              </tr>
            ) : passengers.map((p: any) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 14, background: T.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSecondary }}>
                      <User size={14} />
                    </div>
                    <div>
                      <div style={{ color: T.textPrimary, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                        {p.type} Passenger
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '16px', fontFamily: 'monospace', color: T.textPrimary, fontWeight: 600 }}>
                  {p.ticket_ref}
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ color: T.textPrimary, fontWeight: 500 }}>{p.route}</div>
                  <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>{p.time}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  {p.status === 'Confirmed' ? (
                    <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}><CheckCircle2 size={14} /> Confirmed</span>
                  ) : p.status === 'Cancelled' ? (
                    <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}><XCircle size={14} /> Cancelled</span>
                  ) : (
                    <span style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}><CheckCircle2 size={14} /> {p.status}</span>
                  )}
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ color: T.textPrimary, fontWeight: 500 }}>₦{Number(p.amount_paid).toLocaleString('en-NG')}</div>
                  <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CreditCard size={12} /> {p.payment_method}
                  </div>
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button style={{ ...campusPanel.btnSecondary, marginRight: 8 }}>View</button>
                  <button style={{ ...campusPanel.btnSecondary, color: '#ef4444', borderColor: '#ef444444' }}>Cancel</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
