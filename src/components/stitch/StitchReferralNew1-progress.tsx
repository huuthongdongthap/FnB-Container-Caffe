'use client';

import { useTranslation } from 'react-i18next';

export function ProgressTracker({
  current,
  target,
  percent,
}: {
  current: number;
  target: number;
  percent: number;
}) {
  const { t } = useTranslation();
  return (
    <section className="mb-10" aria-label={t('stitch.referral.progressAria')}>
      <div className="flex justify-between items-end mb-3">
        <div>
          <h3 className="font-display text-[24px] leading-[1.2] font-medium text-[var(--aura-chrome-bright)]">
            {t('stitch.referral.progressTitle', { defaultValue: 'Path to Platinum' })}
          </h3>
          <p className="font-body text-[12px] leading-[1.2] font-medium text-[var(--aura-chrome-soft)] opacity-60">
            {t('stitch.referral.progressDesc', { defaultValue: 'Unlock $50 exclusive bonus' })}
          </p>
        </div>
        <div className="text-right">
          <span className="font-display text-[24px] leading-[1.2] font-medium text-[var(--aura-chrome-bright)]">
            {current}/{target}
          </span>
          <p className="font-body text-[12px] leading-[1.2] font-medium text-[var(--aura-chrome-soft)] opacity-60 uppercase">
            {t('stitch.referral.referrals', { defaultValue: 'Referrals' })}
          </p>
        </div>
      </div>

      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(180deg, var(--aura-chrome-bright) 0%, var(--aura-chrome-bright) 100%)',
            boxShadow: '0 0 20px color-mix(in srgb, var(--aura-chrome-bright) 15%, transparent)',
          }}
        />
      </div>

      <div className="flex justify-between mt-1 px-1">
        {Array.from({ length: target }).map((_, i) => {
          const isHighlighted = i === 3;
          return (
            <span
              key={i}
              className="w-1 h-1 rounded-full"
              style={{
                backgroundColor: isHighlighted ? 'var(--aura-chrome-bright)' : 'rgba(255,255,255,0.2)',
                boxShadow: isHighlighted ? '0 0 8px var(--aura-chrome-bright)' : 'none',
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
