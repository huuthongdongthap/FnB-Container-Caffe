/**
 * TierLadder — 4-tier loyalty ladder showing all tiers with multipliers and cashback %
 * Displays: Đồng → Bạc → Vàng → Bạch Kim with point_multiplier and cashback_rate
 */
'use client';

import { useTranslation } from 'react-i18next';
import type { LoyaltyTierLadderItem } from './stitch-loyalty-types';

interface TierLadderProps {
  tiers: LoyaltyTierLadderItem[];
}

const TIER_COLORS: Record<string, string> = {
  bronze: 'var(--aura-tier-bronze)',
  silver: 'var(--aura-tier-silver)',
  gold: 'var(--aura-tier-gold)',
  platinum: 'var(--aura-tier-platinum)',
};

const TIER_ICONS: Record<string, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
};

export function TierLadder({ tiers }: TierLadderProps) {
  const { t } = useTranslation();

  if (!tiers || tiers.length === 0) return null;

  return (
    <section className="w-full">
      <h2
        className="text-lg font-semibold mb-4"
        style={{
          color: 'var(--aura-chrome-bright)',
          fontFamily: 'var(--aura-font-display)',
        }}
      >
        {t('loyalty.tierLadderTitle', { defaultValue: 'Hệ thống cấp bậc thành viên' })}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiers.map((tier) => (
          <TierLadderCard key={tier.tier_name} tier={tier} />
        ))}
      </div>
    </section>
  );
}

function TierLadderCard({ tier }: { tier: LoyaltyTierLadderItem }) {
  const { t } = useTranslation();
  const tierColor = TIER_COLORS[tier.tier_name] || 'var(--aura-chrome-mid)';
  const tierIcon = TIER_ICONS[tier.tier_name] || '★';
  const isCurrent = tier.is_current;

  return (
    <div
      className={`relative rounded-xl p-5 transition-all duration-300 ${
        isCurrent
          ? 'ring-2 scale-[1.02] z-10'
          : 'hover:scale-[1.01]'
      }`}
      style={{
        backgroundColor: isCurrent
          ? 'color-mix(in srgb, var(--aura-bg-elevated) 90%, var(--aura-chrome-bright) 10%)'
          : 'var(--aura-bg-elevated)',
        borderColor: isCurrent ? tierColor : 'rgba(161,161,170,0.2)',
        borderWidth: isCurrent ? '2px' : '1px',
        borderStyle: 'solid',
        boxShadow: isCurrent
          ? `0 8px 24px color-mix(in srgb, ${tierColor} 20%, transparent)`
          : '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {/* Current tier badge */}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span
            className="px-3 py-1 text-xs font-bold rounded-full text-white"
            style={{ backgroundColor: tierColor }}
          >
            {t('loyalty.currentTier', { defaultValue: 'Cấp bậc hiện tại' })}
          </span>
        </div>
      )}

      {/* Tier icon & name */}
      <div className="text-center mb-4">
        <div
          className="text-5xl mb-2"
          style={{
            filter: isCurrent ? 'drop-shadow(0 4px 8px currentColor)' : 'none',
            color: tierColor,
          }}
        >
          {tierIcon}
        </div>
        <h3
          className="text-xl font-bold"
          style={{
            color: isCurrent ? tierColor : 'var(--aura-chrome-bright)',
            fontFamily: 'var(--aura-font-display)',
          }}
        >
          {tier.display_name_vi}
        </h3>
        <p className="text-xs text-[var(--aura-text-muted)] mt-1">
          {t('loyalty.tierFromPoints', { defaultValue: 'Từ {points} điểm', points: tier.min_points.toLocaleString('vi-VN') })}
        </p>
      </div>

      {/* Divider */}
      <div
        className="h-px my-4 w-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${tierColor}, transparent)`,
        }}
      />

      {/* Multiplier */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-sm text-[var(--aura-text-body)]">
          {t('loyalty.pointMultiplier', { defaultValue: 'Hệ số điểm' })}
        </span>
        <span
          className="text-lg font-bold"
          style={{ color: tierColor, fontFamily: 'var(--aura-font-display)' }}
        >
          {tier.point_multiplier}x
        </span>
      </div>

      {/* Cashback rate */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-[var(--aura-text-body)]">
          {t('loyalty.cashbackRate', { defaultValue: 'Hoàn tiền' })}
        </span>
        <span
          className="text-lg font-bold"
          style={{ color: tierColor, fontFamily: 'var(--aura-font-display)' }}
        >
          {(tier.cashback_rate * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}