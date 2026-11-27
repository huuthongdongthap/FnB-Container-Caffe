import { useLoyaltyStore } from '@/hooks/stores/use-loyalty-store';
import { useReferralStore } from '@/hooks/stores/use-referral-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useEffect, useMemo, useState } from 'react';
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
import { WEEK_DAYS, TIER_BENEFIT_KEYS, REWARD_IMAGES } from './loyalty-constants';
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
  const isAuthenticated = Boolean(user && (!user.role || user.role === 'customer'));

  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [birthdayOffer, setBirthdayOffer] = useState<{
    eligible: boolean;
    discountPercent: number;
    rewardType: string;
    isBirthdayToday?: boolean;
    redeemed?: boolean;
    redeemedMessage?: string | null;
  } | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      void store.fetchLoyalty();
      void useReferralStore.getState().fetchReferralData();
      if (user?.id) {
        apiFetch<{
          success?: boolean;
          data?: {
            eligible?: boolean;
            discount_percent?: number;
            reward_type?: string;
            is_birthday_today?: boolean;
          };
        }>(`/api/loyalty/birthday/check?customer_id=${encodeURIComponent(user.id)}`, { silent: true })
          .then((res) => {
            if (res?.data?.eligible) {
              setBirthdayOffer({
                eligible: true,
                discountPercent: Number(res.data.discount_percent ?? 15),
                rewardType: String(res.data.reward_type ?? 'discount'),
                isBirthdayToday: Boolean(res.data.is_birthday_today),
              });
            } else {
              setBirthdayOffer(null);
            }
          })
          .catch(() => {
            setBirthdayOffer(null);
          });
      }
    } else {
      setBirthdayOffer(null);
      void store.fetchPublicCatalog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

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

  const checkinDays = useMemo<Record<string, boolean>>(() => {
    if (propCheckinDays) return propCheckinDays;
    const derived: Record<string, boolean> = {};
    for (const day of WEEK_DAYS) derived[day] = false;
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
    const now = new Date();
    const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    for (const h of history) {
      if (!/check.?in/i.test(h.reason || '')) continue;
      const ts = Date.parse(h.date || '');
      if (!Number.isFinite(ts) || ts < weekAgo) continue;
      const key = dayKeys[new Date(ts).getDay()];
      if (key && key in derived) derived[key] = true;
    }
    if (checkedInToday) {
      const todayKey = dayKeys[now.getDay()];
      if (todayKey && todayKey in derived) derived[todayKey] = true;
    }
    return derived;
  }, [propCheckinDays, history, checkedInToday]);

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
    : getDefaultLoyaltyData(t).tierLadder;
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

  const DAY_LABELS_FALLBACK: Record<string, string> = {
    MON: 'T2',
    TUE: 'T3',
    WED: 'T4',
    THU: 'T5',
    FRI: 'T6',
    SAT: 'T7',
    SUN: 'CN',
  };
  const streakDays: LoyaltyStreakDay[] = WEEK_DAYS.map((day) => ({
    label: t(`loyalty.days.${day}`, { defaultValue: DAY_LABELS_FALLBACK[day] ?? day }),
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
      setCheckinError('Vui lòng đăng nhập để check-in tích điểm.');
      return;
    }
    setCheckinError(null);
    try {
      const res = await apiFetch<{ success?: boolean; ok?: boolean; error?: string; message?: string }>('/api/checkin', {
        method: 'POST',
        body: JSON.stringify({
          ...(user?.id ? { customer_id: user.id } : {}),
          ...((user as { phone?: string } | null)?.phone ? { phone: (user as { phone?: string }).phone } : {}),
          customer_name: user?.name || undefined,
        }),
      });
      if (res?.success === false || res?.ok === false) {
        setCheckinError(res.error || res.message || 'Check-in thất bại.');
      } else {
        setCheckedInToday(true);
      }
    } catch (err) {
      setCheckinError(err instanceof Error ? err.message : 'Check-in thất bại. Vui lòng thử lại.');
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

  const handleClaimBirthday = async () => {
    if (!user?.id || !birthdayOffer) return;
    try {
      await apiFetch('/api/loyalty/birthday/redeem', {
        method: 'POST',
        body: JSON.stringify({ customer_id: user.id }),
      });
      setBirthdayOffer((prev) =>
        prev
          ? {
              ...prev,
              redeemed: true,
              redeemedMessage: 'Đã ghi nhận ưu đãi sinh nhật! Vui lòng báo nhân viên tại quầy hoặc thanh toán đơn hàng.',
            }
          : null,
      );
    } catch (err) {
      setCheckinError(err instanceof Error ? err.message : 'Không thể nhận ưu đãi sinh nhật lúc này.');
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
    isGuest: !isAuthenticated && !hasExplicitProps,
    cashbackBalance: store.cashbackBalance,
    cashbackRate: store.cashbackRate,
    cashbackTotalEarned: store.cashbackTotalEarned,
    cashbackTotalSpent: store.cashbackTotalSpent,
    cashbackExpiring7d: store.cashbackExpiring7d,
    cashbackHistory: store.cashbackHistory,
    birthdayOffer,
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
        {checkinError && (
          <div role="alert" className="mx-auto max-w-4xl px-4 pt-4">
            <div className="rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-xs text-red-200">
              {checkinError}
            </div>
          </div>
        )}
        <StitchLoyaltyNew
          data={dashboardData}
          loadingState={loadingState}
          errorMessage={storeError || t('loyalty.errorDescription')}
          myVouchers={store.myVouchers}
          lastRedeemedVoucher={store.lastRedeemedVoucher}
          onDismissVoucherBanner={store.clearLastRedeemedVoucher}
          onRedeemPoints={handleRedeemPointsScroll}
          onClaimReward={(rewardId) => {
            if (!isAuthenticated) {
              if (typeof window !== 'undefined') window.location.assign('/account');
              return;
            }
            void store.redeemReward(rewardId);
          }}
          onCheckIn={handleCheckIn}
          onShareReferral={handleShareReferral}
          onClaimBirthday={handleClaimBirthday}
        />
      </div>
    </>
  );
}

export default LoyaltyPage;
