export const TOKENS = {
  colors: {
    black: '#000000',
    white: '#FFFFFF',
    surface: {
      background: '#000000',
      card: '#18181B',
      cardBorder: '#27272A',
      inputBackground: '#09090B',
      inputBorder: '#3F3F46',
      inputBorderFocus: '#FFFFFF',
      danger: '#EF4444',
      dangerBackground: '#1C0A0A',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#A1A1AA',
      muted: '#71717A',
      inverted: '#000000',
      danger: '#F87171',
    },
  },
  typography: {
    fontMono: 'Courier, Menlo, monospace',
    fontSystem: 'System',
  },
  radii: {
    none: 0,
    sm: 2,
  },
} as const;

export type ThemeTokens = typeof TOKENS;
