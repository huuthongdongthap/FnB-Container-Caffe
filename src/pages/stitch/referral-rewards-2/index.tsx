import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { REFERRAL_CODE } from './referral-rewards-2-data';
import { TopNav, MobileBottomNav } from './referral-rewards-2-nav';
import { ReferralHero } from './referral-rewards-2-hero';
import { ReferralCodeCard } from './referral-rewards-2-code-card';
import { ProgressTracker } from './referral-rewards-2-progress-card';
import { FriendList } from './referral-rewards-2-friend-list';
import { RewardHistory } from './referral-rewards-2-reward-history';

export default function ReferralRewards2() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(REFERRAL_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  return (
    <StitchShell>
      <TopNav />

      <main className="pt-24 pb-32 px-5 max-w-6xl mx-auto">
        <ReferralHero />

        {/* ── Bento Grid: Code + Progress ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
          <ReferralCodeCard
            referralCode={REFERRAL_CODE}
            copied={copied}
            onCopy={handleCopy}
          />
          <ProgressTracker />
        </div>

        {/* ── Detailed Lists: Friend Network + Reward History ───────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <FriendList />
            <RewardHistory />
          </div>
          <div className="hidden lg:block" />
        </div>
      </main>

      <MobileBottomNav />
    </StitchShell>
  );
}
