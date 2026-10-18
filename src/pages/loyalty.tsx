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
import { getDefaultLoyaltyData } from '@/components/stitch/loyalty-default-data';
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
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => (s as { token?: string | null }).token);
  const isAuthenticated = !!user;

  useEffect(() => {
    if (isAuthenticated) {
      store.fetchLoyalty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const resolveTierString = (val: unknown, fallback = 'bronze'): string => {
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (
      val &&
      typeof val === 'object' &&
      'tier_name' in val &&
      typeof (val as { tier_name?: unknown }).tier_name === 'string'
    ) {
      return (val as { tier_name: string }).tier_name;
    }
    return fallback;
  };

  /* ── Data (props override store) ─────────────────────────────── */
  const storeSummary = store as unknown as {
    total_points?: number;
    next_tier?: string | { tier_name?: string; min_points?: number } | null;
  };
  const points = propPoints ?? storeSummary.total_points ?? store.points ?? 0;
  const tier = resolveTierString(propTier ?? store.tier, 'bronze');
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
  const formatTierLabel = (name: string) => (name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Bronze');
  const activeTierLadder = store.tierLadder.length > 0
    ? store.tierLadder
    : getDefaultLoyaltyData(t).tierLadder;
  const normalizedTier = (tier || 'bronze').toLowerCase();
  const sortedTiers = [...activeTierLadder].sort((a, b) => a.min_points - b.min_points);
  const currentTierIdx = Math.max(
    0,
    sortedTiers.findIndex((item) => item.tier_name.toLowerCase() === normalizedTier),
  );
  const nextTierObj = sortedTiers[currentTierIdx + 1] ?? sortedTiers[sortedTiers.length - 1];
  const externalNextTierMinPoints =
    storeSummary.next_tier &&
    typeof storeSummary.next_tier === 'object' &&
    typeof storeSummary.next_tier.min_points === 'number'
      ? storeSummary.next_tier.min_points
      : undefined;
  const targetPoints =
    externalNextTierMinPoints ??
    (nextTierObj && nextTierObj.min_points > 0 ? nextTierObj.min_points : 500);
  const formattedTier = formatTierLabel(tier);
  const resolvedExternalNextTier = storeSummary.next_tier
    ? resolveTierString(storeSummary.next_tier, '')
    : '';
  const nextTierName = resolvedExternalNextTier
    ? formatTierLabel(resolvedExternalNextTier)
    : currentTierIdx < sortedTiers.length - 1 && nextTierObj
      ? formatTierLabel(nextTierObj.tier_name)
      : 'Platinum';
  const pointsRemaining = Math.max(0, targetPoints - points);
  const progressPct = Math.min(100, Math.round((points / targetPoints) * 100));
  const resolvedTierLadder = sortedTiers.map((item) => ({
    ...item,
    is_current: item.tier_name.toLowerCase() === normalizedTier,
  }));

  const streakDays: LoyaltyStreakDay[] = WEEK_DAYS.map((day) => ({
    label: t(`loyalty.days.${day}`),
    checked: checkinDays[day] ?? false,
  }));

  const mappedRewards: LoyaltyRewardItem[] = rewards.map((r, idx) => {
    const rawReward = r as Reward & {
      title?: string;
      pointsCost?: number;
      points_cost?: number;
      points_required?: number;
    };
    const title = rawReward.name || rawReward.title || '';
    return {
      id: rawReward.id,
      title,
      pointsCost:
        rawReward.cost ??
        rawReward.pointsCost ??
        rawReward.points_cost ??
        rawReward.points_required ??
        0,
      imageUrl: REWARD_IMAGES[idx % REWARD_IMAGES.length] ?? '',
      imageAlt: title,
    };
  });

  const handleCheckIn = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const activeToken = token ?? (useAuthStore.getState() as { token?: string | null }).token;
      if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`;
      }
      await fetch('/api/checkin', {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } catch {
      // Non-fatal: refresh loyalty state afterward
    }
    if (isAuthenticated) {
      await store.fetchLoyalty();
    }
  };

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
    nextTier: nextTierName,
    pointsRemainingForNextTier: pointsRemaining,
    progressPercent: progressPct,
    pointsBalance: points,
    streakCount: 12,
    referralCode: referralCode,
    rewards: mappedRewards,
    pointsHistory: mappedHistory,
    streakDays: streakDays,
    tierBenefits: tierBenefits,
    tierLadder: resolvedTierLadder,
  };

  return (
    <>
      <HelmetHead
        title="Loyalty Program — AURA CAFE"
        description="AURA CAFE loyalty program with tiers, points and rewards. Chuong trinh khach hang than thiet voi hang, diem va qua tang."
      />
      <div
        className="min-h-screen overflow-x-hidden bg-background text-foreground"
        style={{
          fontFamily: "var(--aura-font-body)",
        }}
      >
        <LoyaltyHeader />
        <StitchLoyaltyNew
          data={dashboardData}
          loadingState={loadingState}
          errorMessage={storeError || t('loyalty.errorDescription')}
          onClaimReward={(rewardId) => store.redeemReward(rewardId)}
          onCheckIn={handleCheckIn}
        />
      </div>
    </>
  );
}

export default LoyaltyPage;
