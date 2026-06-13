import React, { useEffect, useState } from 'react'
import { Download, RefreshCw, Search, X } from 'lucide-react'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import { useOperationsStore } from '../../operationsStore'
import { DeparturesTab } from './tabs/DeparturesTab'
import { RoutesTab } from './tabs/RoutesTab'
import { FleetTab } from './tabs/FleetTab'
import { PassengersTab } from './tabs/PassengersTab'

export default function OperationsHub() {
  const { activeTab } = useOperationsStore()
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

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

  return (
    <div style={campusPanel.shell}>
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
