import { useTranslation } from 'react-i18next';
import type { LoyaltyRewardItem } from './stitch-loyalty-types';

export function RewardCard({
  reward,
  onClaim,
}: {
  reward: LoyaltyRewardItem;
  onClaim?: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl transition-all duration-500 hover:border-[var(--aura-chrome-bright)]/40"
      onClick={() => onClaim?.(reward.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClaim?.(reward.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={t('loyalty.claimRewardAria', { title: reward.title, points: reward.pointsCost })}
      data-glass="card"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--aura-bg-high) 40%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="h-40 relative overflow-hidden">
        <img
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          src={reward.imageUrl}
          alt={reward.imageAlt}
          loading="lazy"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(to top, var(--aura-surface-dim) 0%, transparent 100%)' }}
        />
      </div>
      <div className="p-[24px]">
        <h4
          className="mb-1 text-[18px] leading-[1.6] font-normal"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-bright)' }}
        >
          {reward.title}
        </h4>
        <p
          className="mb-4 text-[12px] leading-none font-semibold"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-soft)' }}
        >
          {t('loyalty.pointsLabel', { count: reward.pointsCost })}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClaim?.(reward.id);
          }}
          className="w-full py-2 text-[12px] leading-none font-bold rounded hover:bg-white/[0.05] transition-colors"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            border: '1px solid color-mix(in srgb, var(--aura-chrome-soft) 30%, transparent)',
            color: 'var(--aura-chrome-bright)',
          }}
        >
          {t('loyalty.claimReward')}
        </button>
      </div>
    </div>
  );
}
