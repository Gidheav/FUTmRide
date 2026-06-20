const LIGHT_COLORS = {
  surfaceContainerLow: "#f3f3f3",
  onTertiary: "#ffffff",
  onPrimaryFixedVariant: "#38006B",
  onPrimary: "#ffffff",
  secondaryFixed: "#ffd6f9",
  primaryFixed: "#E9D5FF",
  primaryContainer: "#7A1FA2",
  inversePrimary: "#D094FF",
  onSurface: "#1a1c1c",
  inverseSurface: "#2f3131",
  outlineVariant: "#bccabb",
  onSecondary: "#ffffff",
  onErrorContainer: "#93000a",
  outline: "#6d7b6d",
  surfaceVariant: "#e2e2e2",
  inverseOnSurface: "#f1f1f1",
  primary: "#5E1284",
  onTertiaryFixedVariant: "#474747",
  onSecondaryFixedVariant: "#79197e",
  surface: "#f9f9f9",
  tertiaryContainer: "#939393",
  background: "#f9f9f9",
  error: "#ba1a1a",
  surfaceContainerLowest: "#ffffff",
  secondaryContainer: "#fc92fb",
  onPrimaryContainer: "#FFFFFF",
  surfaceDim: "#dadada",
  surfaceContainer: "#eeeeee",
  surfaceTint: "#5E1284",
  tertiaryFixedDim: "#c6c6c6",
  errorContainer: "#ffdad6",
  onSecondaryFixed: "#37003b",
  primaryFixedDim: "#D094FF",
  onError: "#ffffff",
  secondaryFixedDim: "#ffa9fb",
  onSurfaceVariant: "#3d4a3e",
  tertiaryFixed: "#e2e2e2",
  surfaceBright: "#f9f9f9",
  secondary: "#953699",
  surfaceContainerHighest: "#e2e2e2",
  onTertiaryFixed: "#1b1b1b",
  onSecondaryContainer: "#7c1c81",
  onBackground: "#1a1c1c",
  surfaceContainerHigh: "#e8e8e8",
  onTertiaryContainer: "#2c2c2c",
  onPrimaryFixed: "#1C0036",
  tertiary: "#5e5e5e"
};

const DARK_COLORS = {
  ...LIGHT_COLORS,
  background: "#121212",
  surface: "#1a1c1c",
  surfaceBright: "#1a1c1c",
  surfaceDim: "#0f0f0f",
  surfaceContainerLowest: "#141414",
  surfaceContainerLow: "#1e1e1e",
  surfaceContainer: "#232323",
  surfaceContainerHigh: "#2a2a2a",
  surfaceContainerHighest: "#303030",
  surfaceVariant: "#2a2a2a",
  onSurface: "#f1f1f1",
  onBackground: "#f1f1f1",
  onSurfaceVariant: "#c8c8c8",
  outline: "#8a8a8a",
  outlineVariant: "#3a3a3a",
  tertiary: "#c1c1c1",
  tertiaryFixedDim: "#4a4a4a",
  onTertiaryFixedVariant: "#c8c8c8",
};

export let COLORS = { ...LIGHT_COLORS };

export const applyThemeMode = (mode: 'system' | 'light' | 'dark') => {
  const target = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  Object.assign(COLORS, target);
};

export const FONTS = {
  titleLg: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  titleMd: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  bodyLg: { fontSize: 18, lineHeight: 28, fontWeight: '400' as const },
  labelLg: { fontSize: 14, lineHeight: 16, letterSpacing: 0.14, fontWeight: '600' as const },
  headlineMd: { fontSize: 20, lineHeight: 28, fontWeight: '700' as const },
  bodyMd: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodySm: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  headlineXl: { fontSize: 32, lineHeight: 40, letterSpacing: -0.64, fontWeight: '800' as const },
  headlineLg: { fontSize: 24, lineHeight: 32, letterSpacing: -0.24, fontWeight: '700' as const },
  labelMd: { fontSize: 12, lineHeight: 14, letterSpacing: 0.24, fontWeight: '600' as const },
};

export const AMBIENT_SHADOW = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};
