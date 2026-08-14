/**
 * Reward history table displaying past referral rewards
 * with date, source, and amount columns.
 */

import { useTranslation } from 'react-i18next';
import { BODY_FONT } from './StitchReferralNew2-constants';
import type { RewardHistoryRow } from './StitchReferralNew2-types';

export function RewardHistory({
  history,
  onDownloadStatement,
}: {
  history: RewardHistoryRow[];
  onDownloadStatement?: () => void;
}) {
  const { t } = useTranslation();

  if (history.length === 0) {
    return (
      <section className="mb-20" aria-label={t('stitch.referral.rewardsTitle')}>
        <h3 className={`mb-4 ${BODY_FONT} text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]`}>
          {t('stitch.referral.rewardsTitle')}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className={`${BODY_FONT} text-base text-[var(--aura-text-secondary, #a0a8b0)]`}>
            {t('stitch.referral.rewardsEmpty')}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mb-20"
      aria-label={t('stitch.referral.rewardsTitle')}
    >
      {/* Header with download link */}
      <div className="mb-6 flex items-center justify-between px-2">
        <h3 className={`${BODY_FONT} text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]`}>
          {t('stitch.referral.rewardsTitle')}
        </h3>
        <button
          type="button"
          onClick={onDownloadStatement}
          className={`${BODY_FONT} text-[10px] font-semibold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)] underline transition-colors hover:text-[#efbd8a]`}
          aria-label={t('stitch.referral.downloadStatementAria')}
        >
          {t('stitch.referral.downloadStatement')}
        </button>
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-xl"
        style={{
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#1e3550]/30">
                <th className={`p-4 ${BODY_FONT} text-xs font-bold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)]`}>
                  {t('stitch.referral.colDate')}
                </th>
                <th className={`p-4 ${BODY_FONT} text-xs font-bold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)]`}>
                  {t('stitch.referral.colSource')}
                </th>
                <th className={`p-4 text-right ${BODY_FONT} text-xs font-bold uppercase tracking-wider text-[var(--aura-text-secondary, #a0a8b0)]`}>
                  {t('stitch.referral.colAmount')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {history.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-white/[0.03]"
                >
                  <td className={`p-4 ${BODY_FONT} text-sm text-[var(--aura-text-secondary, #a0a8b0)]`}>
                    {row.date}
                  </td>
                  <td className={`p-4 ${BODY_FONT} text-sm text-[var(--aura-text-primary, #e8e8e8)]`}>
                    {row.source}
                  </td>
                  <td className={`p-4 text-right ${BODY_FONT} text-sm font-semibold text-[#efbd8a]`}>
                    +${row.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
