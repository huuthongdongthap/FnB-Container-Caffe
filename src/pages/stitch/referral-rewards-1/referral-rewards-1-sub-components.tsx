/* ── Sub-components for Referral Rewards 1 ─────────────────────────────── */

import { AVATAR_COLORS } from './referral-rewards-1-constants';

export function Avatar({ name }: { name: string }) {
  const initial = name.split(' ').map((n) => n[0]).join('').slice(0, 2);
  const bg = AVATAR_COLORS[name] ?? '#6B7280';

  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-semibold text-[var(--aura-chrome-bright)] overflow-hidden border border-white/5"
      style={{ background: bg }}
    >
      {initial}
    </div>
  );
}

export function StatusBadge({ status }: { status: 'active' | 'joined' }) {
  const isActive = status === 'active';

  return (
    <span
      className="font-body text-xs py-1 px-3 rounded-full"
      style={{
        background: isActive ? 'rgba(212, 165, 116, 0.1)' : 'rgba(255,255,255,0.05)',
        color: isActive ? 'var(--aura-tertiary)' : 'var(--aura-chrome-dark)',
        border: `1px solid ${isActive ? 'rgba(212, 165, 116, 0.2)' : 'rgba(255,255,255,0.1)'}`,
        boxShadow: isActive ? '0 0 20px rgba(212, 165, 116, 0.15)' : 'none',
      }}
    >
      {isActive ? 'Active' : 'Joined'}
    </span>
  );
}
