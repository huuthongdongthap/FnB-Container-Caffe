/**
 * StitchNotFoundNew — 404 error screen for AURA CAFE
 *
 * Regenerated from the original Stitch HTML export:
 *   stitch-exports/new-screens/404-not-found.html
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
import { BackgroundOverlays } from './StitchNotFoundNew-BackgroundOverlays';
import { Header } from './StitchNotFoundNew-Header';
import { Content } from './StitchNotFoundNew-Content';
import { Footer } from './StitchNotFoundNew-Footer';
import type { StitchNotFoundNewProps } from './StitchNotFoundNew-types';

export type { StitchNotFoundNewProps } from './StitchNotFoundNew-types';

export function StitchNotFoundNew({
  onNavigateHome,
  onSearch,
  onHelp,
  onNavigate,
}: StitchNotFoundNewProps) {
  return (
    <>
      <HelmetHead
        title="Not Found"
        description="Page not found — Khong tim thay trang. Return to AURA CAFE homepage."
      />

      <BackgroundOverlays />

      <Header onNavigate={onNavigate} />

      <Content
        onNavigateHome={onNavigateHome}
        onSearch={onSearch}
        onHelp={onHelp}
      />

      <Footer onNavigate={onNavigate} />

      <style>{`
        @keyframes aura-orb-drift-404 {
          from { transform: translate(-10%, -10%); }
          to { transform: translate(10%, 10%); }
        }
      `}</style>
    </>
  );
}
