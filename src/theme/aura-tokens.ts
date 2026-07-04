export interface ThemeTokens {
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceContainer: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  tertiary: string;
  text: string;
  textMuted: string;
  border: string;
  outline: string;
  error: string;
  fontFamily: {
    display: string;
    body: string;
  };
  spacing: {
    base: number;
    container: number;
    gutter: number;
  };
  rounded: {
    DEFAULT: number;
    lg: number;
    xl: number;
    full: number;
  };
}

export const lightTokens: ThemeTokens = {
  background: '#f8f7f4',
  surface: '#ffffff',
  surfaceVariant: '#eeedea',
  surfaceContainer: '#f2f1ee',
  primary: '#b8c7e2',
  onPrimary: '#1a1a2e',
  secondary: '#4a6fa5',
  tertiary: '#d4a574',
  text: '#1a1a2e',
  textMuted: '#6b7280',
  border: 'rgba(0,0,0,0.08)',
  outline: '#d1d5db',
  error: '#dc2626',
  fontFamily: {
    display: "var(--aura-font-display, 'EB Garamond', Georgia, serif)",
    body: "'Space Grotesk', sans-serif",
  },
  spacing: {
    base: 8,
    container: 1280,
    gutter: 24,
  },
  rounded: {
    DEFAULT: 2,
    lg: 4,
    xl: 8,
    full: 12,
  },
};

export const darkTokens: ThemeTokens = {
  background: '#0A1A2E',
  surface: '#0d1b2a',
  surfaceVariant: '#162a3d',
  surfaceContainer: '#050D1A',
  primary: '#b8c7e2',
  onPrimary: '#1a1a2e',
  secondary: '#4a6fa5',
  tertiary: '#d4a574',
  text: '#e8e8e8',
  textMuted: '#a0a8b0',
  border: 'rgba(255,255,255,0.08)',
  outline: '#2a3f55',
  error: '#ffb4ab',
  fontFamily: {
    display: "var(--aura-font-display, 'EB Garamond', Georgia, serif)",
    body: "'Space Grotesk', sans-serif",
  },
  spacing: {
    base: 8,
    container: 1280,
    gutter: 24,
  },
  rounded: {
    DEFAULT: 2,
    lg: 4,
    xl: 8,
    full: 12,
  },
};
