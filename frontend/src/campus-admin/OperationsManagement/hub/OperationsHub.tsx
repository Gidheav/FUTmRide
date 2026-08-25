import React, { useEffect, useState } from 'react'
import { Download, RefreshCw, Search, X, Ticket, CheckCircle2, AlertCircle, Database } from 'lucide-react'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import { useOperationsStore } from '../../operationsStore'
import { DeparturesTab } from './tabs/DeparturesTab'
import { RoutesTab } from './tabs/RoutesTab'
import { FleetTab } from './tabs/FleetTab'
import { PassengersTab } from './tabs/PassengersTab'
import { LogTab } from './tabs/LogTab'
import api from '../../../core/api'
import { format } from 'date-fns'

export default function OperationsHub() {
  const { activeTab, logLastSyncTime, bumpRefresh } = useOperationsStore()
  const [search, setSearch] = useState('')

  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [ticketInput, setTicketInput] = useState('')
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  // Log Tab Filters
  const [logType, setLogType] = useState('on_demand,scheduled,garage,shared')
  const [logDateFrom, setLogDateFrom] = useState('')
  const [logDateTo, setLogDateTo] = useState('')

  // Archive State
  const [isArchiveMode, setIsArchiveMode] = useState(false)

  const handleRefresh = () => bumpRefresh()

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

  const logFiltersStrip = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', height: '100%' }}>
      <select
        value={logType}
        onChange={e => setLogType(e.target.value)}
        style={{ ...campusPanel.input, width: 130 }}
      >
        <option value="on_demand,scheduled,garage,shared">All Types</option>
        <option value="on_demand">On-Demand</option>
        <option value="scheduled">Scheduled</option>
        <option value="garage">Garage</option>
        <option value="shared">Shared</option>
      </select>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: T.textMuted }}>From:</span>
        <input
          type="date"
          value={logDateFrom}
          onChange={e => setLogDateFrom(e.target.value)}
          style={{ ...campusPanel.input, width: 150 }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: T.textMuted }}>To:</span>
        <input
          type="date"
          value={logDateTo}
          onChange={e => setLogDateTo(e.target.value)}
          style={{ ...campusPanel.input, width: 150 }}
        />
      </div>
      <button 
        onClick={() => {
          setSearch('')
          setLogType('on_demand,scheduled,garage')
          setLogDateFrom('')
          setLogDateTo('')
        }}
        style={campusPanel.btnSecondary}
      >
        Clear
      </button>
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
        
        {activeTab === 'log' && (
          <div 
            onClick={(e) => {
              if (e.detail === 5) setIsArchiveMode(true);
              else if (e.detail === 1) setIsArchiveMode(false);
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: isArchiveMode ? T.accent : T.textMuted,
              padding: '6px',
              borderRadius: '6px',
              background: isArchiveMode ? T.accentBg : 'transparent',
              transition: 'all 0.2s'
            }}
            title="Click 5 times fast to open Deep Archive Search. Single-click to close."
          >
            <Database size={16} />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 160, maxWidth: 320, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textMuted }}
          />
          
          <input
            type="text"
            placeholder={activeTab === 'log' 
              ? (isArchiveMode ? 'Deep Archive Search...' : 'Search student, driver, reference, location...') 
              : 'Search schedules, routes, fleet...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              ...campusPanel.input, 
              paddingLeft: 32, 
              paddingRight: search ? 28 : 12,
              width: '100%',
              borderColor: isArchiveMode && activeTab === 'log' ? T.accent : T.border
            }}
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
        
        {activeTab === 'log' && logLastSyncTime && (
           <div style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>
             Last synced: {format(logLastSyncTime, 'h:mm:ss a')}
           </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', justifyContent: 'flex-start' }}>
          {activeTab === 'log' ? logFiltersStrip : kpiStrip}
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
          {activeTab !== 'log' && (
            <button type="button" style={campusPanel.btnSecondary}>
              <Download size={13} />
              Export
            </button>
          )}
          {activeTab !== 'log' && (
            <button 
              type="button" 
              style={{ ...campusPanel.btnPrimary, background: T.accentBg, color: T.accent, borderColor: T.accent }}
              onClick={() => { setTicketInput(''); setVerifyResult(null); setVerifyError(''); setShowVerifyModal(true); }}
            >
              <Ticket size={13} /> Quick Ver
            </button>
          )}
          {refreshButton}
        </div>
      </div>

      {/* 
        All tabs are always mounted — visibility toggled with display:none.
        This eliminates mount/unmount cycles, flickers, and re-fetches on tab switch.
        Each tab manages its own one-time initialization internally.
      */}
      <div style={{ 
        ...campusPanel.scrollMain, 
        ...campusPanel.thinScroll, 
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflowY: activeTab === 'log' ? 'hidden' : 'auto'
      }}>
        <div style={{ display: activeTab === 'departures' ? 'block' : 'none', flex: 1, minHeight: 0 }}>
          <DeparturesTab search={search} />
        </div>
        <div style={{ display: activeTab === 'routes' ? 'block' : 'none', flex: 1, minHeight: 0 }}>
          <RoutesTab search={search} />
        </div>
        <div style={{ display: activeTab === 'fleet' ? 'block' : 'none', flex: 1, minHeight: 0 }}>
          <FleetTab search={search} />
        </div>
        <div style={{ display: activeTab === 'passengers' ? 'block' : 'none', flex: 1, minHeight: 0 }}>
          <PassengersTab search={search} />
        </div>
        <div style={{ display: activeTab === 'log' ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
          <LogTab 
            search={search}
            rideType={logType}
            dateFrom={logDateFrom}
            dateTo={logDateTo}
            isArchiveMode={isArchiveMode}
          />
        </div>
      </div>
    </div>
  )
}
