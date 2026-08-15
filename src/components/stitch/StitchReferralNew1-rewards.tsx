'use client';

import { useTranslation } from 'react-i18next';
import type { RewardHistoryRow } from './StitchReferralNew1-types';

export function RewardHistory({
  history,
}: {
  history: RewardHistoryRow[];
}) {
  const { t } = useTranslation();

  if (history.length === 0) {
    return (
      <section className="mb-16" aria-label={t('stitch.referral.rewardsTitle')}>
        <h3 className="font-body text-[14px] leading-[1.2] font-semibold tracking-[0.05em] text-[var(--aura-chrome-soft)] uppercase tracking-widest mb-6 border-l-2 border-[var(--aura-chrome-bright)] pl-3">
          {t('stitch.referral.rewardsTitle', { defaultValue: 'Reward History' })}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="font-body text-base text-[var(--aura-chrome-soft)]">
            {t('stitch.referral.rewardsEmpty', { defaultValue: 'No rewards yet.' })}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-16" aria-label={t('stitch.referral.rewardsTitle')}>
      <h3 className="font-body text-[14px] leading-[1.2] font-semibold tracking-[0.05em] text-[var(--aura-chrome-soft)] uppercase tracking-widest mb-6 border-l-2 border-[var(--aura-chrome-bright)] pl-3">
        {t('stitch.referral.rewardsTitle', { defaultValue: 'Reward History' })}
      </h3>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: '1px solid transparent',
          background: 'linear-gradient(color-mix(in srgb, var(--aura-surface-container) 50%, transparent), color-mix(in srgb, var(--aura-surface-container) 50%, transparent)) padding-box, linear-gradient(135deg, #E5E7EB 0%, rgba(229, 231, 235, 0.2) 100%) border-box',
        }}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/[0.1]">
              <th className="p-6 font-body text-[12px] leading-[1.2] font-medium uppercase tracking-wider text-[var(--aura-chrome-soft)] opacity-60">
                {t('stitch.referral.colDate', { defaultValue: 'Date' })}
              </th>
              <th className="p-6 font-body text-[12px] leading-[1.2] font-medium uppercase tracking-wider text-[var(--aura-chrome-soft)] opacity-60">
                {t('stitch.referral.colSource', { defaultValue: 'Source' })}
              </th>
              <th className="p-6 text-right font-body text-[12px] leading-[1.2] font-medium uppercase tracking-wider text-[var(--aura-chrome-soft)] opacity-60">
                {t('stitch.referral.colAmount', { defaultValue: 'Amount' })}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {history.map((row) => (
              <tr key={row.id} className="hover:bg-white/5 transition-colors">
                <td className="p-6 font-body text-base leading-[1.5] text-[var(--aura-chrome-soft)]">
                  {row.date}
                </td>
                <td className="p-6 font-body text-base leading-[1.5] text-[#d9e3f6]">
                  {row.source}
                </td>
                <td className="p-6 text-right font-body text-base leading-[1.5] font-medium text-[var(--aura-chrome-bright)]">
                  +${row.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
