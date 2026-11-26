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
  const data = externalData;

  if (loadingState === 'loading') return <ReferralSkeleton />;

  if (loadingState === 'error') {
    return (
      <div className="min-h-screen bg-[var(--aura-surface-container)] font-body text-[var(--aura-chrome-bright, #d9e3f6)]">
        <main className="flex min-h-[70vh] items-center justify-center px-5 pt-10 pb-28">
          <ReferralError message={errorMessage} />
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--aura-surface-container)] font-body text-[var(--aura-chrome-bright, #d9e3f6)]">
        <main className="flex min-h-[70vh] items-center justify-center px-5 pt-10 pb-28">
          <ReferralEmpty />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--aura-surface-container)] font-body text-[var(--aura-chrome-bright, #d9e3f6)]" style={{ WebkitFontSmoothing: 'antialiased' }}>
      <main
        className="pt-6 px-5 pb-28 max-w-4xl mx-auto"
        style={{ backgroundImage: 'radial-gradient(rgba(212, 165, 116, 0.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        <HeroEarningsCard rewardAmount={data.rewardAmount} />
        <ReferralCodeBlock
          code={data.referralCode}
          onCopyCode={onCopyCode}
          onShareVia={onShareVia}
        />
        <ProgressTracker current={data.currentReferrals} target={data.targetReferrals} percent={data.progressPercent} />
        <FriendNetwork friends={data.friends} onViewProfile={onViewProfile} />
        <RewardHistory history={data.rewardHistory} />
      </main>
    </div>
  );
}
