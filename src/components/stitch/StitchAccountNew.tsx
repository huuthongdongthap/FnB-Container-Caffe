/**
 * StitchAccountNew — AURA CAFE Customer Account Dashboard (HTML-to-TSX conversion)
 *
 * Mobile-first, dark navy theme with glassmorphism cards and chrome/silver accents.
 * Source: stitch-exports/stitch_aura_cafe/aura_cafe_customer_account/code.html
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
  Bell,
  Clock,
  Star,
  RefreshCw,
  UtensilsCrossed,
  CupSoda,
  IceCream,
  Menu as MenuIcon,
  Medal,
  ReceiptText,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface AccountProfileNew {
  name: string;
  avatar: string;
  tier: string;
  memberSince: string;
}

export interface LoyaltyDataNew {
  points: number;
  nextTier: string;
  pointsToNext: number;
  progressPercent: number;
}

export interface OrderItemNew {
  id: string;
  itemName: string;
  icon: 'coffee' | 'bakery' | 'icecream' | 'cupSoda';
  time: string;
  status: 'preparing' | 'delivered';
}

export interface AccountCardNew {
  type: 'subscription' | 'payment';
  title: string;
  subtitle: string;
  meta: string;
  accent?: boolean;
}

export interface StitchAccountNewProps {
  profile?: AccountProfileNew;
  loyalty?: LoyaltyDataNew;
  orders?: OrderItemNew[];
  cards?: AccountCardNew[];
}

/* ─── Icons ─────────────────────────────────────────────────────────── */

const iconMap: Record<OrderItemNew['icon'], React.ReactNode> = {
  coffee: <Coffee className="w-5 h-5 text-[#d4a574]" />,
  bakery: <UtensilsCrossed className="w-5 h-5 text-[#d4a574]" />,
  icecream: <IceCream className="w-5 h-5 text-[#d4a574]" />,
  cupSoda: <CupSoda className="w-5 h-5 text-[#d4a574]" />,
};

function OrderNewStatusBadge({ status }: { status: OrderItemNew['status'] }) {
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
        'bg-[rgba(198,198,199,0.08)] text-[#c6c6c7] border-[rgba(198,198,199,0.15)]',
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

/* ─── Defaults ──────────────────────────────────────────────────────── */

const defaultProfile: AccountProfileNew = {
  name: 'Julian Vane',
  avatar:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD85_v-mTOc0nYNat_E87LRoxgQ8V8vWg6--Eqj8-hF8Yf1xq-KcWCNzzvU68SWZBM8wa3Y9DTzmi3j17h8GKf1By4BdEUFR-8w1IdVjS7iF5IYAovhMynYJGEUN3UcV_Yn3KKCSpaep_A18JJoZFnUozahJNkzkB8Uqgf8rJn1efSNviQXUHW4gSsruyx8TAtv7LHMLFz0RSXPb2W4wBkRcapILuPmNsNIy2jS8NeVKraqL8uy3NG5Y4cODICU7fJFmmBpiXLPing',
  tier: 'Gold',
  memberSince: '2022',
};

const defaultLoyalty: LoyaltyDataNew = {
  points: 1250,
  nextTier: 'Platinum',
  pointsToNext: 250,
  progressPercent: 75,
};

const defaultOrders: OrderItemNew[] = [
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
    time: 'Yesterday, 10:15 AM',
    status: 'delivered',
  },
];

const defaultCards: AccountCardNew[] = [
  {
    type: 'subscription',
    title: 'Aura Elite',
    subtitle: 'Subscription',
    meta: 'Active',
    accent: true,
  },
  {
    type: 'payment',
    title: 'Visa •• 4242',
    subtitle: 'Payment',
    meta: 'Default',
    accent: false,
  },
];

/* ─── Loading Skeleton ──────────────────────────────────────────────── */

function AccountNewSkeleton() {
  return (
    <div
      className="min-h-screen bg-[#050D1A] animate-pulse"
      aria-label="Loading account dashboard"
    >
      <div className="px-5 pt-24 pb-32 max-w-lg mx-auto space-y-6">
        {/* App bar skeleton */}
        <div className="flex items-center justify-between h-16 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#1e3550]" />
          <div className="w-28 h-5 rounded bg-[#1e3550]" />
          <div className="w-8 h-8 rounded-full bg-[#1e3550]" />
        </div>
        {/* Profile card skeleton */}
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-[#1e3550]" />
            <div className="space-y-2">
              <div className="w-32 h-5 rounded bg-[#1e3550]" />
              <div className="w-20 h-3 rounded bg-[#1e3550]" />
            </div>
          </div>
        </div>
        {/* Loyalty skeleton */}
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="w-full h-2 rounded-full bg-[#1e3550]" />
        </div>
        {/* Quick order skeleton */}
        <div className="h-14 rounded-xl bg-[#1e3550]" />
        {/* Order skeletons */}
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg p-4"
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
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
        {/* Settings cards skeleton */}
        <div className="grid grid-cols-2 gap-4">
          <div
            className="rounded-xl p-5"
            style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="w-6 h-6 rounded bg-[#1e3550] mb-3" />
            <div className="w-16 h-3 rounded bg-[#1e3550] mb-1" />
            <div className="w-20 h-4 rounded bg-[#1e3550]" />
          </div>
          <div
            className="rounded-xl p-5"
            style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="w-6 h-6 rounded bg-[#1e3550] mb-3" />
            <div className="w-16 h-3 rounded bg-[#1e3550] mb-1" />
            <div className="w-20 h-4 rounded bg-[#1e3550]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ───────────────────────────────────────────────────── */

function AccountNewError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#050D1A] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <RefreshCw className="w-7 h-7 text-[#d4a574]" />
        </div>
        <h2
          className="text-xl font-semibold mb-2"
          style={{ fontFamily: "var(--aura-font-display, 'Cormorant Garamond', Georgia, serif)" }}
        >
          {t('stitch.accountDashboard.failedToLoad')}
        </h2>
        <p className="text-sm mb-6 text-[#a0a8b0]">
          {t('stitch.accountDashboard.errorDescription')}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-6 py-3 rounded-xl font-semibold text-sm tracking-wider uppercase transition-all active:scale-95 min-h-[48px]"
            style={{
              background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
              color: '#1a1a2e',
            }}
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

function BottomNavItem({
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
          ? 'text-[#d4a574] bg-[rgba(212,165,116,0.1)]'
          : 'text-[#5a6270] hover:text-[#a0a8b0] hover:bg-white/5',
      )}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
    >
      {icon}
      <span className="text-[10px] font-bold tracking-wider uppercase">{label}</span>
    </button>
  );
}

/* ─── Main Component ────────────────────────────────────────────────── */

export function StitchAccountNew({
  profile: profileProp,
  loyalty: loyaltyProp,
  orders: ordersProp,
  cards: cardsProp,
}: Readonly<StitchAccountNewProps>) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = profileProp ?? defaultProfile;
  const loyalty = loyaltyProp ?? defaultLoyalty;
  const orders = ordersProp ?? defaultOrders;
  const cards = cardsProp ?? defaultCards;

  if (loading) return <AccountNewSkeleton />;

  if (error) {
    return (
      <AccountNewError
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
      className="relative min-h-screen bg-[#050D1A] text-[#e8e8e8] overflow-x-hidden"
      aria-label={t('stitch.accountDashboard.pageAriaLabel') || 'Account Dashboard'}
    >
      {/* ═══════════════ Top App Bar ═══════════════ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-5 border-b border-[rgba(255,255,255,0.06)] bg-[#0A1A2E]/80 backdrop-blur-xl"
        aria-label={t('stitch.accountDashboard.appBarAriaLabel') || 'App bar'}
      >
        <button
          type="button"
          className="flex items-center justify-center w-10 h-10 text-[#c6c6c7] hover:opacity-80 active:scale-90 transition-all"
          aria-label={t('stitch.accountDashboard.openMenu')}
        >
          <Menu className="w-6 h-6" />
        </button>

        <h1
          className="font-['EB_Garamond',Georgia,serif] text-[clamp(1.25rem,4vw,1.75rem)] tracking-widest text-[#d4a574]"
        >
          AURA CAFE
        </h1>

        <button
          type="button"
          className="flex items-center justify-center w-10 h-10 text-[#c6c6c7] hover:opacity-80 active:scale-90 transition-all"
          aria-label="Notifications"
        >
          <Bell className="w-6 h-6" />
        </button>
      </header>

      {/* ═══════════════ Main Content ═══════════════ */}
      <main className="pt-24 pb-36 px-5 max-w-lg mx-auto w-full space-y-6">

        {/* ─── Profile Section ─── */}
        <section
          className="relative rounded-xl p-6 overflow-hidden"
          style={{
            background: 'rgba(30, 41, 59, 0.4)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          aria-label={t('stitch.accountDashboard.profileSectionAriaLabel') || 'Profile'}
        >
          {/* Decorative glow */}
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(212,165,116,0.15), transparent 70%)',
              transform: 'translate(20%, -20%)',
            }}
          />

          <div className="flex items-center gap-5 relative z-10">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-[#d4a574] p-1">
                <img
                  className="w-full h-full rounded-full object-cover"
                  src={profile.avatar}
                  alt={t('stitch.accountDashboard.avatarAlt', { name: profile.name })}
                  loading="lazy"
                />
              </div>
              <div
                className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest"
                style={{
                  background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
                  color: '#1a1a2e',
                }}
              >
                {profile.tier}
              </div>
            </div>
            <div>
              <h2
                className="text-[clamp(1.1rem,3vw,1.5rem)] font-semibold"
                style={{ fontFamily: "var(--aura-font-display, 'Cormorant Garamond', Georgia, serif)" }}
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
          className="rounded-xl p-6"
          style={{
            background: 'rgba(30, 41, 59, 0.4)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          aria-label={t('stitch.accountDashboard.loyaltySectionAriaLabel') || 'Loyalty progress'}
        >
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-1 text-[#a0a8b0]">
                {t('stitch.accountDashboard.currentBalance')}
              </p>
              <span
                className="text-[clamp(1.75rem,5vw,2.5rem)] font-semibold leading-none"
                style={{ fontFamily: "var(--aura-font-display, 'Cormorant Garamond', Georgia, serif)", color: '#d4a574' }}
              >
                {loyalty.points.toLocaleString()}
                <span className="text-base font-normal text-[#a0a8b0] ml-1">
                  {t('stitch.accountDashboard.pts')}
                </span>
              </span>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold tracking-widest uppercase mb-1 text-[#a0a8b0]">
                {t('stitch.accountDashboard.nextTier', { tier: loyalty.nextTier })}
              </p>
              <p className="text-sm text-[#c1c7cf]">
                {loyalty.nextTier}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-[#1e3550] rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${loyalty.progressPercent}%`,
                background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            />
          </div>

          <p className="text-[11px] text-[#7c838a] text-right">
            {loyalty.pointsToNext} {t('stitch.accountDashboard.pts')} until {loyalty.nextTier}
          </p>
        </section>

        {/* ─── Quick Order Button ─── */}
        <button
          type="button"
          className="w-full h-14 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform group"
          style={{
            background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
          aria-label={t('stitch.accountDashboard.quickOrder')}
        >
          <Coffee className="w-5 h-5 text-[#1a1a2e] group-hover:rotate-12 transition-transform" />
          <span
            className="text-sm font-bold tracking-[0.2em] uppercase text-[#1a1a2e]"
            style={{ fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}
          >
            {t('stitch.accountDashboard.quickOrder')}
          </span>
        </button>

        {/* ─── Order History ─── */}
        <section aria-label={t('stitch.accountDashboard.recentTransactions')}>
          <div className="flex justify-between items-center mb-4">
            <h3
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--aura-font-display, 'Cormorant Garamond', Georgia, serif)" }}
            >
              {t('stitch.accountDashboard.recentTransactions')}
            </h3>
            <button
              type="button"
              className="text-[10px] font-bold tracking-wider uppercase text-[#d4a574] hover:opacity-80 transition-opacity"
              aria-label={t('stitch.accountDashboard.viewAll')}
            >
              {t('stitch.accountDashboard.viewAll')}
            </button>
          </div>

          {orders.length === 0 ? (
            /* Empty state */
            <div
              className="rounded-xl p-8 text-center"
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Coffee className="w-10 h-10 mx-auto mb-3 text-[rgba(198,198,199,0.2)]" />
              <p className="text-sm font-medium mb-1 text-[#e8e8e8]">
                {t('stitch.accountDashboard.noTransactionsYet')}
              </p>
              <p className="text-xs text-[#a0a8b0]">
                {t('stitch.accountDashboard.noTransactionsDesc')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 rounded-lg active:scale-[0.99] transition-transform"
                  style={{
                    background: 'rgba(30, 41, 59, 0.4)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: 'inset 0 1px 0 rgba(205,127,50,0.3)',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center border border-white/5"
                      style={{ backgroundColor: '#1f2a3c' }}
                    >
                      {iconMap[order.icon]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#e8e8e8]">
                        {order.itemName}
                      </p>
                      <p className="text-[12px] text-[#a0a8b0] mt-0.5">
                        {order.time}
                      </p>
                    </div>
                  </div>
                  <OrderNewStatusBadge status={order.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Settings Cards Grid ─── */}
        <section aria-label="Account settings">
          <div className="grid grid-cols-2 gap-4">
            {cards.map((card) => (
              <div
                key={card.type}
                className={clsx(
                  'p-5 rounded-xl transition-all hover:scale-[1.02]',
                  card.accent
                    ? 'border-l-2 border-l-[#d4a574]'
                    : 'border-l border-l-transparent',
                )}
                style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
                aria-label={`${card.title} - ${card.subtitle}`}
              >
                {card.type === 'subscription' ? (
                  <Star className="w-6 h-6 text-[#d4a574] mb-3" />
                ) : (
                  <CreditCard className="w-6 h-6 text-[#c6c6c7] mb-3" />
                )}
                <p className="text-[10px] font-bold tracking-wider uppercase text-[#a0a8b0] mb-1">
                  {card.subtitle}
                </p>
                <p
                  className="text-sm font-bold text-[#e8e8e8]"
                  style={{ fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}
                >
                  {card.title}
                </p>
                <p className="text-[10px] text-[#7c838a] mt-2">
                  {card.meta}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ═══════════════ Bottom Navigation ═══════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-6 py-3 pb-8 rounded-t-full"
        style={{
          background: 'rgba(21, 32, 49, 0.4)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
        aria-label={t('stitch.accountDashboard.navAriaLabel') || 'Main navigation'}
      >
        <BottomNavItem
          icon={<MenuIcon className="w-5 h-5" />}
          label={t('stitch.accountDashboard.navReserve')}
        />
        <BottomNavItem
          icon={<Medal className="w-5 h-5" />}
          label={t('stitch.accountDashboard.navLoyalty')}
        />
        <BottomNavItem
          icon={<ReceiptText className="w-5 h-5" />}
          label={t('stitch.accountDashboard.navOrders')}
        />
        <BottomNavItem
          icon={<User className="w-5 h-5" />}
          label={t('stitch.accountDashboard.navAccount')}
          active
        />
      </nav>

      {/* ═══════════════ Floating Atmosphere Elements ═══════════════ */}
      <div
        className="fixed top-20 left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(184,199,226,0.05), transparent 70%)',
          filter: 'blur(80px)',
        }}
        aria-hidden="true"
      />
      <div
        className="fixed bottom-40 right-0 w-60 h-60 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(212,165,116,0.05), transparent 70%)',
          filter: 'blur(100px)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
