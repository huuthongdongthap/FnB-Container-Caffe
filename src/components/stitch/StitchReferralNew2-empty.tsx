/**
 * Error and empty state components for the referral page.
 * Shown when data loading fails or no data is available.
 */

import { useTranslation } from 'react-i18next';
import { AlertCircleIcon, GiftIcon } from './StitchReferralNew2-icons';
import { DISPLAY_FONT } from './StitchReferralNew2-constants';

export function ReferralError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl bg-[var(--aura-bg-surface, #071c33)]/80 p-8 text-center"
      role="alert"
      aria-live="assertive"
    >
      <AlertCircleIcon className="h-12 w-12 text-[#ffb4ab]" />
      <h3 className={`${DISPLAY_FONT} text-xl font-semibold text-[var(--aura-text-primary, #e8e8e8)]`}>
        {t('stitch.referral.errorTitle')}
      </h3>
      <p className="text-[var(--aura-text-secondary, #a0a8b0)]">{message}</p>
    </div>
  );
}

export function ReferralEmpty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl bg-[var(--aura-bg-surface, #071c33)]/80 p-8 text-center"
      role="status"
    >
      <GiftIcon className="h-12 w-12 text-[#5a6270]" />
      <h3 className={`${DISPLAY_FONT} text-xl font-semibold text-[var(--aura-text-primary, #e8e8e8)]`}>
        {t('stitch.referral.emptyTitle')}
      </h3>
      <p className="text-[var(--aura-text-secondary, #a0a8b0)]">{t('stitch.referral.emptyDesc')}</p>
    </div>
  );
}
