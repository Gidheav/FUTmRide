// ─────────────────────────────────────────────────────────────────────────────
// context.tsx — Theme context for FinancialReports
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Theme } from '../types/financial.types';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeCtx = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeCtx);

export const ThemeProvider: React.FC<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  children: ReactNode;
}> = ({ theme, setTheme, children }) => (
  <ThemeCtx.Provider value={{ theme, setTheme }}>
    {children}
  </ThemeCtx.Provider>
);
