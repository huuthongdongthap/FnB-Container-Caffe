/**
 * StitchOrderFailureNew — Payment failure screen for AURA CAFE
 *
 * Regenerated from the original Stitch HTML export:
 *   stitch-exports/new-screens/order-failure.html
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

import { HelmetHead } from '@/components/seo/HelmetHead';
import {
  TopAppBar,
  ErrorHeroSection,
  RetryButton,
  PaymentOptionsSection,
} from './StitchOrderFailureNew-sub-components';
import {
  SupportSection,
  AestheticFillerCard,
  BottomNavBar,
} from './StitchOrderFailureNew-bottom-sections';

/* ─── Re-exports for backward compatibility ─────────────────────── */

export type { StitchOrderFailureNewProps } from './StitchOrderFailureNew-types';
export { PaymentOption } from './StitchOrderFailureNew-sub-components';

/* ─── Component ─────────────────────────────────────────────────── */

import type { StitchOrderFailureNewProps } from './StitchOrderFailureNew-types';

export function StitchOrderFailureNew({
  onRetry,
  onPayOS,
  onCOD,
  onChatSupport,
  onCallSupport,
  onNavigate,
  isProcessing,
}: StitchOrderFailureNewProps) {
  return (
    <>
      <HelmetHead
        title="Order Failed"
        description="Payment failed. Please check your card details or try another method for your AURA CAFE order."
      />
      <TopAppBar onNavigate={onNavigate} />
      <main
        className="pt-24 px-6 flex flex-col items-start gap-12 min-h-screen pb-32"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #0c1a2d 0%, var(--aura-surface-dim) 100%)',
        }}
      >
        <ErrorHeroSection />
        <RetryButton onRetry={onRetry} isProcessing={isProcessing} />
        <PaymentOptionsSection onPayOS={onPayOS} onCOD={onCOD} />
        <SupportSection onChatSupport={onChatSupport} onCallSupport={onCallSupport} />
        <AestheticFillerCard />
      </main>
      <BottomNavBar onNavigate={onNavigate} />
    </>
  );
}
