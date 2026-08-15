import { useLoyaltyStore } from '@/hooks/stores/use-loyalty-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import {
  StitchLoyaltyNew,
  type LoyaltyDashboardData,
  type LoyaltyRewardItem,
  type LoyaltyHistoryEntry,
  type LoyaltyStreakDay,
  type LoyaltyTierBenefit,
  type LoyaltyLoadingState,
} from '@/components/stitch/StitchLoyaltyNew';
import { WEEK_DAYS, TIER_BENEFIT_KEYS, DEFAULT_CHECKIN, REWARD_IMAGES } from './loyalty-constants';
import { LoyaltyHeader } from './loyalty-header';
import type { Reward, PointsHistoryEntry, LoyaltyPageProps } from './loyalty-types';

/* ── Re-exports for backward compatibility ──────────────────────── */
export type { Reward, PointsHistoryEntry, LoyaltyPageProps } from './loyalty-types';
export { WEEK_DAYS, TIER_BENEFIT_KEYS, DEFAULT_CHECKIN, REWARD_IMAGES } from './loyalty-constants';
export { LoyaltyHeader } from './loyalty-header';

export function LoyaltyPage({
  points: propPoints,
  tier: propTier,
  rewards: propRewards,
  history: propHistory,
  referralCode: propReferralCode,
  checkinDays: propCheckinDays,
}: Readonly<LoyaltyPageProps> = {}) {
  const { t } = useTranslation();
  const store = useLoyaltyStore();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = !!token;

  useEffect(() => {
    if (isAuthenticated) {
      store.fetchLoyalty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  /* ── Data (props override store) ─────────────────────────────── */
  const points = propPoints ?? store.points;
  const tier = propTier ?? store.tier;
  const rewards = propRewards ?? store.rewards;
  const history = propHistory ?? store.history;
  const storeError = store.error;
  const storeLoading = store.loading;
  const referralCode = propReferralCode ?? 'AURA-PLAT-882';
  const checkinDays = propCheckinDays ?? DEFAULT_CHECKIN;

  /* ── Derived loading state for StitchLoyaltyNew ────────────────── */
  const loadingState: LoyaltyLoadingState = storeLoading
    ? 'loading'
    : storeError
      ? 'error'
      : 'idle';

  /* ── Build dashboard data ──────────────────────────────────────── */
  const TOTAL_POINTS = 15000;
  const progressPct = Math.min(100, Math.round((points / TOTAL_POINTS) * 100));
  const formattedTier = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'Bronze';

  const streakDays: LoyaltyStreakDay[] = WEEK_DAYS.map((day) => ({
    label: t(`loyalty.days.${day}`),
    checked: checkinDays[day] ?? false,
  }));

  const mappedRewards: LoyaltyRewardItem[] = rewards.map((r, idx) => ({
    id: r.id,
    title: r.name,
    pointsCost: r.cost,
    imageUrl: REWARD_IMAGES[idx % REWARD_IMAGES.length] ?? '',
    imageAlt: r.name,
  }));

  const mappedHistory: LoyaltyHistoryEntry[] = history.map((h) => ({
    id: h.id,
    activity: h.reason,
    date: h.date,
    status: 'completed' as const,
    points: h.points,
  }));

  const tierBenefits: LoyaltyTierBenefit[] = TIER_BENEFIT_KEYS.map((key) => ({
    label: t(`loyalty.${key}`),
  }));

  const dashboardData: LoyaltyDashboardData = {
    tierName: formattedTier,
    memberSince: '2022',
    tierDescription: t('loyalty.heroDescription'),
    nextTier: 'Black Tier',
    pointsRemainingForNextTier: TOTAL_POINTS - points,
    progressPercent: progressPct,
    pointsBalance: points,
    streakCount: 12,
    referralCode: referralCode,
    rewards: mappedRewards,
    pointsHistory: mappedHistory,
    streakDays: streakDays,
    tierBenefits: tierBenefits,
  };

  return (
    <>
      <HelmetHead
        title="Loyalty Program — AURA CAFE"
        description="AURA CAFE loyalty program with tiers, points and rewards. Chuong trinh khach hang than thiet voi hang, diem va qua tang."
      />
      <div
        className="min-h-screen overflow-x-hidden"
        style={{
          backgroundColor: '#051424',
          color: '#d5e4fa',
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <LoyaltyHeader />
        <StitchLoyaltyNew
          data={dashboardData}
          loadingState={loadingState}
          errorMessage={storeError || t('loyalty.errorDescription')}
          onClaimReward={(rewardId) => store.redeemReward(rewardId)}
        />
      </div>
    </>
  );
}
