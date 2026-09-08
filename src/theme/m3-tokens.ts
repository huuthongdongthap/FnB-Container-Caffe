/**
 * M3 Design Token Layer -- TypeScript constants
 * Mirrors md-sys-* tokens defined in src/styles/brand-tokens.css
 * Usage: import { m3Tokens } from '@/theme/m3-tokens'
 */

export const m3ColorTokens = {
  surface: 'var(--md-sys-color-surface)',
  surfaceDim: 'var(--md-sys-color-surface-dim)',
  surfaceBright: 'var(--md-sys-color-surface-bright)',
  surfaceContainerLowest: 'var(--md-sys-color-surface-container-lowest)',
  surfaceContainerLow: 'var(--md-sys-color-surface-container-low)',
  surfaceContainer: 'var(--md-sys-color-surface-container)',
  surfaceContainerHigh: 'var(--md-sys-color-surface-container-high)',
  surfaceContainerHighest: 'var(--md-sys-color-surface-container-highest)',
  onSurface: 'var(--md-sys-color-on-surface)',
  onSurfaceVariant: 'var(--md-sys-color-on-surface-variant)',
  primary: 'var(--md-sys-color-primary)',
  onPrimary: 'var(--md-sys-color-on-primary)',
  primaryContainer: 'var(--md-sys-color-primary-container)',
  onPrimaryContainer: 'var(--md-sys-color-on-primary-container)',
  secondary: 'var(--md-sys-color-secondary)',
  onSecondary: 'var(--md-sys-color-on-secondary)',
  secondaryContainer: 'var(--md-sys-color-secondary-container)',
  onSecondaryContainer: 'var(--md-sys-color-on-secondary-container)',
  tertiary: 'var(--md-sys-color-tertiary)',
  onTertiary: 'var(--md-sys-color-on-tertiary)',
  tertiaryContainer: 'var(--md-sys-color-tertiary-container)',
  onTertiaryContainer: 'var(--md-sys-color-on-tertiary-container)',
  inverseSurface: 'var(--md-sys-color-inverse-surface)',
  inverseOnSurface: 'var(--md-sys-color-inverse-on-surface)',
  inversePrimary: 'var(--md-sys-color-inverse-primary)',
  outline: 'var(--md-sys-color-outline)',
  outlineVariant: 'var(--md-sys-color-outline-variant)',
  error: 'var(--md-sys-color-error)',
  onError: 'var(--md-sys-color-on-error)',
  errorContainer: 'var(--md-sys-color-error-container)',
  onErrorContainer: 'var(--md-sys-color-on-error-container)',
  scrim: 'var(--md-sys-color-scrim)',
  shadow: 'var(--md-sys-color-shadow)',
} as const;

export const m3ShapeTokens = {
  none: 'var(--md-sys-shape-corner-none)',
  extraSmall: 'var(--md-sys-shape-corner-extra-small)',
  small: 'var(--md-sys-shape-corner-small)',
  medium: 'var(--md-sys-shape-corner-medium)',
  large: 'var(--md-sys-shape-corner-large)',
  extraLarge: 'var(--md-sys-shape-corner-extra-large)',
  full: 'var(--md-sys-shape-corner-full)',
} as const;

export const m3ElevationTokens = {
  level0: 'var(--md-sys-elevation-0)',
  level1: 'var(--md-sys-elevation-1)',
  level2: 'var(--md-sys-elevation-2)',
  level3: 'var(--md-sys-elevation-3)',
  classNameLevel0: 'shadow-none',
  classNameLevel1: 'shadow-md',
  classNameLevel2: 'shadow-lg',
  classNameLevel3: 'shadow-xl',
} as const;

export const m3MotionTokens = {
  durationShort1: '50ms',
  durationShort2: '100ms',
  durationShort3: '150ms',
  durationShort4: '200ms',
  durationMedium1: '250ms',
  durationMedium2: '300ms',
  durationMedium3: '350ms',
  durationMedium4: '400ms',
  durationLong1: '450ms',
  durationLong2: '500ms',
  easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
  easingEmphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  easingEmphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  easingEmphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
} as const;

/** All M3 tokens, keyed by CSS custom property name */
export const m3Tokens = {
  color: m3ColorTokens,
  shape: m3ShapeTokens,
  elevation: m3ElevationTokens,
  motion: m3MotionTokens,
} as const;

export type M3ColorTokens = typeof m3ColorTokens;
export type M3ShapeTokens = typeof m3ShapeTokens;
export type M3ElevationTokens = typeof m3ElevationTokens;
export type M3MotionTokens = typeof m3MotionTokens;
export type M3Tokens = typeof m3Tokens;
