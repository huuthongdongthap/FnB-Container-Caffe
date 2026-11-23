/**
 * StitchAccountDashNew — AURA CAFE Account Dashboard
 *
 * Mobile-first, dark navy theme with glassmorphism cards, bronze gradients,
 * and chrome/silver accents.
 *
 * Source: Stitch AI account dashboard export (new variant).
 */
'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccount } from '@/hooks/use-account';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useLoyaltyStore } from '@/hooks/stores/use-loyalty-store';
import { StitchAccountDashNew } from '@/components/stitch';
import type { DashAccountProfile, DashLoyaltyData, DashOrderItem } from '@/components/stitch';
import { MyVouchersSection } from '@/components/loyalty/MyVouchersSection';

import { getTierProgress, formatTimeAgo, mapOrderItemIcon, mapOrderStatus } from './account-constants';
import { AccountNotLoggedIn } from './account-not-logged-in';
import { AccountLoading } from './account-loading';
import { AccountError } from './account-error';
import { AccountEmpty } from './account-empty';
import { NotificationPreferences } from '@/components/account/notification-preferences';

/* ─── Re-exports for backward compatibility ──────────────────────── */
export { AccountNotLoggedIn } from './account-not-logged-in';
export { AccountLoading } from './account-loading';
export { AccountError } from './account-error';
export { AccountEmpty } from './account-empty';
export {
  TIER_ORDER,
  TIER_POINTS,
  getNextTier,
  getTierProgress,
  formatTimeAgo,
  mapOrderItemIcon,
  mapOrderStatus,
} from './account-constants';

/* ─── Main Component ─────────────────────────────────────────────── */

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const { profile, orders, loading, error, ordersError, refetchProfile } = useAccount();
  const { myVouchers, tierLadder, fetchLoyalty } = useLoyaltyStore();
  const { t } = useTranslation('account');

  useEffect(() => {
    if (user) {
      void fetchLoyalty();
    }
  }, [user, fetchLoyalty]);

  if (!user) return <AccountNotLoggedIn />;
  if (loading) return <AccountLoading />;
  if (error && !profile) return <AccountError error={error} onRetry={refetchProfile} />;

  /* ─── Profile loaded with data ──────────────────────────────────── */
  if (profile) {
    const points = Number(profile.loyalty_points ?? 0);
    const cashbackBalance = Number(profile.cashback_balance ?? 0);
    const lifetimePoints = Number(profile.lifetime_points ?? points);
    const customThresholds = tierLadder.length > 0
      ? Object.fromEntries(tierLadder.map((item) => [item.tier_name.toLowerCase(), item.min_points]))
      : undefined;
    const progress = getTierProgress(profile.loyalty_tier, lifetimePoints, customThresholds);

    const dashProfile: DashAccountProfile = {
      name: profile.name,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=1e3550&color=c6c6c7&size=80`,
      tier: profile.loyalty_tier.charAt(0).toUpperCase() + profile.loyalty_tier.slice(1),
      memberSince: new Date(profile.created_at).getFullYear().toString(),
    };

    const dashLoyalty: DashLoyaltyData = {
      points,
      nextTier: progress.nextTier
        ? progress.nextTier.charAt(0).toUpperCase() + progress.nextTier.slice(1)
        : profile.loyalty_tier.charAt(0).toUpperCase() + profile.loyalty_tier.slice(1),
      pointsToNext: progress.remaining,
      progressPercent: progress.percent,
    };

    const dashOrders: DashOrderItem[] = orders.map((order) => {
      const first = order.items?.[0];
      const productName = first?.name ?? 'Order';

      return {
        id: order.orderNumber || order.id,
        itemName: productName,
        icon: mapOrderItemIcon(productName),
        time: formatTimeAgo(order.createdAt, t),
        status: mapOrderStatus(order.status),
        items: order.items,
      };
    });

    return (
      <>
        <StitchAccountDashNew
          profile={dashProfile}
          loyalty={dashLoyalty}
          orders={dashOrders}
        />
        <div className="max-w-md mx-auto px-4 pb-8 -mt-4 space-y-4">
          <div
            data-testid="account-wallet-summary"
            className="rounded-2xl border border-[#C69C6D]/20 bg-[#1B1714]/80 p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-xs text-[#A89F91]">Điểm tích lũy</p>
              <p className="text-lg font-bold text-[#F5EFE6]" data-testid="account-points-value">
                {points.toLocaleString('vi-VN')} điểm
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#A89F91]">Ví hoàn tiền (VND)</p>
              <p className="text-lg font-bold text-[#C69C6D]" data-testid="account-cashback-value">
                {cashbackBalance.toLocaleString('vi-VN')}₫
              </p>
            </div>
          </div>

          {ordersError && (
            <div
              role="alert"
              data-testid="account-orders-error"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300"
            >
              Không thể tải lịch sử đơn hàng: {ordersError}
            </div>
          )}

          <MyVouchersSection vouchers={myVouchers} compact />

          <NotificationPreferences customerId={user.id} />
        </div>
      </>
    );
  }

  return <AccountEmpty />;
}
