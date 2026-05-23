import { create } from 'zustand'

export const T = {
  bg: 'var(--theme-bg, #0b0f19)',
  bgPanel: 'var(--theme-bgPanel, #111827)',
  bgCard: 'var(--theme-bgCard, #151c2c)',
  bgCardHover: 'var(--theme-bgCardHover, #1a2236)',
  bgInput: 'var(--theme-bgInput, #0f1525)',
  border: 'var(--theme-border, #1e293b)',
  borderLight: 'var(--theme-borderLight, #263045)',
  accent: 'var(--theme-accent, #7e22ce)',
  accentDim: 'var(--theme-accentDim, #6b21a8)',
  accentBg: 'var(--theme-accentBg, rgba(126,34,206,0.12))',
  textPrimary: 'var(--theme-textPrimary, #e2e8f0)',
  textSecondary: 'var(--theme-textSecondary, #94a3b8)',
  textMuted: 'var(--theme-textMuted, #64748b)',
  textWhite: 'var(--theme-textWhite, #f8fafc)',
  warn: 'var(--theme-warn, #f59e0b)',
  warnBg: 'var(--theme-warnBg, rgba(245,158,11,0.14))',
  error: 'var(--theme-error, #ef4444)',
  blue: 'var(--theme-blue, #3b82f6)',
  purple: 'var(--theme-purple, #8b5cf6)',
  sidebar: 'var(--theme-sidebar, #0d1117)',
  topBar: 'var(--theme-topBar, #0f1420)',
  mapBg: 'var(--theme-mapBg, #0c1827)',
  mapOverlayBg: 'var(--theme-mapOverlayBg, rgba(11,15,25,0.92))',
  mapTooltipBg: 'var(--theme-mapTooltipBg, rgba(11,15,25,0.88))',
  mapGridLines: 'var(--theme-mapGridLines, #1a2a3a)',
  mapGridLines2: 'var(--theme-mapGridLines2, #1e3a4a)',
  mapGridLines3: 'var(--theme-mapGridLines3, #1a3040)',
  heatGreen: 'var(--theme-heatGreen, rgba(16,185,129,0.35))',
  heatTeal: 'var(--theme-heatTeal, rgba(20,184,166,0.30))',
  fontFamily: 'var(--font-sans)',
}

interface ThemeStore {
  mode: 'dark' | 'light'
  toggleMode: () => void
}

export const useCampusThemeStore = create<ThemeStore>((set) => ({
  mode: 'light',
  toggleMode: () => set((state) => ({ mode: state.mode === 'dark' ? 'light' : 'dark' })),
}))

export const themeCss = `
  .campus-theme-dark {
    --theme-bg: #0b0f19;
    --theme-bgPanel: #111827;
    --theme-bgCard: #151c2c;
    --theme-bgCardHover: #1a2236;
    --theme-bgInput: #0f1525;
    --theme-border: #1e293b;
    --theme-borderLight: #263045;
    --theme-accent: #a855f7;
    --theme-accentDim: #9333ea;
    --theme-accentBg: rgba(168,85,247,0.12);
    --theme-textPrimary: #e2e8f0;
    --theme-textSecondary: #94a3b8;
    --theme-textMuted: #64748b;
    --theme-textWhite: #f8fafc;
    --theme-warn: #f59e0b;
    --theme-warnBg: rgba(245,158,11,0.14);
    --theme-error: #ef4444;
    --theme-blue: #3b82f6;
    --theme-purple: #8b5cf6;
    --theme-sidebar: #0d1117;
    --theme-topBar: #0f1420;
    --theme-mapBg: #0c1827;
    --theme-mapOverlayBg: rgba(11,15,25,0.92);
    --theme-mapTooltipBg: rgba(11,15,25,0.88);
    --theme-mapGridLines: #1a2a3a;
    --theme-mapGridLines2: #1e3a4a;
    --theme-mapGridLines3: #1a3040;
    --theme-heatGreen: rgba(147,51,234,0.35);
    --theme-heatTeal: rgba(99,102,241,0.30);
  }

  .campus-theme-light {
    --theme-bg: #f8fafc;
    --theme-bgPanel: #ffffff;
    --theme-bgCard: #f1f5f9;
    --theme-bgCardHover: #e2e8f0;
    --theme-bgInput: #ffffff;
    --theme-border: #e2e8f0;
    --theme-borderLight: #cbd5e1;
    --theme-accent: #7e22ce;
    --theme-accentDim: #6b21a8;
    --theme-accentBg: rgba(126,34,206,0.12);
    --theme-textPrimary: #0f172a;
    --theme-textSecondary: #475569;
    --theme-textMuted: #94a3b8;
    --theme-textWhite: #0f172a;
    --theme-warn: #d97706;
    --theme-warnBg: rgba(245,158,11,0.14);
    --theme-error: #dc2626;
    --theme-blue: #2563eb;
    --theme-purple: #7c3aed;
    --theme-sidebar: #ffffff;
    --theme-topBar: #ffffff;
    --theme-mapBg: #f1f5f9;
    --theme-mapOverlayBg: rgba(255,255,255,0.92);
    --theme-mapTooltipBg: rgba(255,255,255,0.88);
    --theme-mapGridLines: #cbd5e1;
    --theme-mapGridLines2: #94a3b8;
    --theme-mapGridLines3: #64748b;
    --theme-heatGreen: rgba(126,34,206,0.35);
    --theme-heatTeal: rgba(79,70,229,0.30);
  }
`
