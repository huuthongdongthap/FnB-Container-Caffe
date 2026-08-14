/**
 * StitchOrderSuccessNew — Default data, style constants, and utilities
 *
 * Contains glass panel classes, animation keyframes, price formatting,
 * and default location image URL for the AURA CAFE order success screen.
 */

/* ─── Glass panel class (matches original HTML glass-card) ───────────────── */

export const glassPanelClasses =
  'bg-[rgba(21,33,43,0.4)] backdrop-blur-xl border border-[rgba(161,161,170,0.2)]';

/* ─── Default location image ─────────────────────────────────────────────── */

export const DEFAULT_LOCATION_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB90p-HQ3qdJbW1M_x492UqW3HLs03n6XsrLpvu0QVEMyWAfjJXfgdukv-IePi8OLn_Qk9sRXhCB6TWZxQjiHd7x9Q-zKzEv3dC2jWN-rAGGQG1RdY0ZqNz8O3uN0qzYCM0SzE8jsiY0fnJpqyKmnBwU-X8AabgCNah__hRLDyWmhZiERlXaxI9lHVuvx09XcBxXH5agT7CFRnKpMCN0BX-7MEbyZ5crFzbW59kesuIm7l2ve_cVVnwUvWu9O6OVeVE7SMuo6ycupg';

/* ─── Price formatting ───────────────────────────────────────────────────── */

export function formatPrice(
  amount: number,
  localeStr: string,
  currencyType: 'VND' | 'USD',
): string {
  const isVietnamese = localeStr === 'vi' || localeStr.startsWith('vi');
  const cur = currencyType || (isVietnamese ? 'VND' : 'USD');
  return new Intl.NumberFormat(cur === 'VND' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: cur === 'VND' ? 0 : 2,
  }).format(amount);
}

/* ─── Animation Keyframes ────────────────────────────────────────────────── */

export const shineKeyframes = `
@keyframes shine {
  0% { transform: translateX(-100%) translateY(-100%); }
  100% { transform: translateX(100%) translateY(100%); }
}
@keyframes pulse-bronze {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.05); }
}
`;
