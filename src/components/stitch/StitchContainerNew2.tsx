/**
 * StitchContainerNew2 — AURA CAFE Luxury Container Cafe landing page
 *
 * EXACT match of Stitch design: aura_cafe_luxury_container_cafe_2/code.html
 * Dark navy glassmorphism landing: hero, container aesthetic bento grid,
 * atmosphere parallax section, signature selection menu teaser, footer.
 * Mobile-first responsive. Named export.
 *
 * This is the orchestrator. Sub-components, hooks, and types are in sibling files.
 */
'use client';

import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from './stitch-container-new2-types';
import { useStitchContainerNew2DefaultData } from '@/hooks/use-stitch-container-new2-default-data';
import { useStitchScrollAnimation } from '@/hooks/use-stitch-scroll-animation';
import { ContainerCafeNew2Skeleton } from './stitch-container-new2-skeleton';
import { ContainerCafeNew2Error, ContainerCafeNew2Empty } from './stitch-container-new2-states';
import { SiteHeader } from './stitch-container-new2-site-header';
import { HeroSection } from './stitch-container-new2-hero-section';
import { FeatureCardsSection } from './stitch-container-new2-feature-cards';
import { AtmosphereSection } from './stitch-container-new2-atmosphere-section';
import { MenuTeaserSection } from './stitch-container-new2-menu-teaser';
import { SiteFooter } from './stitch-container-new2-site-footer';

/* Re-export types for backward compatibility */
export type {
  SignatureItem,
  NavLink,
  FeatureCard,
  FooterLinkGroup,
  ContainerCafeNew2Data,
  LoadingState,
  StitchContainerNew2Props,
} from './stitch-container-new2-types';

/* ─── Main Component ───────────────────────────────────────────────── */

export function StitchContainerNew2({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrMsg,
  onReservation,
  onViewGallery,
  onMenuItemClick,
  onNavClick,
}: Readonly<import('./stitch-container-new2-types').StitchContainerNew2Props>) {
  const { t } = useTranslation();
  const defaultData = useStitchContainerNew2DefaultData();
  const { rootRef } = useStitchScrollAnimation();

  const data = externalData ?? defaultData;
  const errorMessage = externalErrMsg ?? t('common.error');

  /* Loading State */
  if (loadingState === 'loading') {
    return <ContainerCafeNew2Skeleton />;
  }

  /* Error State */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center px-5" style={{ backgroundColor: COLORS.background }}>
        <ContainerCafeNew2Error message={errorMessage} />
      </div>
    );
  }

  /* Empty State */
  if (!data || data.featureCards.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5" style={{ backgroundColor: COLORS.background }}>
        <ContainerCafeNew2Empty />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: COLORS.background,
        color: COLORS.onSurface,
        fontFamily: FONTS.body,
        scrollBehavior: 'smooth',
      }}
    >
      <SiteHeader
        navLinks={data.navLinks}
        onNavClick={onNavClick}
        onReservation={onReservation}
      />

      <main className="pt-24">
        <HeroSection
          heroTag={data.heroTag}
          heroTitle={data.heroTitle}
          heroSubtitle={data.heroSubtitle}
          heroDescription={data.heroDescription}
          reservationLabel={data.reservationLabel}
          viewGalleryLabel={data.viewGalleryLabel}
          onReservation={onReservation}
          onViewGallery={onViewGallery}
        />
        <FeatureCardsSection
          sectionTitle={data.sectionTitle}
          cards={data.featureCards}
        />
        <AtmosphereSection
          title={data.atmosphereTitle}
          quote={data.atmosphereQuote}
          attribution={data.atmosphereAttribution}
          bgUrl={data.atmosphereBgUrl}
          bgAlt={data.atmosphereBgAlt}
        />
        <MenuTeaserSection
          sectionTitle={data.menuSectionTitle}
          sectionSubtitle={data.menuSectionSubtitle}
          items={data.signatureItems}
          imageUrl={data.menuImageUrl}
          imageAlt={data.menuImageAlt}
          onMenuItemClick={onMenuItemClick}
        />
      </main>

      <SiteFooter
        logo={data.footerLogo}
        addressLines={data.footerAddressLines}
        email={data.footerEmail}
        linkGroups={data.footerLinkGroups}
        legalLinks={data.legalLinks}
        copyright={data.copyright}
      />

      {/* Custom styles matching original HTML */}
      <style>{`
        .glass-card {
          transition: transform 0.5s, box-shadow 0.5s;
        }
        .glass-card:hover {
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .shimmer-hover {
          position: relative;
          overflow: hidden;
        }
        .shimmer-hover::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--aura-chrome-soft) 10%, transparent), transparent);
          background-size: 200% 100%;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .shimmer-hover:hover::after {
          opacity: 1;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .text-glow:hover {
          text-shadow: 0 0 12px color-mix(in srgb, var(--aura-chrome-bright) 40%, transparent);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        ::selection {
          background-color: var(--aura-chrome-bright);
          color: var(--aura-noir-deep);
        }
        a, button {
          transition: color 0.3s, background-color 0.3s, border-color 0.3s, transform 0.2s, box-shadow 0.3s;
        }
      `}</style>
    </div>
  );
}

export default StitchContainerNew2;
