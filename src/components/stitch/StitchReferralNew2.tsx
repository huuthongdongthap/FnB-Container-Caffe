/**
 * StitchReferralNew2 — AURA CAFE Referral Rewards (Stitch design, version 2)
 *
 * Dark navy glassmorphism referral page with hero earnings card,
 * referral code input with copy + share buttons, progress tracker to next bonus,
 * member tier display, friend network list, and reward history table.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_referral_rewards_2/code.html export.
 */
'use client';

import { useTranslation } from 'react-i18next';
import type { StitchReferralNew2Props } from './StitchReferralNew2-types';
import { DEFAULT_REFERRAL_DATA } from './StitchReferralNew2-defaults';
import { ReferralSkeleton } from './StitchReferralNew2-skeleton';
import { ReferralError, ReferralEmpty } from './StitchReferralNew2-empty';
import { HeroEarningsCard } from './StitchReferralNew2-hero';
import { ReferralCodeBlock } from './StitchReferralNew2-form';
import { ProgressTracker } from './StitchReferralNew2-steps';
import { FriendNetwork } from './StitchReferralNew2-rewards';
import { RewardHistory } from './StitchReferralNew2-rewards-table';
import { ReferralHeader } from './StitchReferralNew2-header';
import { ReferralFooter } from './StitchReferralNew2-footer';

export function StitchReferralNew2({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrorMsg = '',
  onCopyCode,
  onShareVia,
  onDownloadStatement,
}: Readonly<StitchReferralNew2Props>) {
  const { t } = useTranslation();
  const errorMessage = externalErrorMsg || t('stitch.referral.defaultError');
  const data = externalData ?? DEFAULT_REFERRAL_DATA;

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <ReferralSkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-bg-page, #0A1A2E)] p-5">
        <ReferralError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-bg-page, #0A1A2E)] p-5">
        <ReferralEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] font-body text-[var(--aura-text-primary, #e8e8e8)]"
      style={{
        backgroundImage: 'radial-gradient(rgba(239, 189, 138, 0.04) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <ReferralHeader />

      <main className="mx-auto max-w-[600px] px-5 pt-24 pb-36 md:px-6">
        <HeroEarningsCard rewardAmount={data.rewardAmount} />
        <ReferralCodeBlock
          code={data.referralCode}
          onCopyCode={onCopyCode}
          onShareVia={onShareVia}
        />
        <ProgressTracker
          current={data.currentReferrals}
          target={data.targetReferrals}
          percent={data.progressPercent}
          nextBonusAmount={data.nextBonusAmount}
          nextBonusLabel={data.nextBonusLabel}
        />
        <FriendNetwork friends={data.friends} />
        <RewardHistory history={data.rewardHistory} onDownloadStatement={onDownloadStatement} />
      </main>

      <ReferralFooter />
    </div>
  );
}
