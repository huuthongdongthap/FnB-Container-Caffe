import type { CSSProperties } from 'react';

export const fontDisplayLg: CSSProperties = {
  fontFamily: "var(--aura-font-display)",
  fontSize: 'var(--aura-fs-h1)',
  lineHeight: 'var(--aura-lh-tight)',
  fontWeight: '700',
  letterSpacing: '-0.02em',
};

export const headlineMd: CSSProperties = {
  fontFamily: "var(--aura-font-display)",
  fontSize: 'var(--aura-fs-h2)',
  lineHeight: '1.2',
  fontWeight: '700',
};

export const timerDisplay: CSSProperties = {
  fontFamily: "var(--aura-font-mono, 'Space Grotesk', sans-serif)",
  fontSize: '40px',
  lineHeight: '1',
  letterSpacing: '-0.05em',
  fontWeight: '700',
};

export const labelCaps: CSSProperties = {
  fontFamily: "var(--aura-font-body)",
  fontSize: 'var(--aura-fs-label-caps)',
  lineHeight: '1',
  letterSpacing: '0.1em',
  fontWeight: '700',
};

export const bodyLg: CSSProperties = {
  fontFamily: "var(--aura-font-body)",
  fontSize: 'var(--aura-fs-body-lg)',
  lineHeight: 'var(--aura-lh-body)',
  fontWeight: '500',
};

export const bodyMd: CSSProperties = {
  fontFamily: "var(--aura-font-body)",
  fontSize: 'var(--aura-fs-body)',
  lineHeight: 'var(--aura-lh-body)',
  fontWeight: '400',
};

export const glassCard: CSSProperties = {
  background: 'rgba(10, 26, 46, 0.6)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
};

export const btnChrome: CSSProperties = {
  background: 'linear-gradient(135deg, #E2E8F0 0%, #94A3B8 50%, #475569 100%)',
  color: '#2c1700',
  boxShadow: '0 4px 0 rgba(0,0,0,0.3)',
  transition: 'all 0.1s ease',
};

export const PULSE_GLOW_KEYFRAMES = `
@keyframes kds-pulse-glow {
  0%, 100% { text-shadow: 0 0 10px rgba(255, 180, 171, 0.2); opacity: 1; }
  50% { text-shadow: 0 0 25px rgba(255, 180, 171, 0.8); opacity: 0.8; }
}
`;

export function buildCustomCSS(): string {
  const glassEntries = Object.entries(glassCard)
    .map(([k, v]) => `${k}:${v};`)
    .join(' ');
  const btnEntries = Object.entries(btnChrome)
    .map(([k, v]) => `${k}:${v};`)
    .join(' ');

  return `
    ${PULSE_GLOW_KEYFRAMES}
    .kds-glass-card { ${glassEntries} }
    .kds-btn-chrome { ${btnEntries} }
    .kds-btn-chrome:active {
      transform: translateY(2px);
      box-shadow: 0 1px 0 rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.2);
    }
    .kds-btn-chrome[data-pressed="true"] {
      transform: scale(0.98) translateY(2px);
      box-shadow: 0 1px 0 rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.2);
    }
    .kds-timer-pulse { animation: kds-pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    .kds-item-completed { text-decoration: line-through; opacity: 0.5; }
    .kds-ticket-ready { opacity: 0.8; }
    .kds-ticket-ready::after {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(173, 200, 245, 0.05);
      pointer-events: none;
    }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #44474d; border-radius: 10px; }
  `;
}
