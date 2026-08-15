/* Performance section constants and display data */

export const VITAL_DISPLAY_NAMES: Record<string, string> = {
  CLS: 'Cumulative Layout Shift',
  FCP: 'First Contentful Paint',
  LCP: 'Largest Contentful Paint',
  INP: 'Interaction to Next Paint',
  TTFB: 'Time to First Byte',
};

export const VITAL_TARGETS: Record<string, { good: string; poor: string }> = {
  CLS: { good: '< 0.1', poor: '>= 0.25' },
  FCP: { good: '< 1.8s', poor: '>= 3.0s' },
  LCP: { good: '< 2.5s', poor: '>= 4.0s' },
  INP: { good: '< 200ms', poor: '>= 500ms' },
  TTFB: { good: '< 800ms', poor: '>= 1.8s' },
};
