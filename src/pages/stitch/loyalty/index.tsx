import { PageHeader, PageFooter, FooterSocialLinks, FooterLegalLinks } from '@/components/stitch/StitchLayout';
import PlatinumCard from './platinum-card';
import AvailableRewards from './available-rewards';
import PointsHistory from './points-history';
import WeeklyStreak from './weekly-streak';
import ReferralSection from './referral-section';
import TierBenefits from './tier-benefits';
import RewardHistoryTable from './reward-history-table';

export default function LoyaltyRewardsDashboard() {
  return (
    <div className="min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
      <PageHeader
        brand="AURA CAFE"
        sticky
        rightContent={
          <span className="w-8 h-8 rounded-full bg-[var(--aura-tertiary)]/20 flex items-center justify-center text-sm">👤</span>
        }
      />

      <main className="max-w-7xl mx-auto px-5 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-6">
            <PlatinumCard />
            <AvailableRewards />
            <PointsHistory />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-4 space-y-6">
            <WeeklyStreak />
            <ReferralSection />
            <TierBenefits />
            <RewardHistoryTable />
          </div>
        </div>
      </main>

      <PageFooter
        brand="AURA CAFE"
        socialLinks={['IG', 'FB', 'TT'].map(s => ({ label: s }))}
        socialSize="sm"
        rows={
          <>
            <FooterSocialLinks links={['IG', 'FB', 'TT'].map(s => ({ label: s }))} size="md" className="justify-center" />
            <FooterLegalLinks links={['Privacy', 'Terms', 'Black Tier', 'Contact']} className="justify-center mt-4" />
            <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] opacity-50 text-center mt-4">© 2024 AURA CAFE. ALL RIGHTS RESERVED.</p>
          </>
        }
      />
    </div>
  );
}
