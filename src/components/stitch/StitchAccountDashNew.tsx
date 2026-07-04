/**
 * StitchAccountDashNew — AURA CAFE Customer Account Dashboard (dashboard variant)
 *
 * Mobile-first, dark navy theme with glassmorphism cards, bronze gradients,
 * and chrome/silver accents. Includes membership card.
 * Source: stitch-exports/stitch_aura_cafe/aura_cafe_customer_account_dashboard/code.html
 */
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  User,
  Coffee,
  CreditCard,
  Menu,
  Clock,
  RefreshCw,
  UtensilsCrossed,
  CupSoda,
  IceCream,
  Medal,
  ReceiptText,
  Calendar,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface DashAccountProfile {
  name: string;
  avatar: string;
  tier: string;
  memberSince: string;
}

export interface DashLoyaltyData {
  points: number;
  nextTier: string;
  pointsToNext: number;
  progressPercent: number;
}

export interface DashOrderItem {
  id: string;
  itemName: string;
  icon: 'coffee' | 'bakery' | 'icecream' | 'cupSoda';
  time: string;
  status: 'preparing' | 'delivered';
}

export interface StitchAccountDashNewProps {
  profile?: DashAccountProfile;
  loyalty?: DashLoyaltyData;
  orders?: DashOrderItem[];
}

/* ─── Icons ─────────────────────────────────────────────────────────── */

const iconMap: Record<DashOrderItem['icon'], React.ReactNode> = {
  coffee: <Coffee className="w-5 h-5 text-[#d4a574]" />,
  bakery: <UtensilsCrossed className="w-5 h-5 text-[#d4a574]" />,
  icecream: <IceCream className="w-5 h-5 text-[#d4a574]" />,
  cupSoda: <CupSoda className="w-5 h-5 text-[#d4a574]" />,
};

/* ─── Status Badge ─────────────────────────────────────────────────── */

function OrderDashStatusBadge({ status }: { status: DashOrderItem['status'] }) {
  const { t } = useTranslation();
  const config = {
    preparing: {
      label: t('stitch.accountDashboard.statusPreparing'),
      class:
        'bg-[rgba(212,165,116,0.1)] text-[#d4a574] border-[rgba(212,165,116,0.2)]',
    },
    delivered: {
      label: t('stitch.accountDashboard.statusDelivered'),
      class:
        'bg-[rgba(198,198,199,0.08)] text-[var(--aura-primary, #c6c6c7)] border-[rgba(198,198,199,0.15)]',
    },
  };
  const c = config[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase border whitespace-nowrap',
        c.class,
      )}
    >
      {status === 'preparing' && <Clock className="w-3 h-3" />}
      {c.label}
    </span>
  );
}

/* ─── Loading Skeleton ──────────────────────────────────────────────── */

function DashSkeleton() {
  return (
    <div
      className="min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] animate-pulse"
      aria-label="Loading account dashboard"
    >
      <div className="px-5 pt-24 pb-32 max-w-lg mx-auto space-y-6">
        {/* App bar skeleton */}
        <div className="flex items-center justify-between h-16 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#1e3550]" />
          <div className="w-28 h-5 rounded bg-[#1e3550]" />
          <div className="w-10 h-10 rounded-full bg-[#1e3550]" />
        </div>
        {/* Profile card skeleton */}
        <div className="rounded-xl p-6 bg-[rgba(255,255,255,0.03)] backdrop-blur-xl border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-[#1e3550]" />
            <div className="space-y-2">
              <div className="w-32 h-5 rounded bg-[#1e3550]" />
              <div className="w-20 h-3 rounded bg-[#1e3550]" />
            </div>
          </div>
        </div>
        {/* Loyalty skeleton */}
        <div className="rounded-xl p-6 bg-[rgba(255,255,255,0.03)] backdrop-blur-xl border border-white/10">
          <div className="w-full h-2 rounded-full bg-[#1e3550]" />
        </div>
        {/* Quick order skeleton */}
        <div className="h-14 rounded-xl bg-[#1e3550]" />
        {/* Orders skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg p-4 bg-[rgba(255,255,255,0.03)] backdrop-blur-xl border border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#1e3550]" />
                <div className="space-y-2 flex-1">
                  <div className="w-36 h-4 rounded bg-[#1e3550]" />
                  <div className="w-24 h-3 rounded bg-[#1e3550]" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Membership card skeleton */}
        <div className="w-full aspect-[1.6/1] rounded-2xl bg-[#1e3550]" />
      </div>
    </div>
  );
}

/* ─── Error State ───────────────────────────────────────────────────── */

function DashError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <RefreshCw className="w-7 h-7 text-[#d4a574]" />
        </div>
        <h2
          className="text-xl font-semibold mb-2 font-display"
          style={{ color: 'var(--aura-text-primary, #e8e8e8)' }}
        >
          {t('stitch.accountDashboard.failedToLoad')}
        </h2>
        <p className="text-sm mb-6 text-[var(--aura-text-secondary, #a0a8b0)]">
          {t('stitch.accountDashboard.errorDescription')}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-6 py-3 rounded-xl font-semibold text-sm tracking-wider uppercase transition-all active:scale-95 min-h-[48px] bg-gradient-to-br from-[#CD7F32] to-[#A0522D] text-[#1a1a2e]"
            aria-label={t('stitch.accountDashboard.retry')}
          >
            {t('stitch.accountDashboard.retry')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Bottom Navigation Item ────────────────────────────────────────── */

function DashBottomNavItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={clsx(
        'flex flex-col items-center justify-center gap-1 transition-all active:scale-90 min-w-[48px] min-h-[48px] rounded-full px-4 py-1',
        active
          ? 'text-[#ffb779] bg-[rgba(255,183,121,0.1)] font-bold'
          : 'text-[var(--aura-text-secondary,#a0a8b0)] hover:text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-white/5',
      )}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
    >
      {icon}
      <span className="text-[10px] font-bold tracking-wider uppercase">{label}</span>
    </button>
  );
}

/* ─── Defaults ──────────────────────────────────────────────────────── */

const defaultProfile: DashAccountProfile = {
  name: 'Julian Vane',
  avatar:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDjVgK1lkoKR0DuW8esKw0a2oRC-Fz_3evlAv6W1nahj6KkgttV-rJlrEvLN5KS3ksSDY5a3ELKu6G3REmcyRyyu6TGGXEsazdYI7OJMuLtalRqPUcq90xJe3pnN_sc__Z4hRt2hgz-5ofqbqlvfGogGreZRtSuZJ9Iv8mRFpZYG_CMBYjSHBA4w837Fqs39sFHpfKTfK0HIY2ckhrFOVQSKe3a8rDVyEPLlLKn30cEytzJCrGX9hkYE-uJI-xfZxCvnKfXoxgH4lI',
  tier: 'Gold',
  memberSince: '2022',
};

const defaultLoyalty: DashLoyaltyData = {
  points: 1250,
  nextTier: 'Platinum',
  pointsToNext: 250,
  progressPercent: 80,
};

const defaultOrders: DashOrderItem[] = [
  {
    id: '1',
    itemName: 'Truffle Cortado',
    icon: 'coffee',
    time: 'Today, 08:45 AM',
    status: 'preparing',
  },
  {
    id: '2',
    itemName: 'Gold Leaf Croissant',
    icon: 'bakery',
    time: 'Yesterday, 09:12 AM',
    status: 'delivered',
  },
  {
    id: '3',
    itemName: 'Iced Obsidian Brew',
    icon: 'icecream',
    time: 'Oct 24, 02:30 PM',
    status: 'delivered',
  },
];

/* ─── Main Component ────────────────────────────────────────────────── */

export function StitchAccountDashNew({
  profile: profileProp,
  loyalty: loyaltyProp,
  orders: ordersProp,
}: Readonly<StitchAccountDashNewProps>) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = profileProp ?? defaultProfile;
  const loyalty = loyaltyProp ?? defaultLoyalty;
  const orders = ordersProp ?? defaultOrders;

  if (loading) return <DashSkeleton />;

  if (error) {
    return (
      <DashError
        onRetry={() => {
          setError(null);
          setLoading(true);
          setTimeout(() => setLoading(false), 1000);
        }}
      />
    );
  }

  return (
    <div
      className="relative min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] text-[var(--aura-text-primary, #e8e8e8)] overflow-x-hidden"
      aria-label={t('stitch.accountDashboard.pageAriaLabel') || 'Account Dashboard'}
    >
      {/* ═══════════════ Top App Bar ═══════════════ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-5 border-b border-white/10 bg-[var(--aura-bg-page, #0A1A2E)]/80 backdrop-blur-xl"
        aria-label={t('stitch.accountDashboard.appBarAriaLabel') || 'App bar'}
      >
        <button
          type="button"
          className="flex items-center justify-center w-10 h-10 text-[var(--aura-primary, #c6c6c7)] hover:opacity-80 active:scale-90 transition-all"
          aria-label={t('stitch.accountDashboard.openMenu')}
        >
          <Menu className="w-6 h-6" />
        </button>

        <h1 className="font-display text-[clamp(1.25rem,4vw,1.75rem)] tracking-tighter text-[var(--aura-primary, #c6c6c7)] font-bold">
          AURA CAFE
        </h1>

        <div
          className="w-10 h-10 rounded-full overflow-hidden border border-white/10"
        >
          <img
            className="w-full h-full object-cover"
            src={profile.avatar}
            alt={t('stitch.accountDashboard.avatarAlt', { name: profile.name })}
            loading="lazy"
          />
        </div>
      </header>

      {/* ═══════════════ Main Content ═══════════════ */}
      <main className="pt-24 pb-36 px-5 max-w-lg mx-auto w-full space-y-6">

        {/* ─── Profile Section ─── */}
        <section
          className="relative rounded-xl p-6 overflow-hidden bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(205,127,50,0.3)]"
          aria-label={t('stitch.accountDashboard.profileSectionAriaLabel') || 'Profile'}
        >
          {/* Decorative glow */}
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none opacity-20"
            style={{
              background: 'radial-gradient(circle, rgba(212,165,116,0.15), transparent 70%)',
              transform: 'translate(20%, -20%)',
            }}
            aria-hidden="true"
          />

          <div className="flex items-center gap-5 relative z-10">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full overflow-hidden border-2"
                style={{ borderColor: 'rgba(255,183,121,0.3)' }}
              >
                <img
                  className="w-full h-full object-cover"
                  src={profile.avatar}
                  alt={t('stitch.accountDashboard.avatarAlt', { name: profile.name })}
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest bg-gradient-to-br from-[#CD7F32] to-[#A0522D] text-[#1a1a2e]">
                {profile.tier}
              </div>
            </div>
            <div>
              <h2
                className="text-[clamp(1.1rem,3vw,1.5rem)] font-semibold"
                style={{ fontFamily: 'var(--aura-font-display-serif, EB Garamond, Georgia, serif)' }}
              >
                {profile.name}
              </h2>
              <p className="text-[10px] font-bold tracking-widest uppercase mt-1 text-[#d4a574]">
                {t('stitch.accountDashboard.tierMember', { tier: profile.tier })}
              </p>
            </div>
          </div>
        </section>

        {/* ─── Loyalty Progress ─── */}
        <section
          className="rounded-xl p-6 bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10 space-y-4"
          aria-label={t('stitch.accountDashboard.loyaltySectionAriaLabel') || 'Loyalty progress'}
        >
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-1 text-[var(--aura-text-secondary, #a0a8b0)]">
                {t('stitch.accountDashboard.currentBalance')}
              </p>
              <span
                className="text-[clamp(1.75rem,5vw,2.5rem)] font-semibold leading-none"
                style={{ fontFamily: 'var(--aura-font-display-serif, EB Garamond, Georgia, serif)', color: 'var(--aura-primary, #c6c6c7)' }}
              >
                {loyalty.points.toLocaleString()}
                <span className="text-base font-normal text-[var(--aura-text-secondary, #a0a8b0)] opacity-60 ml-1">
                  {t('stitch.accountDashboard.pts')}
                </span>
              </span>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold tracking-widest uppercase mb-1 text-[var(--aura-text-secondary, #a0a8b0)]">
                {t('stitch.accountDashboard.nextTier', { tier: loyalty.nextTier })}
              </p>
              <p className="text-sm text-[#ffb779]">
                {loyalty.pointsToNext.toLocaleString()} {t('stitch.accountDashboard.pts')} {t('stitch.accountDashboard.pointsToGo')}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-[#2a3548] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#CD7F32] to-[#A0522D]"
              style={{
                width: `${loyalty.progressPercent}%`,
                transition: 'width 0.6s cubic-bezier(0.2, 0, 0, 1)',
              }}
            />
          </div>

          <div className="flex justify-between text-[9px] font-bold tracking-[0.2em] uppercase text-[var(--aura-text-secondary, #a0a8b0)]/50">
            <span>{profile.tier}</span>
            <span>{loyalty.nextTier}</span>
          </div>
        </section>

        {/* ─── Quick Order Button ─── */}
        <section>
          <button
            type="button"
            className="w-full h-16 rounded-xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform group bg-gradient-to-br from-[#CD7F32] to-[#A0522D]"
            aria-label={t('stitch.accountDashboard.quickOrder')}
          >
            <Coffee className="w-6 h-6 text-[#1a1a2e] group-hover:rotate-12 transition-transform" />
            <span className="text-base font-bold tracking-widest uppercase text-[#1a1a2e]">
              {t('stitch.accountDashboard.quickOrder')}
            </span>
          </button>
        </section>

        {/* ─── Recent Transactions ─── */}
        <section aria-label={t('stitch.accountDashboard.recentTransactions')}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold tracking-[0.15em] uppercase text-[var(--aura-text-primary, #e8e8e8)]">
              {t('stitch.accountDashboard.recentTransactions')}
            </h3>
            <button
              type="button"
              className="text-[11px] font-bold tracking-wider uppercase text-[var(--aura-primary, #c6c6c7)] border-b border-[var(--aura-primary, #c6c6c7)]/30 pb-0.5 hover:opacity-80 transition-opacity"
              aria-label={t('stitch.accountDashboard.viewAll')}
            >
              {t('stitch.accountDashboard.viewAll')}
            </button>
          </div>

          {orders.length === 0 ? (
            /* Empty state */
            <div className="rounded-xl p-8 text-center bg-[rgba(255,255,255,0.03)] backdrop-blur-xl border border-white/10">
              <Coffee className="w-10 h-10 mx-auto mb-3 text-[rgba(198,198,199,0.2)]" />
              <p className="text-sm font-medium mb-1 text-[var(--aura-text-primary, #e8e8e8)]">
                {t('stitch.accountDashboard.noTransactionsYet')}
              </p>
              <p className="text-xs text-[var(--aura-text-secondary, #a0a8b0)]">
                {t('stitch.accountDashboard.noTransactionsDesc')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-[rgba(148,163,184,0.3)] active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center border border-white/5 bg-[#1f2a3c]">
                      {iconMap[order.icon]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--aura-text-primary, #e8e8e8)]">
                        {order.itemName}
                      </p>
                      <p className="text-[10px] text-[var(--aura-text-secondary, #a0a8b0)] mt-0.5">
                        {order.time}
                      </p>
                    </div>
                  </div>
                  <OrderDashStatusBadge status={order.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Membership Card ─── */}
        <section className="pt-2">
          <div
            className="relative w-full aspect-[1.6/1] rounded-2xl overflow-hidden border border-white/10 group"
            aria-label={t('stitch.accountDashboard.memberSince', { year: profile.memberSince })}
          >
            {/* Card background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#2a3548] to-[var(--aura-bg-surface, #071c33)]" />

            {/* Texture overlay */}
            <div
              className="absolute inset-0 opacity-40 mix-blend-overlay bg-cover bg-center"
              style={{
                backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuD0ldGu_qcqMXjXQnmt1JmIllxnBsu6SKMlLfZRY9Xt87lWvWROEWcoqzwB3AvNRVR96MEQ89_PvOwhogedyMW8J1lDYtOTw4L1jIQ5o-GPoc0_EYHIHOi4sLwZ6Rs-6Jlw-XMJlgtS1WxInAUVI55oekXIPhc9vn-Ve4XUVEMbs_SseLo0FTvkEEBrjKkb6P5J-Ca3A-OSIadHROpyLWsXlmgtWXOe7nSH_rkhenHjGFhXF7NY4JVWyBbA_iZt8DHDQoZ2FeTtygo")',
              }}
              aria-hidden="true"
            />

            {/* Card content */}
            <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-xl sm:text-2xl font-bold tracking-widest bg-gradient-to-b from-white to-[#94A3B8] bg-clip-text text-transparent">
                  AURA
                </span>
                <CreditCard className="w-7 h-7 text-[#ffb779]/60" />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs tracking-[0.3em] font-bold text-[#ffb779]">
                  {profile.name.toUpperCase()}
                </p>
                <p className="text-[10px] tracking-wider text-[var(--aura-text-secondary, #a0a8b0)]/40">
                  {t('stitch.accountDashboard.memberSince', { year: profile.memberSince })}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ═══════════════ Bottom Navigation ═══════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-4 h-20 bg-[var(--aura-bg-page, #0A1A2E)]/90 backdrop-blur-2xl border-t border-white/10"
        aria-label={t('stitch.accountDashboard.navAriaLabel') || 'Main navigation'}
      >
        <DashBottomNavItem
          icon={<Calendar className="w-5 h-5" />}
          label={t('stitch.accountDashboard.navReserve')}
        />
        <DashBottomNavItem
          icon={<ReceiptText className="w-5 h-5" />}
          label={t('stitch.accountDashboard.navOrders')}
        />
        <DashBottomNavItem
          icon={<Medal className="w-5 h-5" />}
          label={t('stitch.accountDashboard.navLoyalty')}
        />
        <DashBottomNavItem
          icon={<User className="w-5 h-5" />}
          label={t('stitch.accountDashboard.navAccount')}
          active
        />
      </nav>

      {/* ═══════════════ Floating Atmosphere Elements ═══════════════ */}
      <div
        className="fixed top-20 left-10 w-40 h-40 rounded-full pointer-events-none opacity-50 blur-[80px]"
        style={{
          background: 'radial-gradient(circle, rgba(184,199,226,0.05), transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div
        className="fixed bottom-40 right-0 w-60 h-60 rounded-full pointer-events-none opacity-50 blur-[100px]"
        style={{
          background: 'radial-gradient(circle, rgba(212,165,116,0.05), transparent 70%)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
