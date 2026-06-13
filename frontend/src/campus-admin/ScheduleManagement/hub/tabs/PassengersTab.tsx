import React from 'react'
import { User, CreditCard, Ticket, CheckCircle2, XCircle } from 'lucide-react'
import { campusPanel } from '../../../shared/campusPanelStyles'
import { T } from '../../../theme'

interface PassengersTabProps {
  search: string
}

export const PassengersTab: React.FC<PassengersTabProps> = ({ search }) => {
  const passengers = [
    { id: 'PAX-901', name: 'Emily Clark', ticket: 'TCK-A12', route: 'RT-1', date: '2026-06-14 08:00', status: 'Confirmed', paid: '₦500', paymentMethod: 'Wallet' },
    { id: 'PAX-902', name: 'Daniel Craig', ticket: 'TCK-A13', route: 'RT-2', date: '2026-06-14 08:30', status: 'Pending', paid: '₦0', paymentMethod: 'Card' },
    { id: 'PAX-903', name: 'Chloe Kim', ticket: 'TCK-A14', route: 'RT-1', date: '2026-06-14 08:00', status: 'Confirmed', paid: '₦500', paymentMethod: 'Wallet' },
    { id: 'PAX-904', name: 'Bruce Wayne', ticket: 'TCK-B99', route: 'RT-4', date: '2026-06-14 10:00', status: 'Cancelled', paid: 'Refunded', paymentMethod: 'Wallet' },
    { id: 'PAX-905', name: 'Diana Prince', ticket: 'TCK-C01', route: 'RT-2', date: '2026-06-14 12:00', status: 'Confirmed', paid: '₦300', paymentMethod: 'Cash' },
  ].filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.ticket.toLowerCase().includes(search.toLowerCase()) || p.route.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ padding: '16px 24px', flex: 1, overflowX: 'auto' }}>
      <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
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
            {passengers.map((p) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 14, background: T.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSecondary }}>
                      <User size={14} />
                    </div>
                    <div>
                      <div style={{ color: T.textPrimary, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{p.id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '16px', fontFamily: 'monospace', color: T.textPrimary, fontWeight: 600 }}>
                  {p.ticket}
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ color: T.textPrimary, fontWeight: 500 }}>{p.route}</div>
                  <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>{p.date}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  {p.status === 'Confirmed' ? (
                    <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}><CheckCircle2 size={14} /> Confirmed</span>
                  ) : p.status === 'Cancelled' ? (
                    <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}><XCircle size={14} /> Cancelled</span>
                  ) : (
                    <span style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}><CheckCircle2 size={14} /> Pending</span>
                  )}
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ color: T.textPrimary, fontWeight: 500 }}>{p.paid}</div>
                  <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CreditCard size={12} /> {p.paymentMethod}
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
