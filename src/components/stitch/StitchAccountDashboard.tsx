/**
 * StitchAccountDashboard — AURA CAFE Account Dashboard (Stitch v2 design)
 *
 * Mobile-first customer dashboard with profile card, order history,
 * loyalty points, subscription section, and bronze/chrome accents.
 * Source: Stitch AI account dashboard export.
 */
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  User,
  Coffee,
  UtensilsCrossed,
  IceCream,
  CupSoda,
  Trophy,
  Medal,
  CreditCard,
  ChevronRight,
  Menu,
  LogOut,
  Calendar,
  Clock,
  Gift,
  Star,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────── */
export interface AccountProfile {
  name: string;
  avatar: string;
  tier: 'Bronze' | 'Gold' | 'Platinum';
  memberSince: string;
}

export interface LoyaltyData {
  points: number;
  nextTier: string;
  pointsToNext: number;
  progressPercent: number;
}

export interface TransactionData {
  id: string;
  itemName: string;
  icon: 'coffee' | 'bakery' | 'icecream' | 'cupSoda';
  time: string;
  status: 'preparing' | 'delivered';
  amount: number;
}

export interface SubscriptionInfo {
  plan: string;
  nextBilling: string;
  active: boolean;
}

export interface StitchAccountDashboardProps {
  profile?: AccountProfile;
  loyalty?: LoyaltyData;
  transactions?: TransactionData[];
  subscription?: SubscriptionInfo;
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function TransactionIcon({ icon }: { icon: TransactionData['icon'] }) {
  const className = 'w-5 h-5';
  switch (icon) {
    case 'coffee': return <Coffee className={className} />;
    case 'bakery': return <UtensilsCrossed className={className} />;
    case 'icecream': return <IceCream className={className} />;
    case 'cupSoda': return <CupSoda className={className} />;
  }
}

function OrderStatusBadge({ status }: { status: TransactionData['status'] }) {
  const { t } = useTranslation();
  const config = {
    preparing: {
      label: t('stitch.accountDashboard.statusPreparing'),
      class: 'bg-[rgba(212,165,116,0.1)] text-[#d4a574] border-[rgba(212,165,116,0.2)]',
    },
    delivered: {
      label: t('stitch.accountDashboard.statusDelivered'),
      class: 'bg-[rgba(198,198,199,0.08)] text-[#c6c6c7] border-[rgba(198,198,199,0.15)]',
    },
  };
  const c = config[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase border',
        c.class,
      )}
    >
      {status === 'preparing' && <Clock className="w-3 h-3 mr-1" />}
      {c.label}
    </span>
  );
}

/* ─── Loading Skeleton ────────────────────────────────────────────── */
function DashboardSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-bg-void)' }}>
      <div className="animate-pulse space-y-6 px-5 pt-24 pb-32">
        {/* AppBar skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
          <div className="w-28 h-5 rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
          <div className="w-10 h-10 rounded-full" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
        </div>
        {/* Profile card skeleton */}
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--aura-bg-surface)' }}>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
            <div className="space-y-2">
              <div className="w-32 h-5 rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
              <div className="w-20 h-3 rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
            </div>
          </div>
        </div>
        {/* Loyalty skeleton */}
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--aura-bg-surface)' }}>
          <div className="w-full h-3 rounded-full" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
        </div>
        {/* Quick order skeleton */}
        <div className="h-16 rounded-xl" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
        {/* Transactions skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg p-4" style={{ backgroundColor: 'var(--aura-bg-surface)' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
                <div className="space-y-2 flex-1">
                  <div className="w-36 h-4 rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
                  <div className="w-24 h-3 rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ────────────────────────────────────────────────── */
function DashboardError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ backgroundColor: 'var(--aura-bg-void)' }}
    >
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'var(--aura-bg-surface)' }}
        >
          <RefreshCw className="w-7 h-7" style={{ color: 'var(--aura-tertiary)' }} />
        </div>
        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--aura-text-primary)', fontFamily: 'var(--aura-font-display)' }}
        >
          {t('stitch.accountDashboard.failedToLoad')}
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: 'var(--aura-text-secondary)' }}
        >
          {t('stitch.accountDashboard.errorDescription')}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-6 py-3 rounded-xl font-semibold text-sm tracking-wider uppercase transition-all active:scale-95"
            style={{
              backgroundColor: 'var(--aura-primary)',
              color: 'var(--aura-on-primary)',
              minHeight: 'var(--aura-touch-target)',
            }}
          >
            {t('stitch.accountDashboard.retry')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function StitchAccountDashboard(props: Readonly<StitchAccountDashboardProps>) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ─── Internal Default Data ─────────────────────────────────────── */
  const defaultProfile: AccountProfile = {
    name: 'Julian Vane',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDjVgK1lkoKR0DuW8esKw0a2oRC-Fz_3evlAv6W1nahj6KkgttV-rJlrEvLN5KS3ksSDY5a3ELKu6G3REmcyRyyu6TGGXEsazdYI7OJMuLtalRqPUcq90xJe3pnN_sc__Z4hRt2hgz-5ofqbqlvfGogGreZRtSuZJ9Iv8mRFpZYG_CMBYjSHBA4w837Fqs39sFHpfKTfK0HIY2ckhrFOVQSKe3a8rDVyEPLlLKn30cEytzJCrGX9hkYE-uJI-xfZxCvnKfXoxgH4lI',
    tier: 'Gold',
    memberSince: '2022',
  };

  const defaultLoyalty: LoyaltyData = {
    points: 1250,
    nextTier: 'Platinum',
    pointsToNext: 250,
    progressPercent: 80,
  };

  const defaultTransactions: TransactionData[] = [
    { id: '1', itemName: 'Truffle Cortado', icon: 'coffee', time: 'Today, 08:45 AM', status: 'preparing', amount: 85000 },
    { id: '2', itemName: 'Gold Leaf Croissant', icon: 'bakery', time: 'Yesterday, 09:12 AM', status: 'delivered', amount: 65000 },
    { id: '3', itemName: 'Iced Obsidian Brew', icon: 'coffee', time: 'Oct 24, 02:30 PM', status: 'delivered', amount: 55000 },
    { id: '4', itemName: 'Smoked Salmon Toast', icon: 'bakery', time: 'Oct 22, 10:00 AM', status: 'delivered', amount: 95000 },
  ];

  const defaultSubscription: SubscriptionInfo = {
    plan: 'Gold Tier',
    nextBilling: 'Aug 1, 2026',
    active: true,
  };

  const profile = props.profile ?? defaultProfile;
  const loyalty = props.loyalty ?? defaultLoyalty;
  const transactions = props.transactions ?? defaultTransactions;
  const subscription = props.subscription ?? defaultSubscription;

  // Loading state
  if (loading) return <DashboardSkeleton />;

  // Error state
  if (error) return <DashboardError onRetry={() => { setError(null); setLoading(true); setTimeout(() => setLoading(false), 1000); }} />;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--aura-bg-void)', color: 'var(--aura-text-primary)' }}
    >
      {/* ═══════════════ Top App Bar ═══════════════ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-5 border-b"
        style={{
          backgroundColor: 'var(--aura-bg-page)',
          borderColor: 'var(--aura-glass-border)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <button
          type="button"
          className="flex items-center justify-center transition-opacity hover:opacity-80 active:scale-90"
          style={{ width: 'var(--aura-touch-target)', height: 'var(--aura-touch-target)' }}
          aria-label={t('stitch.accountDashboard.openMenu')}
        >
          <Menu className="w-6 h-6" style={{ color: 'var(--aura-primary)' }} />
        </button>

        <h1
          className="text-2xl font-bold tracking-tighter"
          style={{ fontFamily: 'var(--aura-font-display)', color: 'var(--aura-primary)' }}
        >
          AURA CAFE
        </h1>

        <div
          className="w-10 h-10 rounded-full overflow-hidden"
          style={{ border: '1px solid var(--aura-glass-border)' }}
        >
          <img
            className="w-full h-full object-cover"
            src={profile.avatar}
            alt={t('stitch.accountDashboard.avatarAlt', { name: profile.name })}
          />
        </div>
      </header>

      {/* ═══════════════ Main Content ═══════════════ */}
      <main className="flex-1 pt-24 pb-36 px-5 max-w-lg mx-auto w-full space-y-6">

        {/* ─── Profile Header ─── */}
        <section
          className="dash-card p-6 relative overflow-hidden"
          style={{
            boxShadow: 'inset 0 1px 0 0 rgba(205,127,50,0.3)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full overflow-hidden"
                style={{ border: '2px solid var(--aura-tertiary)' }}
              >
                <img
                  className="w-full h-full object-cover"
                  src={profile.avatar}
                  alt={profile.name}
                />
              </div>
              <div
                className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest"
                style={{
                  backgroundColor: 'var(--aura-tertiary)',
                  color: 'var(--aura-on-tertiary)',
                }}
              >
                {profile.tier}
              </div>
            </div>
            <div>
              <h2
                className="text-xl font-semibold"
                style={{ fontFamily: 'var(--aura-font-display)', color: 'var(--aura-text-primary)' }}
              >
                {profile.name}
              </h2>
              <p
                className="text-[10px] font-bold tracking-widest uppercase mt-0.5"
                style={{ color: 'var(--aura-tertiary)' }}
              >
                {t('stitch.accountDashboard.tierMember', { tier: profile.tier })}
              </p>
            </div>
          </div>

          {/* Abstract decorative glow */}
          <div
            className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none rounded-full"
            style={{
              background: 'radial-gradient(circle at 50% 50%, var(--aura-tertiary), transparent 70%)',
              transform: 'translate(20%, -20%)',
            }}
          />
        </section>

        {/* ─── Loyalty Section ─── */}
        <section className="dash-card p-6 space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p
                className="text-[10px] font-bold tracking-widest uppercase mb-1"
                style={{ color: 'var(--aura-text-secondary)' }}
              >
                {t('stitch.accountDashboard.currentBalance')}
              </p>
              <p
                className="text-3xl font-semibold leading-none"
                style={{ fontFamily: 'var(--aura-font-display)', color: 'var(--aura-primary)' }}
              >
                {loyalty.points.toLocaleString()}
                <span className="text-base opacity-60 ml-1" style={{ color: 'var(--aura-text-secondary)' }}>
                  {t('stitch.accountDashboard.pts')}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p
                className="text-[10px] font-bold tracking-widest uppercase mb-1"
                style={{ color: 'var(--aura-text-secondary)' }}
              >
                {t('stitch.accountDashboard.nextTier', { tier: loyalty.nextTier })}
              </p>
              <p
                className="text-sm"
                style={{ color: 'var(--aura-tertiary)' }}
              >
                {t('stitch.accountDashboard.pointsToGo', { count: loyalty.pointsToNext })}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--aura-bg-high)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${loyalty.progressPercent}%`,
                background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
                transition: 'width 0.6s var(--aura-easing-emphasized)',
              }}
            />
          </div>

          <div
            className="flex justify-between text-[9px] font-bold tracking-[0.2em] uppercase"
            style={{ color: 'var(--aura-text-disabled)' }}
          >
            <span>{profile.tier}</span>
            <span>{loyalty.nextTier}</span>
          </div>
        </section>

        {/* ─── Quick Order Button ─── */}
        <section>
          <button
            type="button"
            className="w-full h-16 rounded-xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform group"
            style={{
              background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
              minHeight: 'var(--aura-touch-target)',
            }}
          >
            <Coffee className="w-6 h-6 transition-transform group-hover:rotate-12" style={{ color: 'var(--aura-on-tertiary)' }} />
            <span
              className="text-lg font-bold tracking-wider uppercase"
              style={{ fontFamily: 'var(--aura-font-body)', color: 'var(--aura-on-tertiary)' }}
            >
              {t('stitch.accountDashboard.quickOrder')}
            </span>
          </button>
        </section>

        {/* ─── Subscription Section ─── */}
        <section className="dash-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--aura-bg-high)' }}
              >
                <Star
                  className="w-5 h-5"
                  style={{ color: 'var(--aura-tertiary)', fill: 'var(--aura-tertiary)' }}
                />
              </div>
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: 'var(--aura-text-primary)' }}
                >
                  {subscription.plan}
                </p>
                <p
                  className="text-[10px] font-bold tracking-wider uppercase"
                  style={{ color: 'var(--aura-text-secondary)' }}
                >
                  {t('stitch.accountDashboard.nextBilling', { date: subscription.nextBilling })}
                </p>
              </div>
            </div>
            <div
              className="px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1"
              style={{
                backgroundColor: 'rgba(76,175,80,0.1)',
                color: '#4CAF50',
                border: '1px solid rgba(76,175,80,0.2)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
              {t('stitch.accountDashboard.active')}
            </div>
          </div>
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-xs tracking-wider uppercase transition-all active:scale-95"
            style={{
              backgroundColor: 'rgba(198,198,199,0.08)',
              color: 'var(--aura-primary)',
              minHeight: 'var(--aura-touch-target)',
            }}
          >
            <Gift className="w-4 h-4" />
            {t('stitch.accountDashboard.manageSubscription')}
            <ChevronRight className="w-4 h-4" />
          </button>
        </section>

        {/* ─── Recent Transactions ─── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3
              className="text-xs font-bold tracking-[0.15em] uppercase"
              style={{ color: 'var(--aura-text-primary)' }}
            >
              {t('stitch.accountDashboard.recentTransactions')}
            </h3>
            <button
              type="button"
              className="text-[11px] font-bold tracking-wider uppercase border-b pb-0.5 transition-opacity hover:opacity-80"
              style={{ color: 'var(--aura-primary)', borderColor: 'var(--aura-primary)' }}
            >
              {t('stitch.accountDashboard.viewAll')}
            </button>
          </div>

          {transactions.length === 0 ? (
            /* Empty state for transactions */
            <div
              className="dash-card p-8 text-center"
            >
              <Coffee className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(198,198,199,0.2)' }} />
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--aura-text-primary)' }}>
                {t('stitch.accountDashboard.noTransactionsYet')}
              </p>
              <p
                className="text-xs"
                style={{ color: 'var(--aura-text-secondary)' }}
              >
                {t('stitch.accountDashboard.noTransactionsDesc')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="dash-card-sm p-4 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: 'var(--aura-bg-high)',
                        border: '1px solid var(--aura-glass-border)',
                      }}
                    >
                      <TransactionIcon icon={tx.icon} />
                    </div>
                    <div>
                      <p
                        className="text-base font-medium leading-tight"
                        style={{ color: 'var(--aura-text-primary)' }}
                      >
                        {tx.itemName}
                      </p>
                      <p
                        className="text-[10px] mt-0.5"
                        style={{ color: 'var(--aura-text-secondary)' }}
                      >
                        {tx.time}
                      </p>
                    </div>
                  </div>
                  <OrderStatusBadge status={tx.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Membership Card ─── */}
        <section className="pt-2">
          <div
            className="relative w-full aspect-[1.6/1] rounded-2xl overflow-hidden group"
            style={{ border: '1px solid var(--aura-glass-border)' }}
          >
            {/* Background */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, var(--aura-bg-high) 0%, var(--aura-bg-surface) 100%)',
              }}
            />

            {/* Texture overlay */}
            <div
              className="absolute inset-0 opacity-40 mix-blend-overlay"
              style={{
                backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuD0ldGu_qcqMXjXQnmt1JmIllxnBsu6SKMlLfZRY9Xt87lWvWROEWcoqzwB3AvNRVR96MEQ89_PvOwhogedyMW8J1lDYtOTw4L1jIQ5o-GPoc0_EYHIHOi4sLwZ6Rs-6Jlw-XMJlgtS1WxInAUVI55oekXIPhc9vn-Ve4XUVEMbs_SseLo0FTvkEEBrjKkb6P5J-Ca3A-OSIadHROpyLWsXlmgtWXOe7nSH_rkhenHjGFhXF7NY4JVWyBbA_iZt8DHDQoZ2FeTtygo")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Card content */}
            <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <h3
                  className="text-xl font-bold tracking-widest"
                  style={{
                    fontFamily: 'var(--aura-font-display)',
                    background: 'linear-gradient(180deg, #FFFFFF 0%, #94A3B8 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  AURA
                </h3>
                <CreditCard
                  className="w-7 h-7"
                  style={{ color: 'rgba(212,165,116,0.6)' }}
                />
              </div>

              <div className="space-y-1.5">
                <p
                  className="text-xs tracking-[0.3em] font-bold"
                  style={{ color: 'var(--aura-tertiary)' }}
                >
                  {profile.name.toUpperCase()}
                </p>
                <p
                  className="text-[10px] tracking-wider"
                  style={{ color: 'rgba(198,198,199,0.3)' }}
                >
                  {t('stitch.accountDashboard.memberSince', { year: profile.memberSince })}
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ═══════════════ Bottom Navigation ═══════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-20 px-4 border-t"
        style={{
          backgroundColor: 'var(--aura-bg-page)',
          borderColor: 'var(--aura-glass-border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <NavItem icon={<Medal className="w-6 h-6" />} label={t('stitch.accountDashboard.navReserve')} href="#" />
        <NavItem icon={<Coffee className="w-6 h-6" />} label={t('stitch.accountDashboard.navOrders')} href="#" />
        <NavItem icon={<Trophy className="w-6 h-6" />} label={t('stitch.accountDashboard.navLoyalty')} href="#" />
        <NavItem icon={<User className="w-6 h-6" />} label={t('stitch.accountDashboard.navAccount')} active href="#" />
      </nav>

      {/* ═══════════════ Styles ═══════════════ */}
      <style>{`
        .dash-card {
          background: var(--aura-glass-bg);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--aura-glass-border);
          border-radius: var(--aura-radius-xl);
          transition: all var(--aura-duration-normal) var(--aura-easing-default);
        }
        .dash-card-sm {
          background: var(--aura-glass-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--aura-glass-border);
          border-radius: var(--aura-radius-lg);
          transition: all var(--aura-duration-normal) var(--aura-easing-default);
        }
        .dash-card-sm:active {
          transform: scale(0.99);
        }
      `}</style>
    </div>
  );
}

/* ─── Bottom Nav Item ────────────────────────────────────────────── */
function NavItem({
  icon,
  label,
  active,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  href: string;
}) {
  return (
    <a
      href={href}
      className={clsx(
        'flex flex-col items-center justify-center gap-1 transition-all active:scale-90',
      )}
      style={{
        minWidth: 'var(--aura-touch-target)',
        minHeight: 'var(--aura-touch-target)',
        color: active ? 'var(--aura-tertiary)' : 'var(--aura-text-secondary)',
      }}
    >
      {icon}
      <span className="text-[10px] font-bold tracking-wider uppercase">{label}</span>
    </a>
  );
}
