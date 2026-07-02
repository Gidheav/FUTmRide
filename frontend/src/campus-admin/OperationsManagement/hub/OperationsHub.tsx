import React, { useEffect, useState } from 'react'
import { Download, RefreshCw, Search, X, Ticket, CheckCircle2, AlertCircle } from 'lucide-react'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import { useOperationsStore } from '../../operationsStore'
import { DeparturesTab } from './tabs/DeparturesTab'
import { RoutesTab } from './tabs/RoutesTab'
import { FleetTab } from './tabs/FleetTab'
import { PassengersTab } from './tabs/PassengersTab'
import api from '../../../core/api'

export default function OperationsHub() {
  const { activeTab } = useOperationsStore()
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [ticketInput, setTicketInput] = useState('')
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1)
  }

  const kpiStrip = (
    <div style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
      {[
        { label: 'Active Routes', value: '12', color: T.accent },
        { label: 'Today departures', value: '45', color: T.textPrimary },
        { label: 'Total Passengers', value: '382', color: T.textPrimary },
      ].map((k, i) => (
        <div key={k.label} style={{ ...campusPanel.kpiBlock, borderLeft: i === 0 ? 'none' : campusPanel.kpiBlock.borderLeft }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>
            {k.label}
          </p>
          <p style={{ fontSize: 15, fontWeight: 700, color: k.color, margin: '2px 0 0', fontFamily: T.fontFamily }}>
            {k.value}
          </p>
        </div>
      ))}
    </div>
  )

  const refreshButton = (
    <button type="button" onClick={handleRefresh} style={campusPanel.btnPrimary}>
      <RefreshCw size={13} />
      Refresh
    </button>
  )

  const verifyTicket = async () => {
    if (!ticketInput.trim()) return
    setVerifyLoading(true)
    setVerifyResult(null)
    setVerifyError('')
    try {
      const res = await api.get(`/rides/tickets/verify/${ticketInput}/`)
      setVerifyResult(res.data)
    } catch (err: any) {
      setVerifyError(err.response?.data?.message || 'Ticket not found or invalid.')
    } finally {
      setVerifyLoading(false)
    }
  }

  return (
    <div style={campusPanel.shell}>
      {showVerifyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: T.bgPanel, padding: 24, borderRadius: 12, width: 400, border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: T.textWhite, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ticket size={18} color={T.accent} /> Quick Verification
              </h3>
              <button onClick={() => setShowVerifyModal(false)} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={18}/></button>
            </div>
            
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input 
                type="text" 
                placeholder="Enter TCK-XXXXXX"
                value={ticketInput}
                onChange={e => setTicketInput(e.target.value.toUpperCase())}
                style={{ ...campusPanel.input, flex: 1, textTransform: 'uppercase' }}
                onKeyDown={e => e.key === 'Enter' && verifyTicket()}
              />
              <button onClick={verifyTicket} style={campusPanel.btnPrimary} disabled={verifyLoading}>
                {verifyLoading ? 'Verifying...' : 'Verify'}
              </button>
            </div>

            {verifyError && (
              <div style={{ padding: 12, background: '#ef44441a', border: '1px solid #ef444444', borderRadius: 8, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <AlertCircle size={16} /> {verifyError}
              </div>
            )}

            {verifyResult && (
              <div style={{ padding: 16, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontWeight: 600, marginBottom: 12 }}>
                  <CheckCircle2 size={18} /> Ticket Valid
                </div>
                <div style={{ fontSize: 13, color: T.textSecondary, display: 'grid', gap: 8 }}>
                  <div><strong>Passenger:</strong> {verifyResult.passenger_name}</div>
                  <div><strong>Route:</strong> {verifyResult.route}</div>
                  <div><strong>Time:</strong> {verifyResult.time}</div>
                  <div><strong>Status:</strong> {verifyResult.status} ({verifyResult.type})</div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <button onClick={() => { setTicketInput(''); setVerifyResult(null); }} style={{ ...campusPanel.btnSecondary, flex: 1 }}>Clear</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ ...campusPanel.toolbar, flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        
        <div style={{ flex: 1, minWidth: 160, maxWidth: 320, position: 'relative' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textMuted }}
          />
          <input
            type="text"
            placeholder="Search schedules, routes, fleet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...campusPanel.input, paddingLeft: 32, paddingRight: search ? 28 : 12 }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                border: 'none', background: 'transparent', cursor: 'pointer', color: T.textMuted,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', justifyContent: 'flex-start' }}>
          {kpiStrip}
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
          {activeTab === 'departures' && (
            <button type="button" style={campusPanel.btnPrimary}>+ Schedule Ride</button>
          )}
          {activeTab === 'routes' && (
            <button type="button" style={campusPanel.btnPrimary}>+ Create Route</button>
          )}
          {activeTab === 'fleet' && (
            <button type="button" style={campusPanel.btnPrimary}>Auto-Assign</button>
          )}
          {activeTab === 'passengers' && (
            <button type="button" style={campusPanel.btnSecondary}>Issue Ticket</button>
          )}
          <button type="button" style={campusPanel.btnSecondary}>
            <Download size={13} />
            Export
          </button>
          <button 
            type="button" 
            style={{ ...campusPanel.btnPrimary, background: T.accentBg, color: T.accent, borderColor: T.accent }}
            onClick={() => { setTicketInput(''); setVerifyResult(null); setVerifyError(''); setShowVerifyModal(true); }}
          >
            <Ticket size={13} /> Quick Ver
          </button>
          {refreshButton}
        </div>
      </div>

      <div style={{ ...campusPanel.scrollMain, ...campusPanel.thinScroll }}>
        {activeTab === 'departures' && <DeparturesTab key={refreshKey} search={search} />}
        {activeTab === 'routes' && <RoutesTab key={refreshKey} search={search} />}
        {activeTab === 'fleet' && <FleetTab key={refreshKey} search={search} />}
        {activeTab === 'passengers' && <PassengersTab key={refreshKey} search={search} />}
      </div>
    </div>
  )
}
