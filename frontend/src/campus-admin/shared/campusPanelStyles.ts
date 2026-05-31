import type { CSSProperties } from 'react'
import { T } from '../theme'

/** Shared layout tokens aligned with SettingsPage cards and shell. */
export const campusPanel = {
  shell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    background: T.bg,
    overflow: 'hidden',
  } satisfies CSSProperties,

  scrollMain: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '20px 24px 28px',
    boxSizing: 'border-box',
  } satisfies CSSProperties,

  toolbar: {
    flexShrink: 0,
    margin: '16px 24px 0',
    padding: '14px 18px',
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  } satisfies CSSProperties,

  card: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  } satisfies CSSProperties,

  cardBody: {
    padding: '20px 24px',
  } satisfies CSSProperties,

  cardTitle: {
    color: T.textPrimary,
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
  } satisfies CSSProperties,

  cardSub: {
    color: T.textSecondary,
    fontSize: 13,
    margin: '4px 0 0',
    lineHeight: 1.5,
  } satisfies CSSProperties,

  input: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    borderRadius: 6,
    padding: '8px 12px 8px 32px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  } satisfies CSSProperties,

  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid ${T.border}`,
    background: T.bgCard,
    color: T.textSecondary,
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: T.fontFamily,
  } satisfies CSSProperties,

  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    background: T.accent,
    color: T.textWhite,
    cursor: 'pointer',
    padding: '6px 14px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: T.fontFamily,
  } satisfies CSSProperties,

  kpiBlock: {
    padding: '0 14px',
    textAlign: 'center' as const,
    borderLeft: `1px solid ${T.border}`,
  } satisfies CSSProperties,

  thinScroll: {
    scrollbarWidth: 'thin',
    scrollbarColor: `${T.border} transparent`,
  } satisfies CSSProperties,
}
