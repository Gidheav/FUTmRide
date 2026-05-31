import React, { memo } from 'react'
import type { Period } from '../types/financial.types'
import { PERIODS } from '../constants/hub.constants'
import { T } from '../../theme'

export const PeriodSelector = memo(({ value, onChange }: {
  value: Period
  onChange: (p: Period) => void
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: 3,
      background: T.bgCard,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
    }}
  >
    {PERIODS.map((p) => {
      const active = value === p.key
      return (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          style={{
            padding: '5px 10px',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: T.fontFamily,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
            background: active ? T.accent : 'transparent',
            color: active ? T.textWhite : T.textMuted,
          }}
        >
          {p.label}
        </button>
      )
    })}
  </div>
))
PeriodSelector.displayName = 'PeriodSelector'
