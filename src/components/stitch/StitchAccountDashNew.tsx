/**
 * StitchAccountDashNew — AURA CAFE Customer Account Dashboard (v2)
 *
 * Pixel-perfect match against:
 *   stitch-exports/stitch_aura_cafe/aura_cafe_customer_account_dashboard/code.html
 *
 * Mobile-first, dark navy theme with glassmorphism cards, bronze gradients,
 * and chrome/silver accents. Includes membership card.
 *
 * NOTE: This component uses the exact color hex values and font stacks from
 * the original Stitch HTML design. It does NOT reference --aura-* CSS variables.
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  User,
  Coffee,
  CreditCard,
  Menu,
  RefreshCw,
  Croissant,
  CupSoda,
  IceCream,
  Medal,
  ReceiptText,
  Armchair,
} from 'lucide-react';

/* ─── Font Stack Constants (from original HTML tailwind.config) ─────── */
/* Body:     Hanken Grotesk */
/* Display:  EB Garamond     */

const BODY_FONT = '"Hanken Grotesk", system-ui, sans-serif';
const DISPLAY_FONT = '"EB Garamond", Georgia, "Times New Roman", serif';

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

/* ─── Original HTML color reference ───────────────────────────────────
   body bg:           #081425 (surface)
   on-surface text:   #d8e3fb
   primary:           #b8c7e2
   secondary:         #ffb779
   on-secondary:      #4c2700
   on-surface-variant:#c5c6cd
   on-tertiary-container: #7c838a
   surface-container-high: #1f2a3c
   surface-container-highest: #2a3548
   surface-container-lowest: #040e1f
   bronze gradient:   #CD7F32 -> #A0522D
   glass bg:          rgba(30, 41, 59, 0.4)
   chrome border:     rgba(148, 163, 184, 0.3)
   rim light:         rgba(205, 127, 50, 0.3)
   ──────────────────────────────────────────────────────────────────── */

/* ─── Icons ─────────────────────────────────────────────────────────── */

const iconMap: Record<DashOrderItem['icon'], React.ReactNode> = {
  coffee: <Coffee className="w-6 h-6 text-[var(--st-secondary)]" />,
  bakery: <Croissant className="w-6 h-6 text-[var(--st-secondary)]" />,
  icecream: <IceCream className="w-6 h-6 text-[var(--st-secondary)]" />,
  cupSoda: <CupSoda className="w-6 h-6 text-[var(--st-secondary)]" />,
};

/* ─── Status Badge ─────────────────────────────────────────────────── */

function OrderDashStatusBadge({ status }: { status: DashOrderItem['status'] }) {
  const { t } = useTranslation();
  const config = {
    preparing: {
      label: t('stitch.accountDashboard.statusPreparing', 'Preparing'),
      class:
        'bg-[rgba(255,183,121,0.1)] text-[var(--st-secondary)] border border-[rgba(255,183,121,0.2)]',
    },
    delivered: {
      label: t('stitch.accountDashboard.statusDelivered', 'Delivered'),
      class:
        'bg-[rgba(184,199,226,0.1)] text-[var(--st-primary)] border border-[rgba(184,199,226,0.2)]',
    },
  };
  const c = config[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border whitespace-nowrap',
        c.class,
      )}
      style={{ fontFamily: BODY_FONT }}
    >
      {c.label}
    </span>
  );
}

/* ─── Loading Skeleton ──────────────────────────────────────────────── */

function DashSkeleton() {
  return (
    <div
      className="min-h-screen bg-[var(--st-surface)] animate-pulse"
      aria-label="Account Dashboard"
    >
      <div className="px-5 pt-24 pb-32 mx-auto w-full space-y-6">
        {/* App bar skeleton */}
        <div className="flex items-center justify-between h-16 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#1e3550]" />
          <div className="w-28 h-5 rounded bg-[#1e3550]" />
          <div className="w-10 h-10 rounded-full bg-[#1e3550]" />
        </div>
        {/* Profile card skeleton */}
        <div className="rounded-xl p-6 bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-[#1e3550]" />
            <div className="space-y-2">
              <div className="w-32 h-5 rounded bg-[#1e3550]" />
              <div className="w-20 h-3 rounded bg-[#1e3550]" />
            </div>
          </div>
        </div>
        {/* Loyalty skeleton */}
        <div className="rounded-xl p-6 bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10">
          <div className="w-full h-2 rounded-full bg-[var(--st-surface-container-highest)]" />
        </div>
        {/* Quick order skeleton */}
        <div className="h-14 rounded-xl bg-[#1e3550]" />
        {/* Orders skeleton */}
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg p-4 bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-[rgba(148,163,184,0.3)]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--st-surface-container-high)]" />
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
    <div className="min-h-screen bg-[var(--st-surface)] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{
            background: 'rgba(30,41,59,0.4)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <RefreshCw className="w-7 h-7 text-[var(--st-secondary)]" />
        </div>
        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--st-on-surface)', fontFamily: DISPLAY_FONT }}
        >
          {t('stitch.accountDashboard.failedToLoad', 'Failed to Load')}
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--st-on-surface-variant)', fontFamily: BODY_FONT }}>
          {t('stitch.accountDashboard.errorDescription', 'Something went wrong. Please try again.')}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-6 py-3 rounded-xl font-semibold text-sm tracking-wider uppercase transition-all active:scale-95 min-h-[48px] bg-gradient-to-br from-[#CD7F32] to-[#A0522D] text-[var(--st-on-secondary)]"
            style={{ fontFamily: BODY_FONT }}
            aria-label={t('stitch.accountDashboard.retry', 'Retry')}
          >
            {t('stitch.accountDashboard.retry', 'Retry')}
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
  href,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  href?: string;
}) {
  const Tag = href ? 'a' : 'button';
  const linkProps = href ? { href, target: '_self' as const } : {};
  return (
    <Tag
      type={href ? undefined : 'button'}
      className={clsx(
        'flex flex-col items-center justify-center',
        active
          ? 'text-[var(--st-secondary)] font-bold active:scale-90 transition-transform'
          : 'text-[var(--st-on-surface-variant)] hover:text-[var(--st-primary)] transition-colors active:scale-90 transition-transform',
      )}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      {...linkProps}
    >
      {icon}
      <span
        className="mt-1 text-[10px] font-bold tracking-wider uppercase"
        style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
      >
        {label}
      </span>
    </Tag>
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
  const glassCardRefs = useRef<(HTMLElement | null)[]>([]);

  const profile = profileProp ?? defaultProfile;
  const loyalty = loyaltyProp ?? defaultLoyalty;
  const orders = ordersProp ?? defaultOrders;

  /* ── Micro-interactions from original HTML <script> tags ───────── */
  useEffect(() => {
    /* Glass card mouse tracking (--mouse-x / --mouse-y) */
    const cards = glassCardRefs.current.filter(Boolean) as HTMLElement[];
    const handleMouseMove = (e: MouseEvent, card: HTMLElement) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    };
    const mouseListeners: { el: HTMLElement; handler: (e: MouseEvent) => void }[] = [];
    cards.forEach((card) => {
      const handler = (e: MouseEvent) => handleMouseMove(e, card);
      mouseListeners.push({ el: card, handler });
      card.addEventListener('mousemove', handler);
    });

    /* Touch scale effect on buttons and links */
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.currentTarget as HTMLElement;
      target.classList.add('scale-95');
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.currentTarget as HTMLElement;
      target.classList.remove('scale-95');
    };
    const touchElements = document.querySelectorAll<HTMLElement>('button, a');
    const touchListeners: { el: HTMLElement; startHandler: (e: Event) => void; endHandler: (e: Event) => void }[] = [];
    touchElements.forEach((el) => {
      const startHandler = (e: Event) => handleTouchStart(e as TouchEvent);
      const endHandler = (e: Event) => handleTouchEnd(e as TouchEvent);
      touchListeners.push({ el, startHandler, endHandler });
      el.addEventListener('touchstart', startHandler);
      el.addEventListener('touchend', endHandler);
    });

    return () => {
      mouseListeners.forEach(({ el, handler }) => el.removeEventListener('mousemove', handler));
      touchListeners.forEach(({ el, startHandler, endHandler }) => {
        el.removeEventListener('touchstart', startHandler);
        el.removeEventListener('touchend', endHandler);
      });
    };
  }, []);

  /* ── Glass card ref callback ─────────────────────────────────── */
  const setGlassCardRef = (el: HTMLElement | null) => {
    if (el && !glassCardRefs.current.includes(el)) {
      glassCardRefs.current.push(el);
    }
  };

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
      className="relative min-h-screen bg-[var(--st-surface)] text-[var(--st-on-surface)] antialiased overflow-x-hidden"
      style={{ fontFamily: BODY_FONT }}
      aria-label={t('stitch.accountDashboard.pageAriaLabel', 'Account Dashboard')}
    >
      {/* ═══════════════ Top App Bar ═══════════════ */}
      <header
        className="fixed top-0 w-full z-50 bg-[var(--st-surface)]/80 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-5 h-16"
        aria-label={t('stitch.accountDashboard.appBarAriaLabel', 'App bar')}
      >
        <button
          type="button"
          className="hover:opacity-80 transition-opacity active:scale-95 transition-transform"
          aria-label={t('stitch.accountDashboard.openMenu', 'Open menu')}
        >
          <Menu className="text-[var(--st-primary)] w-6 h-6" />
        </button>

        <h1
          className="text-[24px] tracking-tighter text-[var(--st-primary)] font-bold"
          style={{ fontFamily: DISPLAY_FONT }}
        >
          {t('stitch.accountDashboard.appTitle', 'AURA CAFE')}
        </h1>

        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10">
          <img
            className="w-full h-full object-cover"
            src={profile.avatar}
            alt={t('stitch.accountDashboard.avatarAlt', { name: profile.name }) || profile.name}
            loading="lazy"
          />
        </div>
      </header>

      {/* ═══════════════ Main Content ═══════════════ */}
      <main className="pt-24 pb-32 px-5 max-w-[1280px] mx-auto space-y-6">

        {/* ─── Profile Header ─── */}
        <section
          ref={setGlassCardRef}
          className="relative rounded-xl px-6 py-6 overflow-hidden bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(205,127,50,0.3)]"
          aria-label={t('stitch.accountDashboard.profileSectionAriaLabel') || 'Profile'}
        >
          {/* Atmospheric Shader Overlay (Abstract) — matches original HTML */}
          <div
            className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none"
            aria-hidden="true"
          />

          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full overflow-hidden border-2"
                style={{ borderColor: 'rgba(255,183,121,0.3)' }}
              >
                <img
                  className="w-full h-full object-cover"
                  src={profile.avatar}
                  alt={t('stitch.accountDashboard.avatarAlt', { name: profile.name }) || profile.name}
                  loading="lazy"
                />
              </div>
              <div
                className="absolute -bottom-1 -right-1 bg-[var(--st-secondary)] text-[var(--st-on-secondary)] px-2 py-0.5 rounded-full text-[8px] font-bold tracking-widest uppercase"
                style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
              >
                {profile.tier}
              </div>
            </div>
            <div>
              <h2
                className="text-[24px] text-[var(--st-on-surface)]"
                style={{ fontFamily: DISPLAY_FONT, lineHeight: '1.4', fontWeight: 500 }}
              >
                {profile.name}
              </h2>
              <p
                className="text-[10px] font-bold tracking-widest uppercase text-[var(--st-secondary)]"
                style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
              >
                {t('stitch.accountDashboard.tierMember', { tier: profile.tier }) || `${profile.tier} Tier Member`}
              </p>
            </div>
          </div>
        </section>

        {/* ─── Loyalty Section ─── */}
        <section
          ref={setGlassCardRef}
          className="rounded-xl px-6 py-6 bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10 space-y-4"
          aria-label={t('stitch.accountDashboard.loyaltySectionAriaLabel') || 'Loyalty progress'}
        >
          <div className="flex justify-between items-end">
            <div>
              <p
                className="text-[10px] font-bold tracking-widest uppercase text-[var(--st-on-surface-variant)]"
                style={{ fontFamily: BODY_FONT, lineHeight: '1', letterSpacing: '0.1em', marginBottom: '4px' }}
              >
                {t('stitch.accountDashboard.currentBalance', 'Current Balance')}
              </p>
              <p
                className="text-[32px] text-[var(--st-primary)]"
                style={{ fontFamily: DISPLAY_FONT, lineHeight: '1.3', fontWeight: 500 }}
              >
                {loyalty.points.toLocaleString()}
                <span
                  className="text-base opacity-60 ml-1"
                  style={{ fontFamily: BODY_FONT, fontWeight: 400, lineHeight: '1.6' }}
                >
                  {t('stitch.accountDashboard.pts', 'pts')}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p
                className="text-[10px] font-bold tracking-widest uppercase text-[var(--st-on-surface-variant)]"
                style={{ fontFamily: BODY_FONT, lineHeight: '1', letterSpacing: '0.1em', marginBottom: '4px' }}
              >
                {t('stitch.accountDashboard.nextTier', { tier: loyalty.nextTier }) || `Next Tier: ${loyalty.nextTier}`}
              </p>
              <p
                className="text-base text-[var(--st-secondary)]"
                style={{ fontFamily: BODY_FONT, fontWeight: 400, lineHeight: '1.6' }}
              >
                {loyalty.pointsToNext.toLocaleString()} {t('stitch.accountDashboard.pts', 'pts')} {t('stitch.accountDashboard.pointsToGo', 'to go')}
              </p>
            </div>
          </div>

          {/* Progress bar — matches original bronze-gradient */}
          <div className="w-full h-1.5 bg-[var(--st-surface-container-highest)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#CD7F32] to-[#A0522D]"
              style={{ width: `${loyalty.progressPercent}%` }}
            />
          </div>

          <div
            className="flex justify-between text-[9px] font-bold tracking-[0.2em] uppercase text-[var(--st-on-surface-variant)]/50"
            style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
          >
            <span>{profile.tier}</span>
            <span>{loyalty.nextTier}</span>
          </div>
        </section>

        {/* ─── Quick Order Button ─── */}
        <section>
          <button
            type="button"
            className="w-full h-16 rounded-xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform group bg-gradient-to-br from-[#CD7F32] to-[#A0522D]"
            aria-label={t('stitch.accountDashboard.quickOrder', 'QUICK ORDER')}
          >
            <Coffee className="w-6 h-6 text-[var(--st-on-secondary)] group-hover:rotate-12 transition-transform" />
            <span
              className="text-lg tracking-[0.05em] font-semibold uppercase text-[var(--st-on-secondary)]"
              style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
            >
              {t('stitch.accountDashboard.quickOrder', 'QUICK ORDER')}
            </span>
          </button>
        </section>

        {/* ─── Recent Transactions ─── */}
        <section className="space-y-4" aria-label={t('stitch.accountDashboard.recentTransactions', 'Recent Transactions')}>
          <div className="flex justify-between items-center">
            <h3
              className="text-[12px] font-bold tracking-[0.15em] uppercase text-[var(--st-on-surface)]"
              style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
            >
              {t('stitch.accountDashboard.recentTransactions', 'Recent Transactions')}
            </h3>
            <button
              type="button"
              className="text-[11px] font-bold uppercase tracking-widest text-[var(--st-primary)] border-b border-[var(--st-primary)]/30"
              style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
              aria-label={t('stitch.accountDashboard.viewAll', 'View All')}
            >
              {t('stitch.accountDashboard.viewAll', 'View All')}
            </button>
          </div>

          {orders.length === 0 ? (
            /* Empty state */
            <div className="rounded-xl p-8 text-center bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10">
              <Coffee className="w-10 h-10 mx-auto mb-3 text-[rgba(184,199,226,0.2)]" />
              <p className="text-sm font-medium mb-1 text-[var(--st-on-surface)]">
                {t('stitch.accountDashboard.noTransactionsYet', 'No transactions yet')}
              </p>
              <p className="text-xs text-[var(--st-on-surface-variant)]">
                {t('stitch.accountDashboard.noTransactionsDesc', 'Your recent orders will appear here.')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order, idx) => (
                <div
                  key={order.id}
                  ref={setGlassCardRef}
                  className={clsx(
                    'flex items-center justify-between p-4 rounded-lg bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-[rgba(148,163,184,0.3)]',
                    idx === orders.length - 1 && 'opacity-60',
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center border border-white/5 bg-[var(--st-surface-container-high)]">
                      {iconMap[order.icon]}
                    </div>
                    <div>
                      <p
                        className="text-lg font-medium text-[var(--st-on-surface)]"
                        style={{ fontFamily: BODY_FONT, lineHeight: '1.6' }}
                      >
                        {order.itemName}
                      </p>
                      <p
                        className="text-[10px] text-[var(--st-on-surface-variant)] mt-0.5"
                        style={{ fontFamily: BODY_FONT, lineHeight: '1', letterSpacing: '0.1em', fontWeight: 700 }}
                      >
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
        <section className="pt-4">
          <div
            className="relative w-full aspect-[1.6/1] rounded-2xl overflow-hidden border border-white/10 group"
            aria-label={t('stitch.accountDashboard.memberCard', 'Membership Card')}
          >
            {/* Card background gradient — matches surface-container-highest to surface-container-lowest */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--st-surface-container-highest)] to-[var(--st-surface-container-lowest)]" />

            {/* Texture overlay */}
            <div
              className="absolute inset-0 opacity-60 mix-blend-overlay bg-cover bg-center"
              style={{
                backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuD0ldGu_qcqMXjXQnmt1JmIllxnBsu6SKMlLfZRY9Xt87lWvWROEWcoqzwB3AvNRVR96MEQ89_PvOwhogedyMW8J1lDYtOTw4L1jIQ5o-GPoc0_EYHIHOi4sLwZ6Rs-6Jlw-XMJlgtS1WxInAUVI55oekXIPhc9vn-Ve4XUVEMbs_SseLo0FTvkEEBrjKkb6P5J-Ca3A-OSIadHROpyLWsXlmgtWXOe7nSH_rkhenHjGFhXF7NY4JVWyBbA_iZt8DHDQoZ2FeTtygo")',
              }}
              aria-hidden="true"
            />

            {/* Card content */}
            <div className="absolute inset-0 p-8 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span
                  className="text-[20px] tracking-widest font-bold bg-gradient-to-b from-white to-[#94A3B8] bg-clip-text text-transparent"
                  style={{ fontFamily: DISPLAY_FONT, lineHeight: '1.2', letterSpacing: '-0.01em' }}
                >
                  AURA
                </span>
                <CreditCard className="w-[30px] h-[30px] text-[var(--st-secondary)]/60" />
              </div>

              <div className="space-y-1">
                <p
                  className="text-[12px] tracking-[0.3em] font-bold uppercase text-[var(--st-secondary)]"
                  style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
                >
                  {profile.name.toUpperCase()}
                </p>
                <p
                  className="text-[10px] tracking-wider text-[var(--st-on-surface-variant)]/40"
                  style={{ fontFamily: BODY_FONT, lineHeight: '1', letterSpacing: '0.1em', fontWeight: 700 }}
                >
                  {t('stitch.accountDashboard.memberSince', 'MEMBER SINCE {{year}}', { year: profile.memberSince })}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ═══════════════ Bottom Navigation ═══════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-20 px-4 bg-[var(--st-surface)]/90 backdrop-blur-2xl border-t border-white/10"
        aria-label={t('stitch.accountDashboard.navAriaLabel') || 'Main navigation'}
      >
        <DashBottomNavItem
          icon={<Armchair className="w-6 h-6" />}
          label={t('stitch.accountDashboard.navReserve', 'Reserve')}
          href="/menu"
        />
        <DashBottomNavItem
          icon={<ReceiptText className="w-6 h-6" />}
          label={t('stitch.accountDashboard.navOrders', 'Orders')}
          href="/menu"
        />
        <DashBottomNavItem
          icon={<Medal className="w-6 h-6" />}
          label={t('stitch.accountDashboard.navLoyalty', 'Loyalty')}
          href="/menu"
        />
        <DashBottomNavItem
          icon={<User className="w-6 h-6" />}
          label={t('stitch.accountDashboard.navAccount', 'Account')}
          active
        />
      </nav>
    </div>
  );
}
