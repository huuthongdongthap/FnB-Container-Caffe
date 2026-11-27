/**
 * StitchAccountDashNew — AURA CAFE Account Dashboard
 *
 * Mobile-first, dark navy theme with glassmorphism cards, bronze gradients,
 * and chrome/silver accents.
 *
 * Source: Stitch AI account dashboard export (new variant).
 */
'use client';

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccount } from '@/hooks/use-account';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useLoyaltyStore } from '@/hooks/stores/use-loyalty-store';
import { apiFetch } from '@/lib/api-client';
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
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { profile, orders, loading, error, ordersError, refetchProfile } = useAccount();
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveMsg, setProfileSaveMsg] = useState<string | null>(null);
  const {
    myVouchers,
    tierLadder,
    cashbackBalance: storeCashbackBalance,
    cashbackRate,
    cashbackExpiring7d,
    fetchLoyalty,
  } = useLoyaltyStore();
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
    const cashbackBalance = Math.max(Number(profile.cashback_balance ?? 0), Number(storeCashbackBalance ?? 0));
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
        <div className="max-w-[1280px] mx-auto px-5 pb-24 -mt-20 space-y-4">
          <div
            data-testid="account-wallet-summary"
            className="rounded-2xl border border-[#C69C6D]/20 bg-[#1B1714]/80 p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-[#A89F91]">Điểm tích lũy</p>
                <p className="text-lg font-bold text-[#F5EFE6]" data-testid="account-points-value">
                  {points.toLocaleString('vi-VN')} điểm
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#A89F91]">Ví hoàn tiền (Hoàn {cashbackRate}%)</p>
                <p className="text-lg font-bold text-[#C69C6D]" data-testid="account-cashback-value">
                  {cashbackBalance.toLocaleString('vi-VN')}₫
                </p>
              </div>
            </div>

            {cashbackExpiring7d > 0 && (
              <div
                role="alert"
                data-testid="account-cashback-expiring-banner"
                className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
              >
                Có {cashbackExpiring7d.toLocaleString('vi-VN')}₫ hoàn tiền sắp hết hạn trong 7 ngày tới.
              </div>
            )}

            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <Link
                to="/loyalty"
                data-testid="account-view-loyalty-link"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C69C6D] hover:underline"
              >
                Xem lịch sử điểm, hoàn tiền &amp; đổi quà →
              </Link>
              <Link
                to="/loyalty-calculator"
                className="text-xs text-[#A89F91] hover:text-[#F5EFE6]"
              >
                Tính nhẩm hoàn tiền
              </Link>
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

          {/* Account Profile Edit & Logout */}
          <div className="rounded-2xl border border-white/10 bg-[#1B1714]/80 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#F5EFE6]">Quản lý tài khoản</p>
                <p className="text-xs text-[#A89F91]">{profile.email || user.email || ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="account-edit-profile-btn"
                  onClick={() => {
                    setEditName(profile.name || user.name || '');
                    setEditPhone(profile.phone || user.phone || '');
                    setProfileSaveMsg(null);
                    setEditingProfile((v) => !v);
                  }}
                  className="px-4 py-2 rounded-xl border border-white/15 hover:border-white/30 text-xs font-semibold text-[#F5EFE6] transition-colors"
                >
                  {editingProfile ? 'Đóng' : 'Chỉnh sửa hồ sơ'}
                </button>
                <button
                  type="button"
                  data-testid="account-logout-btn"
                  onClick={async () => {
                    await logout();
                    navigate('/login');
                  }}
                  className="px-4 py-2 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold text-rose-200 transition-colors"
                >
                  Đăng xuất
                </button>
              </div>
            </div>

            {editingProfile && (
              <form
                data-testid="account-edit-profile-form"
                className="pt-3 border-t border-white/10 space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSavingProfile(true);
                  setProfileSaveMsg(null);
                  try {
                    await apiFetch('/api/auth/me', {
                      method: 'PATCH',
                      body: JSON.stringify({
                        name: editName.trim(),
                        phone: editPhone.trim() || undefined,
                      }),
                    });
                    await refetchProfile();
                    setProfileSaveMsg('Đã cập nhật hồ sơ thành công.');
                    setEditingProfile(false);
                  } catch (err) {
                    setProfileSaveMsg(err instanceof Error ? err.message : 'Không thể cập nhật hồ sơ');
                  } finally {
                    setSavingProfile(false);
                  }
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="account-edit-name" className="block text-xs text-[#A89F91] mb-1">
                      Họ và tên
                    </label>
                    <input
                      id="account-edit-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-[#F5EFE6] focus:outline-none focus:border-[#C69C6D]"
                    />
                  </div>
                  <div>
                    <label htmlFor="account-edit-phone" className="block text-xs text-[#A89F91] mb-1">
                      Số điện thoại
                    </label>
                    <input
                      id="account-edit-phone"
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-[#F5EFE6] focus:outline-none focus:border-[#C69C6D]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-2 rounded-xl bg-[#C69C6D] text-[#0A1A2E] text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </form>
            )}

            {profileSaveMsg && (
              <p className="text-xs text-emerald-300" role="status">
                {profileSaveMsg}
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  return <AccountEmpty />;
}
