/**
 * StitchCheckinNew — Shared constants and CSS
 */

export const glassCardClasses =
  'bg-[rgba(22,32,47,0.6)] backdrop-blur-[12px] border border-[rgba(var(--aura-chrome-light),0.1)] shadow-[inset_0_1px_0_rgba(var(--aura-glass-bg),0.05)]';

export const keyframeStyles = `
  @keyframes aura-pulse-slow {
    0%, 100% { opacity: 0.1; }
    50% { opacity: 0.3; }
  }
  @keyframes aura-scan {
    0% { transform: translateY(0); }
    50% { transform: translateY(180px); }
    100% { transform: translateY(0); }
  }
`;
