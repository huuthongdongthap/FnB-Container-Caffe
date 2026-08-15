/**
 * StitchReferralNew1 -- AURA CAFE Referral Rewards (Stitch design, New version)
 *
 * Dark navy glassmorphism referral page with hero earnings card,
 * referral code + copy + share buttons, progress tracker to next tier,
 * friend network list, and reward history table.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_referral_rewards_1/code.html export.
 *
 * Pixel-perfect against original HTML -- every Tailwind class, hex color,
 * spacing unit, font size, and layout structure matches the source.
 */
'use client';

import { useTranslation } from 'react-i18next';

/* ─── Imports ────────────────────────────────────────────────────── */
import type { StitchReferralNew1Props } from './StitchReferralNew1-types';
import { ReferralSkeleton, ReferralError, ReferralEmpty } from './StitchReferralNew1-states';
import { HeroEarningsCard } from './StitchReferralNew1-hero';
import { ReferralCodeBlock } from './StitchReferralNew1-form';
import { ProgressTracker } from './StitchReferralNew1-progress';
import { FriendNetwork } from './StitchReferralNew1-friends';
import { RewardHistory } from './StitchReferralNew1-rewards';
import { ReferralHeader, ReferralBottomNav } from './StitchReferralNew1-layout';
import { DEFAULT_REFERRAL_DATA } from './StitchReferralNew1-defaults';

/* ─── Re-export types for external consumers ─────────────────────── */
export type {
  ReferralFriendEntry,
  RewardHistoryRow,
  ReferralPageData,
  ReferralLoadingState,
  StitchReferralNew1Props,
} from './StitchReferralNew1-types';

/* ─── Main Component ─────────────────────────────────────────────── */

export function StitchReferralNew1({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrorMsg = '',
  onCopyCode,
  onShareVia,
  onViewProfile,
}: Readonly<StitchReferralNew1Props>) {
  const { t } = useTranslation();

  const errorMessage = externalErrorMsg || t('stitch.referral.defaultError', { defaultValue: 'Failed to load referral data.' });
  const data = externalData ?? DEFAULT_REFERRAL_DATA;

  if (loadingState === 'loading') return <ReferralSkeleton />;

  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-surface-container)] px-5">
        <ReferralError message={errorMessage} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-surface-container)] px-5">
        <ReferralEmpty />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--aura-surface-container)] font-body text-[#d9e3f6]" style={{ WebkitFontSmoothing: 'antialiased' }}>
      <ReferralHeader />

      <main
        className="pt-20 px-5 pb-32"
        style={{ backgroundImage: 'radial-gradient(rgba(212, 165, 116, 0.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        <HeroEarningsCard rewardAmount={data.rewardAmount} />
        <ReferralCodeBlock code={data.referralCode} onCopyCode={onCopyCode} />
        <ProgressTracker current={data.currentReferrals} target={data.targetReferrals} percent={data.progressPercent} />
        <FriendNetwork friends={data.friends} onViewProfile={onViewProfile} />
        <RewardHistory history={data.rewardHistory} />
      </main>

      <ReferralBottomNav />
    </div>
  );
}
