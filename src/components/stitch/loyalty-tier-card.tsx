import { useTranslation } from 'react-i18next';
import type { LoyaltyDashboardData } from './stitch-loyalty-types';

export function TierCard({
  data,
  onRedeemPoints,
}: {
  data: LoyaltyDashboardData;
  onRedeemPoints?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section
      className="relative overflow-hidden rounded-xl p-[24px] flex flex-col md:flex-row justify-between items-end md:items-stretch gap-[24px]"
      aria-label={t('loyalty.tierCardAria', { tierName: data.tierName })}
      data-glass="platinum"
      style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--aura-chrome-bright) 15%, transparent) 0%, color-mix(in srgb, var(--aura-surface-dim) 40%, transparent) 100%)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 30%, transparent)',
        boxShadow: '0 0 20px color-mix(in srgb, var(--aura-chrome-bright) 20%, transparent)',
      }}
    >
      {/* Brushed-alum texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/brushed-alum.png")',
        }}
      />

      {/* Left: tier info + progress */}
      <div className="flex flex-col justify-between flex-1">
        <div>
          <div
            className="inline-block px-3 py-1 border border-[var(--aura-chrome-bright)]/40 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase mb-[12px]"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--aura-chrome-bright) 20%, transparent)',
              color: 'var(--aura-chrome-bright)',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {t('loyalty.tierBadge', { tierName: data.tierName })}
          </div>
          <h2
            className="mb-2 text-[48px] leading-[1.1] tracking-[-0.02em] font-normal"
            style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--aura-chrome-bright)' }}
          >
            {t('loyalty.memberSince', { year: data.memberSince })}
          </h2>
          <p
            className="max-w-xl text-[16px] leading-[1.5] font-normal opacity-80"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: 'var(--aura-chrome-soft)',
            }}
          >
            {data.tierDescription}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mt-[48px]">
          <div className="flex justify-between items-end mb-2">
            <span
              className="text-[12px] leading-none font-semibold uppercase tracking-[0.1em]"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-soft)' }}
            >
              {t('loyalty.nextLevel', { tierName: data.nextTier })}
            </span>
            <span
              className="text-[12px] leading-none font-semibold"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-bright)' }}
            >
              {t('loyalty.ptsRemaining', { count: data.pointsRemainingForNextTier })}
            </span>
          </div>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--aura-surface-container)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${data.progressPercent}%`,
                background: 'linear-gradient(90deg, color-mix(in srgb, var(--aura-chrome-bright) 100%, black 40%) 0%, var(--aura-chrome-bright) 50%, color-mix(in srgb, var(--aura-chrome-bright) 100%, white 40%) 100%)',
                boxShadow: '0 0 20px color-mix(in srgb, var(--aura-chrome-bright) 20%, transparent)',
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Right: points balance */}
      <div className="flex flex-col items-end justify-between text-right min-w-[200px]">
        <span
          className="text-[12px] leading-none tracking-widest font-semibold uppercase"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-soft)' }}
        >
          {t('loyalty.balance')}
        </span>
        <div>
          <div
            className="text-[72px] leading-none font-light"
            style={{
              fontFamily: "var(--aura-font-display, 'EB Garamond', serif)",
              color: 'var(--aura-chrome-bright)',
            }}
          >
            {data.pointsBalance.toLocaleString()}
          </div>
          <div
            className="text-[12px] leading-none tracking-tighter font-semibold"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-bright)' }}
          >
            {t('loyalty.premiumRewardPoints')}
          </div>
        </div>
        <button
          type="button"
          onClick={onRedeemPoints}
          className="mt-[24px] w-full py-3 font-bold rounded-lg active:scale-95 transition-transform"
          style={{
            backgroundColor: 'var(--aura-chrome-bright)',
            color: 'var(--aura-noir-deep)',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '16px',
            lineHeight: '1.5',
          }}
          aria-label={t('loyalty.redeemPointsAria', { balance: data.pointsBalance.toLocaleString() })}
        >
          {t('loyalty.redeemPoints')}
        </button>
      </div>
    </section>
  );
}
