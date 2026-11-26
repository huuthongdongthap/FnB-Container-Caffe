/**
 * StitchLoyaltyNew — AURA CAFE Loyalty & Rewards Dashboard
 *
 * Desktop loyalty DASHBOARD (platinum hero + rewards grid + points history +
 * streak + referral block). Sub-components extracted to focused files.
 *
 * NOTE: `stitch-exports/loyalty/design.html` is a DIFFERENT screen variant
 * — a mobile-first loyalty CALCULATOR. Not the source of truth for this component.
 */
'use client';

import { useTranslation } from 'react-i18next';

/* ─── Re-exported types (public API) ──────────────────────────────── */
export type {
  LoyaltyRewardItem,
  LoyaltyHistoryEntry,
  LoyaltyStreakDay,
  LoyaltyTierBenefit,
  LoyaltyTierLadderItem,
  LoyaltyDashboardData,
  LoyaltyLoadingState,
  StitchLoyaltyNewProps,
} from './stitch-loyalty-types';

/* ─── Sub-components ──────────────────────────────────────────────── */
import { ScrollbarStyles } from './loyalty-scrollbar-styles';
import { LoyaltySkeleton } from './loyalty-skeleton';
import { LoyaltyError } from './loyalty-error-state';
import { LoyaltyEmpty } from './loyalty-empty-state';
import { TierCard } from './loyalty-tier-card';
import { RewardsGrid } from './loyalty-rewards-grid';
import { PointsHistorySection } from './loyalty-history-section';
import { WeeklyStreak } from './loyalty-weekly-streak';
import { ReferralBlock } from './loyalty-referral-block';
import { TierBenefits } from './loyalty-tier-benefits';
import { TierLadder } from './loyalty-tier-ladder';
import { LoyaltyFooter } from './loyalty-footer';
import { MyVouchersSection } from '@/components/loyalty/MyVouchersSection';
import { AlertCircle, Gift, ArrowRight } from 'lucide-react';

/* ─── Hooks ───────────────────────────────────────────────────────── */
import { useParallaxGlass } from '@/hooks/use-parallax-glass';

/* ─── Data & Types ────────────────────────────────────────────────── */
import type { LoyaltyDashboardData, StitchLoyaltyNewProps } from './stitch-loyalty-types';
import { getDefaultLoyaltyData } from './loyalty-default-data';

/* ─── Main Component ───────────────────────────────────────────────── */

export function StitchLoyaltyNew({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrorMessage,
  myVouchers = [],
  lastRedeemedVoucher = null,
  onDismissVoucherBanner,
  onRedeemPoints,
  onClaimReward,
  onCheckIn,
  onShareReferral,
  onClaimBirthday,
}: Readonly<StitchLoyaltyNewProps>) {
  const { t } = useTranslation();

  useParallaxGlass();

  const data: LoyaltyDashboardData = externalData ?? getDefaultLoyaltyData(t);
  const resolvedErrorMessage = externalErrorMessage ?? t('loyalty.errorDescription');

  /* ─── Loading State ─────────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <LoyaltySkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: 'var(--aura-surface-dim)' }}>
        <LoyaltyError message={resolvedErrorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────────── */
  if (
    !data ||
    (data.pointsBalance === 0 &&
      data.rewards.length === 0 &&
      data.pointsHistory.length === 0 &&
      (!data.tierLadder || data.tierLadder.length === 0))
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: 'var(--aura-surface-dim)' }}>
        <LoyaltyEmpty />
      </div>
    );
  }

  return (
    <div
      id="stitch-loyalty-scroll"
      className="min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: 'var(--aura-surface-dim)',
        color: 'var(--aura-chrome-bright)',
        fontFamily: "var(--aura-font-body)",
      }}
    >
      <ScrollbarStyles />

      {/* Nocturnal-vibe background gradient */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(circle at 50% -20%, color-mix(in srgb, var(--aura-chrome-bright) 10%, transparent) 0%, transparent 70%)',
        }}
      />

      {/* Non-fixed quick section bar (single top app bar is provided by CustomerShell) */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-[64px] py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <a href="#loyalty-tiers-section" className="text-[var(--aura-chrome-soft)] hover:text-white transition-colors font-medium">
              Hạng thẻ
            </a>
            <a href="#loyalty-wallet-section" className="text-[var(--aura-chrome-soft)] hover:text-white transition-colors font-medium">
              Ví hoàn tiền
            </a>
            <a href="#loyalty-rewards-section" className="text-[var(--aura-chrome-soft)] hover:text-white transition-colors font-medium">
              Đổi quà
            </a>
            <a href="#loyalty-history-section" className="text-[var(--aura-chrome-soft)] hover:text-white transition-colors font-medium">
              Lịch sử giao dịch
            </a>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/loyalty-calculator"
              className="text-[var(--aura-chrome-soft)] hover:text-white transition-colors"
            >
              Tính nhẩm hoàn tiền
            </a>
            <a
              href="/account"
              className="px-3.5 py-1.5 rounded-full border border-[var(--aura-chrome-bright)]/40 text-[var(--aura-chrome-bright)] font-semibold hover:bg-white/10 transition-colors"
            >
              {data.isGuest ? 'Đăng nhập / Tra cứu SĐT' : 'Hồ sơ hội viên'}
            </a>
          </div>
        </div>
      </div>

      {/* ─── Main Content ───────────────────────────────────────────── */}
      <main className="pt-8 pb-24 px-4 sm:px-8 lg:px-[64px] max-w-[1440px] mx-auto grid grid-cols-12 gap-[24px]">
        {/* Left Column: Hero, Wallet & Rewards */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-[36px]">
          {data.isGuest && (
            <section
              data-testid="loyalty-guest-cta"
              className="rounded-2xl border border-[#C69C6D]/40 bg-gradient-to-br from-[#1B2A41] to-[#0A1A2E] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            >
              <div className="space-y-2 max-w-xl">
                <span className="inline-block px-3 py-1 rounded-full bg-[#C69C6D]/20 text-[#C69C6D] text-[11px] font-bold uppercase tracking-widest">
                  Hội viên Ví AURA
                </span>
                <h2 className="text-2xl sm:text-3xl font-semibold text-white" style={{ fontFamily: 'var(--aura-font-display)' }}>
                  Tích điểm &amp; Hoàn tiền 3%–10% mọi hóa đơn
                </h2>
                <p className="text-sm text-[var(--aura-chrome-soft)]">
                  Đăng nhập bằng số điện thoại hoặc email để tra cứu số dư điểm, ví hoàn tiền VND, lịch sử giao dịch và đổi voucher ngay.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full md:w-auto">
                <a
                  href="/account"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--aura-chrome-bright)] text-[#0A1A2E] text-sm font-bold hover:opacity-95 transition-all"
                >
                  <span>Tra cứu / Đăng nhập ngay</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="/menu"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-xl border border-white/20 text-white text-sm font-semibold hover:bg-white/5 transition-all"
                >
                  Đặt món tích điểm
                </a>
              </div>
            </section>
          )}

          {data.birthdayOffer?.eligible && (
            <section
              data-testid="loyalty-birthday-banner"
              className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <Gift className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-200">
                    Chúc mừng sinh nhật! Bạn có ưu đãi giảm {data.birthdayOffer.discountPercent}%
                    {data.birthdayOffer.rewardType === 'free_item_or_discount' ? ' hoặc tặng món sinh nhật' : ''}
                  </p>
                  <p className="text-xs text-amber-100/80 mt-1">
                    {data.birthdayOffer.redeemedMessage || 'Áp dụng 1 lần trong chu kỳ sinh nhật của bạn tại AURA CAFE.'}
                  </p>
                </div>
              </div>
              {onClaimBirthday && !data.birthdayOffer.redeemed && (
                <button
                  type="button"
                  onClick={onClaimBirthday}
                  className="px-4 py-2 rounded-xl bg-amber-300 text-[#0A1A2E] text-xs font-bold shrink-0 hover:bg-amber-200 transition-colors cursor-pointer"
                >
                  Nhận ưu đãi sinh nhật
                </button>
              )}
            </section>
          )}

          {!data.isGuest && <TierCard data={data} onRedeemPoints={onRedeemPoints} />}

          {/* Cashback Wallet Card */}
          {!data.isGuest && (
            <section
              id="loyalty-wallet-section"
              data-testid="loyalty-cashback-wallet-card"
              className="rounded-2xl border border-[#C69C6D]/30 bg-[#1B1714]/70 p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs uppercase tracking-widest text-[#C69C6D] font-bold">
                    Ví Hoàn Tiền AURA (Cashback Wallet)
                  </span>
                  <div className="text-3xl font-bold text-[#F5EFE6] mt-1" data-testid="loyalty-cashback-balance">
                    {(data.cashbackBalance ?? 0).toLocaleString('vi-VN')}₫
                  </div>
                </div>
                <span className="inline-flex self-start sm:self-center px-3.5 py-1.5 rounded-full bg-[#C69C6D]/15 border border-[#C69C6D]/30 text-xs font-semibold text-[#C69C6D]">
                  Tỷ lệ hoàn tiền hạng hiện tại: {data.cashbackRate ?? 3}%
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10 text-xs">
                <div>
                  <span className="text-[#A89F91] block">Tổng hoàn tiền đã nhận</span>
                  <span className="text-sm font-semibold text-[#F5EFE6]">
                    {(data.cashbackTotalEarned ?? 0).toLocaleString('vi-VN')}₫
                  </span>
                </div>
                <div>
                  <span className="text-[#A89F91] block">Tổng đã sử dụng</span>
                  <span className="text-sm font-semibold text-[#F5EFE6]">
                    {(data.cashbackTotalSpent ?? 0).toLocaleString('vi-VN')}₫
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[#A89F91] block">Sắp hết hạn (7 ngày)</span>
                  <span className="text-sm font-semibold text-amber-300" data-testid="loyalty-cashback-expiring">
                    {(data.cashbackExpiring7d ?? 0).toLocaleString('vi-VN')}₫
                  </span>
                </div>
              </div>

              {(data.cashbackExpiring7d ?? 0) > 0 && (
                <div
                  role="alert"
                  data-testid="cashback-expiry-warning"
                  className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 flex items-center justify-between gap-3 text-xs text-amber-200"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-300" />
                    <span>
                      Bạn có <strong>{(data.cashbackExpiring7d ?? 0).toLocaleString('vi-VN')}₫</strong> hoàn tiền sẽ hết hạn trong 7 ngày tới. Hãy dùng ngay khi thanh toán!
                    </span>
                  </div>
                  <a href="/menu" className="font-bold underline shrink-0 text-amber-100">
                    Đặt món ngay
                  </a>
                </div>
              )}
            </section>
          )}

          <div id="loyalty-tiers-section">
            <TierLadder tiers={data.tierLadder} />
          </div>
          {lastRedeemedVoucher && (
            <div
              role="status"
              data-testid="redeemed-voucher-banner"
              className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-emerald-300">
                  Đổi quà thành công: {lastRedeemedVoucher.title}
                </p>
                <p className="text-xs text-[#F5EFE6] mt-1">
                  Mã voucher của bạn:{' '}
                  <span className="font-mono font-bold text-[#C69C6D] select-all">
                    {lastRedeemedVoucher.code}
                  </span>
                </p>
              </div>
              {onDismissVoucherBanner && (
                <button
                  type="button"
                  onClick={onDismissVoucherBanner}
                  className="text-xs text-emerald-300 hover:underline shrink-0"
                >
                  Đóng
                </button>
              )}
            </div>
          )}
          <div id="loyalty-rewards-section">
            <RewardsGrid rewards={data.rewards} onClaimReward={onClaimReward} />
          </div>
          {!data.isGuest && <MyVouchersSection vouchers={myVouchers} />}
          {!data.isGuest && (
            <div id="loyalty-history-section">
              <PointsHistorySection
                history={data.pointsHistory}
                cashbackHistory={data.cashbackHistory}
              />
            </div>
          )}
        </div>

        {/* Right Column: Stats & Social */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-[48px]">
          <WeeklyStreak
            days={data.streakDays}
            streakCount={data.streakCount}
            onCheckIn={onCheckIn}
          />
          <ReferralBlock
            code={data.referralCode}
            onShare={onShareReferral}
          />
          <TierBenefits benefits={data.tierBenefits} />
        </div>
      </main>

      <LoyaltyFooter />
    </div>
  );
}
