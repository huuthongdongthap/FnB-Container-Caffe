/**
 * StitchContactNew — Contact page for AURA CAFE
 *
 * Regenerated from the original Stitch HTML export:
 *   stitch-exports/new-screens/contact.html
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
import { Header } from './StitchContactNew-header';
import { ContactInfoCard } from './StitchContactNew-contact-info';
import { ContactFormCard } from './StitchContactNew-contact-form';
import { MapSection } from './StitchContactNew-map-section';
import { Footer } from './StitchContactNew-footer';

/* ─── Re-exports for backward compatibility ─────────────────────── */

export type { StitchContactNewProps } from './StitchContactNew-types';
export { SocialIconButton } from './StitchContactNew-social-icon';
export { FormField } from './StitchContactNew-form-field';
export { glassPanelClasses, FOOTER_LINKS } from './StitchContactNew-constants';

import type { StitchContactNewProps } from './StitchContactNew-types';

/* ─── Component ─────────────────────────────────────────────────── */

export function StitchContactNew({
  onSubmit,
  onNavigate,
  isSubmitting,
}: StitchContactNewProps) {
  return (
    <>
      <HelmetHead
        title="Contact"
        description="Visit AURA CAFE at 39 Nguyen Tat Thanh, Sa Dec, Dong Thap, Vietnam. Get in touch with our team."
      />

      <Header onNavigate={onNavigate} />

      <main className="pt-16 min-h-screen bg-[var(--aura-surface-dim)]">
        {/* Hero Section */}
        <section className="relative h-[353px] md:h-[442px] flex items-center px-6 overflow-hidden">
          <div className="relative z-10 w-full">
            <p className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-bronze-shimmer)] mb-2">
              LOCATION &amp; ENQUIRIES
            </p>
            <h1 className="font-['EB_Garamond'] text-[36px] md:text-[48px] leading-none tracking-tighter uppercase max-w-xl text-[var(--aura-chrome-bright)]">
              Connect with{'\n'}the Aura
            </h1>
          </div>

          {/* Texture overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay"
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAFXTs155hge8D4zE7vJmkngZEEj_vs9UbJb7SixusWpzPIrw4p1IMr17yLfQNRrDrDOC2U6GAgU7dfnyttYqtV0VV3OnBdrHPEn9LVoel9dLJZvFC28PMVrGnn2R-qhHt7bOfGpe4ibKuhLH9az0Gxo1xTwlvasKquSy1fRqxj25LLmJFFdx0YL9kQeBbM_LCgnzwFBldFvK7Al_5vkT9uxtts5TXomUvGaUyyA68lq0hdci5hyUIbuX6ExpHgm9ZDtFaV988Jimo")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        </section>

        {/* Content Grid */}
        <div className="px-6 pb-12 max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-4">
          <ContactInfoCard onNavigate={onNavigate} />
          <ContactFormCard onSubmit={onSubmit} isSubmitting={isSubmitting} />
          <MapSection />
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </>
  );
}
