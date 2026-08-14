import type { StitchLandingNewProps } from './StitchLandingNew-types';
import { defaultHeroBgUrl, defaultGalleryMainUrl, defaultGalleryInsetUrl, defaultLocationMapUrl } from './stitch-landing-defaults';
import { useGlassPanelEffect } from './use-stitch-landing';
import { LandingNav } from './StitchLandingNew-nav';
import { HeroSection } from './StitchLandingNew-hero';
import { FeaturesSection } from './StitchLandingNew-features';
import { GallerySection } from './StitchLandingNew-gallery';
import { LocationSection } from './StitchLandingNew-location';
import { LandingFooter } from './StitchLandingNew-footer';

export type { StitchLandingNewProps };

/**
 * AURA Cafe landing page — container-coffee experience.
 * Composes nav, hero, features, gallery, location, and footer sections.
 */
export function StitchLandingNew({
  heroBgUrl = defaultHeroBgUrl,
  galleryMainUrl = defaultGalleryMainUrl,
  galleryInsetUrl = defaultGalleryInsetUrl,
  locationMapUrl = defaultLocationMapUrl,
}: Readonly<StitchLandingNewProps>) {
  const containerRef = useGlassPanelEffect();

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: 'var(--aura-surface-dim)',
        color: 'var(--aura-chrome-bright)',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <LandingNav />

      <main className="relative pt-24 min-h-screen">
        {/* Decorative background elements */}
        <div
          className="absolute inset-0 z-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(90deg, rgba(30, 41, 59, 0.5) 1px, transparent 1px)',
            backgroundSize: '80px 100%',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute top-1/4 -right-24 w-96 h-96 rounded-full blur-[120px] pointer-events-none"
          style={{ backgroundColor: 'color-mix(in srgb, var(--aura-chrome-bright) 10%, transparent)' }}
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1/4 -left-24 w-96 h-96 rounded-full blur-[120px] pointer-events-none"
          style={{ backgroundColor: 'color-mix(in srgb, var(--aura-noir-void) 10%, transparent)' }}
          aria-hidden="true"
        />

        <HeroSection heroBgUrl={heroBgUrl} />
        <FeaturesSection />
        <GallerySection galleryMainUrl={galleryMainUrl} galleryInsetUrl={galleryInsetUrl} />
        <LocationSection locationMapUrl={locationMapUrl} />
      </main>

      <LandingFooter />
    </div>
  );
}

export default StitchLandingNew;
