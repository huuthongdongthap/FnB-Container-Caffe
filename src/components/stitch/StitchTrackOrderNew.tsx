/**
 * StitchTrackOrderNew — Order tracking / status screen for AURA CAFE
 *
 * Regenerated from the original Stitch HTML export:
 *   stitch-exports/new-screens/order-tracking.html
 *
 * Design tokens mapped to --aura-* CSS variables:
 *   --aura-surface-dim    -> main bg (#081425)
 *   --aura-chrome-bright  -> bright text (#c6c6c7)
 *   --aura-chrome-soft    -> muted text (#a0a0a0)
 *   --aura-bronze-shimmer -> CTA/accent (#d4a574)
 *   Display font: 'EB Garamond', serif
 *   Body font: 'Space Grotesk', sans-serif
 */
'use client';

import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { cn } from '@/lib/cn';
import {
  ArrowLeft,
  Coffee,
  Croissant,
  MapPin,
  Receipt,
  UtensilsCrossed,
  User,
} from 'lucide-react';

/* ─── Glass card style ──────────────────────────────────────────── */

const glassCardClasses =
  'bg-[rgba(26,43,66,0.4)] backdrop-blur-[20px] border border-[rgba(198,198,199,0.1)]';

/* ─── Props ─────────────────────────────────────────────────────── */

export interface TrackOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  icon?: React.ElementType;
}

export interface StitchTrackOrderNewProps {
  orderId?: string;
  estimatedMinutes?: number;
  items?: TrackOrderItem[];
  total?: number;
  onTrackMap?: () => void;
  onBack?: () => void;
  onNavigate?: (path: string) => void;
}

/* ─── Timeline step component ───────────────────────────────────── */

function TimelineStep({
  label,
  time,
  isActive,
  isCompleted,
  isLast,
}: {
  label: string;
  time?: string;
  isActive: boolean;
  isCompleted: boolean;
  isLast: boolean;
}) {
  const isHighlighted = isActive || isCompleted;
  const diamondColor = isActive
    ? 'var(--aura-bronze-shimmer)'
    : isCompleted
      ? 'var(--aura-chrome-bright)'
      : 'var(--aura-chrome-soft)';
  const diamondOpacity = isHighlighted ? '1' : '0.4';
  const textOpacity = isHighlighted ? '1' : '0.4';

  return (
    <div className="flex items-center gap-6 relative">
      <div className="z-10 w-11 h-11 flex items-center justify-center bg-[var(--aura-surface-dim)]">
        <div
          className="w-3 h-3"
          style={{
            transform: 'rotate(45deg)',
            backgroundColor: diamondColor,
            opacity: diamondOpacity,
            boxShadow: isActive ? '0 0 15px rgba(212, 165, 116, 0.4)' : 'none',
            animation: isActive ? 'aura-pulse-bronze 2s infinite ease-in-out' : 'none',
          }}
        />
      </div>
      <div>
        <h3
          className="font-['Space_Grotesk'] text-[14px] font-medium tracking-[0.05em] uppercase"
          style={{
            color: isHighlighted ? 'var(--aura-bronze-shimmer)' : 'var(--aura-chrome-soft)',
            opacity: textOpacity,
          }}
        >
          {label}
        </h3>
        {time && (
          <p className="text-[10px] text-[var(--aura-chrome-soft)] mt-1">{time}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────────── */

export function StitchTrackOrderNew({
  orderId = '#AC-8842',
  estimatedMinutes = 8,
  items = [
    { id: '1', name: 'Midnight Espresso', quantity: 1, price: 6.5, icon: Coffee },
    { id: '2', name: 'Silver Leaf Pastry', quantity: 1, price: 8.0, icon: Croissant },
  ],
  total = 14.5,
  onTrackMap,
  onBack,
  onNavigate,
}: StitchTrackOrderNewProps) {
  const { t } = useTranslation();

  return (
    <>
      <HelmetHead
        title="Order Status"
        description="Track your AURA CAFE order in real-time. Estimated arrival time and order progress."
      />

      {/* TopAppBar */}
      <header className="w-full top-0 sticky bg-[var(--aura-surface-dim)] dark:bg-[var(--aura-surface-dim)] border-b border-[var(--aura-chrome-soft)]/10 z-50 h-16 flex items-center px-5">
        <div className="flex items-center w-full">
          <button
            onClick={onBack}
            className="mr-4 text-[var(--aura-bronze-shimmer)] hover:opacity-80 transition-opacity"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="font-['Space_Grotesk'] text-[20px] font-bold leading-tight uppercase tracking-tight text-[var(--aura-bronze-shimmer)]">
            {t('trackOrder.title', 'ORDER STATUS')}
          </h1>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-5 pt-8 space-y-8 min-h-screen pb-32">
        {/* Hero / Order Reference Card */}
        <section className={cn(glassCardClasses, 'rounded-xl p-8 relative overflow-hidden')}>
          <div className="relative z-10 space-y-2">
            <p className="font-['Space_Grotesk'] text-[12px] font-medium tracking-[0.08em] uppercase text-[var(--aura-chrome-soft)]">
              {t('trackOrder.orderRef', 'Order Reference')}
            </p>
            <h2 className="font-['EB_Garamond'] text-[32px] font-semibold leading-tight tracking-tight text-[var(--aura-bronze-shimmer)]">
              {orderId}
            </h2>

            <div className="pt-6 flex items-baseline gap-2">
              <span className="font-['EB_Garamond'] text-[48px] font-bold leading-none tracking-tight text-[var(--aura-bronze-shimmer)]">
                {estimatedMinutes}
              </span>
              <span className="font-['Space_Grotesk'] text-[20px] font-bold leading-tight text-[var(--aura-bronze-shimmer)]">
                {t('trackOrder.mins', 'MINS')}
              </span>
            </div>
            <p className="font-['Space_Grotesk'] text-[16px] leading-relaxed text-[var(--aura-chrome-bright)]">
              {t('trackOrder.eta', 'Estimated Arrival Time')}
            </p>
          </div>
        </section>

        {/* Vertical Progress Timeline */}
        <section className="py-4 relative">
          {/* Connecting line */}
          <div
            className="absolute left-[21px] top-0 bottom-0 w-px"
            style={{ background: 'rgba(198, 198, 199, 0.1)' }}
          />

          <div className="space-y-12">
            <TimelineStep
              label={t('trackOrder.stepConfirmed', 'Confirmed')}
              time="10:42 AM"
              isActive={false}
              isCompleted={true}
              isLast={false}
            />
            <TimelineStep
              label={t('trackOrder.stepPreparing', 'Preparing')}
              time={t('trackOrder.inProgress', 'IN PROGRESS')}
              isActive={true}
              isCompleted={false}
              isLast={false}
            />
            <TimelineStep
              label={t('trackOrder.stepOutForDelivery', 'Out for Delivery')}
              isActive={false}
              isCompleted={false}
              isLast={false}
            />
            <TimelineStep
              label={t('trackOrder.stepDelivered', 'Delivered')}
              isActive={false}
              isCompleted={false}
              isLast={true}
            />
          </div>
        </section>

        {/* Order Summary Card */}
        <section className={cn(glassCardClasses, 'rounded-xl p-6')}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-['Space_Grotesk'] text-[14px] font-medium tracking-[0.05em] uppercase text-[var(--aura-chrome-soft)]">
              {t('trackOrder.summary', 'Order Summary')}
            </h4>
            <Receipt className="w-5 h-5 text-[var(--aura-chrome-soft)]" />
          </div>

          <ul className="space-y-4">
            {items.map((item) => {
              const ItemIcon = item.icon || Coffee;
              return (
                <li
                  key={item.id}
                  className="flex justify-between items-center py-3 border-b border-[var(--aura-chrome-bright)]/10"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[var(--aura-surface-dim)]/60 border border-[var(--aura-chrome-bright)]/10 flex items-center justify-center">
                      <ItemIcon className="w-5 h-5 text-[var(--aura-bronze-shimmer)]" />
                    </div>
                    <div>
                      <p className="font-['Space_Grotesk'] text-[16px] leading-relaxed text-[var(--aura-chrome-bright)]">
                        {item.name}
                      </p>
                      <p className="font-['Space_Grotesk'] text-[12px] font-medium tracking-[0.08em] text-[var(--aura-chrome-soft)]">
                        {t('trackOrder.qty', 'Qty')}: {item.quantity}
                      </p>
                    </div>
                  </div>
                  <span className="font-['Space_Grotesk'] text-[14px] font-medium tracking-[0.05em] text-[var(--aura-chrome-bright)]">
                    ${item.price.toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex justify-between items-center">
            <span className="font-['Space_Grotesk'] text-[14px] font-medium tracking-[0.05em] uppercase text-[var(--aura-chrome-soft)]">
              {t('trackOrder.total', 'TOTAL')}
            </span>
            <span className="font-['Space_Grotesk'] text-[20px] font-bold leading-tight text-[var(--aura-bronze-shimmer)]">
              ${total.toFixed(2)}
            </span>
          </div>
        </section>

        {/* Primary Action */}
        <div className="pt-4">
          <button
            onClick={onTrackMap}
            className="w-full h-16 bg-[var(--aura-bronze-shimmer)] text-white font-['Space_Grotesk'] text-[14px] font-medium tracking-[0.2em] uppercase rounded-xl flex items-center justify-center gap-3 transition-transform active:scale-95 duration-150"
            style={{ boxShadow: '0 0 15px rgba(212, 165, 116, 0.4)' }}
          >
            <MapPin className="w-5 h-5" />
            {t('trackOrder.trackMap', 'TRACK ON MAP')}
          </button>
        </div>

        {/* Map context overlay */}
        <div className="mt-12 mb-20 opacity-60">
          <div className={cn(glassCardClasses, 'w-full h-32 rounded-xl overflow-hidden relative grayscale contrast-125')}>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage:
                  'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA90WxYaHlUtsvBh5534XaBjg3-fyQzGcu9QrG8G_nEQu4rgCaHQbZzovFYquvVmqJ_sOldR6kY6wTGueiGtBVeKCTFkLR0fA-CcWscaVkcZ26ZYtbSXO76dQQWSpoLYCaBK-zl_h4QrJ0zHmHn0xUz131HlKl8mLPvzFCqI7ADhgbPX4bx1RlFukblIah1zs6ntPM1SOcoMvHdnxxj5T1DSAULw3dUQbMCDPP3dI-09iV0EDvwWAj0ga_AWpjCaxj2DO_NAcMyMjo")',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-surface-dim)] to-transparent" />
          </div>
        </div>
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 w-full z-50 backdrop-blur-xl bg-[var(--aura-surface-dim)]/80 border-t border-[var(--aura-chrome-soft)]/10 px-5 py-2 pb-safe">
        <div className="flex justify-around items-center w-full">
          <button
            onClick={() => onNavigate?.('/menu')}
            className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] hover:text-[var(--aura-bronze-shimmer)] transition-colors active:scale-95 transition-transform duration-150"
          >
            <UtensilsCrossed className="w-6 h-6" />
            <span className="font-['Space_Grotesk'] text-[12px] font-medium tracking-[0.08em] mt-1">
              {t('nav.menu', 'Menu')}
            </span>
          </button>

          <button
            onClick={() => onNavigate?.('/orders')}
            className="flex flex-col items-center justify-center text-[var(--aura-bronze-shimmer)] bg-[var(--aura-bronze-shimmer)]/10 rounded-xl px-4 py-1 active:scale-95 transition-transform duration-150"
          >
            <Receipt className="w-6 h-6" />
            <span className="font-['Space_Grotesk'] text-[12px] font-medium tracking-[0.08em] mt-1">
              {t('nav.orders', 'Orders')}
            </span>
          </button>

          <button
            onClick={() => onNavigate?.('/profile')}
            className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] hover:text-[var(--aura-bronze-shimmer)] transition-colors active:scale-95 transition-transform duration-150"
          >
            <User className="w-6 h-6" />
            <span className="font-['Space_Grotesk'] text-[12px] font-medium tracking-[0.08em] mt-1">
              {t('nav.profile', 'Profile')}
            </span>
          </button>
        </div>
      </nav>

      {/* Keyframes for bronze pulse animation */}
      <style>{`
        @keyframes aura-pulse-bronze {
          0% { transform: rotate(45deg) scale(1); opacity: 1; }
          50% { transform: rotate(45deg) scale(1.2); opacity: 0.7; }
          100% { transform: rotate(45deg) scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
