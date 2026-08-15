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
import { Coffee, Croissant, MapPin } from 'lucide-react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { AURA_PULSE_KEYFRAMES } from './StitchTrackOrderNew-constants';
import { TopBar } from './StitchTrackOrderNew-top-bar';
import { OrderHero } from './StitchTrackOrderNew-order-hero';
import { OrderTimeline } from './StitchTrackOrderNew-order-timeline';
import { OrderSummary } from './StitchTrackOrderNew-order-summary';
import { MapOverlay } from './StitchTrackOrderNew-map-overlay';
import { BottomNav } from './StitchTrackOrderNew-bottom-nav';

/* ─── Re-exports for backward compatibility ─────────────────────── */

export type { TrackOrderItem, StitchTrackOrderNewProps } from './StitchTrackOrderNew-types';
export { TimelineStep } from './StitchTrackOrderNew-timeline-step';

/* ─── Default props ─────────────────────────────────────────────── */

const defaultProps = {
  orderId: '#AC-8842',
  estimatedMinutes: 8,
  items: [
    { id: '1', name: 'Midnight Espresso', quantity: 1, price: 6.5, icon: Coffee },
    { id: '2', name: 'Silver Leaf Pastry', quantity: 1, price: 8.0, icon: Croissant },
  ],
  total: 14.5,
};

/* ─── Component ─────────────────────────────────────────────────── */

export function StitchTrackOrderNew({
  orderId = defaultProps.orderId,
  estimatedMinutes = defaultProps.estimatedMinutes,
  items = defaultProps.items,
  total = defaultProps.total,
  onTrackMap,
  onBack,
  onNavigate,
}: import('./StitchTrackOrderNew-types').StitchTrackOrderNewProps) {
  const { t } = useTranslation();

  return (
    <>
      <HelmetHead
        title="Order Status"
        description="Track your AURA CAFE order in real-time. Estimated arrival time and order progress."
      />

      <TopBar onBack={onBack} />

      <main className="max-w-[1200px] mx-auto px-5 pt-8 space-y-8 min-h-screen pb-32">
        <OrderHero orderId={orderId} estimatedMinutes={estimatedMinutes} />

        <OrderTimeline />

        <OrderSummary items={items} total={total} />

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

        <MapOverlay />
      </main>

      <BottomNav onNavigate={onNavigate} />

      <style>{AURA_PULSE_KEYFRAMES}</style>
    </>
  );
}
