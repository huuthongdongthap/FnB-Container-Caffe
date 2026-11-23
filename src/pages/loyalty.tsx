import { useLoyaltyStore } from '@/hooks/stores/use-loyalty-store';
import { useReferralStore } from '@/hooks/stores/use-referral-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { apiFetch } from '@/lib/api-client';
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
import type { Reward, PointsHistoryEntry as _PointsHistoryEntry, LoyaltyPageProps } from './loyalty-types';

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
  const isAuthenticated = !!user;

  useEffect(() => {
    if (isAuthenticated) {
      void store.fetchLoyalty();
      void useReferralStore.getState().fetchReferralData();
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
  const storeReferralCode = useReferralStore((s) => s.referralCode);
  const referralCode = propReferralCode ?? storeReferralCode ?? '';
  const checkinDays = propCheckinDays ?? DEFAULT_CHECKIN;

  /* ── Derived loading state for StitchLoyaltyNew ────────────────── */
  const loadingState: LoyaltyLoadingState = storeLoading
    ? 'loading'
    : storeError
      ? 'error'
      : 'idle';

  /* ── Build dashboard data ──────────────────────────────────────── */
  const formatTierLabel = (name: string) => (name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Bronze');
  const lifetimePoints = propPoints ?? store.lifetimePoints ?? points;
  const hasExplicitProps = propPoints !== undefined || propRewards !== undefined || propHistory !== undefined;
  const activeTierLadder = store.tierLadder.length > 0
    ? store.tierLadder
    : (isAuthenticated || hasExplicitProps ? getDefaultLoyaltyData(t).tierLadder : []);
  const normalizedTier = (tier || 'bronze').toLowerCase();
  const sortedTiers = [...activeTierLadder].sort((a, b) => a.min_points - b.min_points);
  const currentTierIdx = Math.max(
    0,
    sortedTiers.findIndex((item) => item.tier_name.toLowerCase() === normalizedTier),
  );
  const hasHigherTier = sortedTiers.length > 0 && currentTierIdx < sortedTiers.length - 1;
  const nextTierObj = hasHigherTier ? sortedTiers[currentTierIdx + 1] : null;
  const serverNextTier = store.nextTier ?? (
    storeSummary.next_tier && typeof storeSummary.next_tier === 'object'
      ? storeSummary.next_tier
      : null
  );
  const isMaxTier = !serverNextTier && !hasHigherTier && sortedTiers.length > 0;
  const targetPoints =
    (serverNextTier && typeof serverNextTier.min_points === 'number' && serverNextTier.min_points > 0
      ? serverNextTier.min_points
      : nextTierObj && nextTierObj.min_points > 0
        ? nextTierObj.min_points
        : 500);
  const formattedTier = formatTierLabel(tier);
  const resolvedExternalNextTier = serverNextTier
    ? resolveTierString(serverNextTier, '')
    : (typeof storeSummary.next_tier === 'string' ? storeSummary.next_tier : '');
  const nextTierName = isMaxTier
    ? formattedTier
    : resolvedExternalNextTier
      ? formatTierLabel(resolvedExternalNextTier)
      : nextTierObj
        ? formatTierLabel(nextTierObj.tier_name)
        : formattedTier;
  const pointsRemaining = isMaxTier
    ? 0
    : (serverNextTier && 'points_needed' in serverNextTier && typeof serverNextTier.points_needed === 'number'
        ? Math.max(0, serverNextTier.points_needed)
        : Math.max(0, targetPoints - lifetimePoints));
  const progressPct = isMaxTier
    ? 100
    : Math.min(100, Math.round((lifetimePoints / Math.max(1, targetPoints)) * 100));
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
    if (!user?.id && !(user as { phone?: string } | null)?.phone) {
      return;
    }
    try {
      await apiFetch('/api/checkin', {
        method: 'POST',
        body: JSON.stringify({
          ...(user?.id ? { customer_id: user.id } : {}),
          ...((user as { phone?: string } | null)?.phone ? { phone: (user as { phone?: string }).phone } : {}),
          customer_name: user?.name || undefined,
        }),
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

  const userRecord = user as (typeof user & { created_at?: string }) | null;
  const memberSinceYear = userRecord?.created_at
    ? new Date(userRecord.created_at).getFullYear().toString()
    : '';
  const streakCount = streakDays.filter((d) => d.checked).length;

  const handleRedeemPointsScroll = () => {
    if (typeof document !== 'undefined') {
      document.getElementById('loyalty-rewards-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleShareReferral = async () => {
    if (!referralCode) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'AURA CAFE',
          text: `Dùng mã giới thiệu ${referralCode} tại AURA CAFE!`,
        });
        return;
      }
      await navigator.clipboard?.writeText(referralCode);
    } catch {
      // Ignore share cancellation or unavailable clipboard
    }
  };

  const dashboardData: LoyaltyDashboardData = {
    tierName: formattedTier,
    memberSince: memberSinceYear,
    tierDescription: t('loyalty.heroDescription'),
    nextTier: nextTierName,
    pointsRemainingForNextTier: pointsRemaining,
    progressPercent: progressPct,
    pointsBalance: points,
    streakCount,
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
        <StitchLoyaltyNew
          data={dashboardData}
          loadingState={loadingState}
          errorMessage={storeError || t('loyalty.errorDescription')}
          myVouchers={store.myVouchers}
          lastRedeemedVoucher={store.lastRedeemedVoucher}
          onDismissVoucherBanner={store.clearLastRedeemedVoucher}
          onRedeemPoints={handleRedeemPointsScroll}
          onClaimReward={(rewardId) => { void store.redeemReward(rewardId); }}
          onCheckIn={handleCheckIn}
          onShareReferral={handleShareReferral}
        />
      </div>
    </>
  );
}

export default LoyaltyPage;
