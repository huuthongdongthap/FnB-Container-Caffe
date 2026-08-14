/**
 * StitchContainerNew1 — AURA CAFE Luxury Container Cafe landing page
 *
 * Pixel-perfect match of the original Stitch HTML export.
 * Dark navy glassmorphism landing with hero, bento grid, nocturnal lounge,
 * evening selections menu, and footer. Mobile-first responsive. Named export.
 */
'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/* ─── Re-export types for backward compatibility ──────────────────── */
export type {
  MenuItem,
  NocturnalFeature,
  ContainerCafeData,
  LoadingState,
  StitchContainerNew1Props,
} from './stitch-container-new1-types';

/* ─── Imports ────────────────────────────────────────────────────── */
import type { StitchContainerNew1Props, ContainerCafeData } from './stitch-container-new1-types';
import { ContainerCafeSkeleton } from './stitch-container-new1-skeleton';
import { ContainerCafeError } from './stitch-container-new1-error';
import { ContainerCafeEmpty } from './stitch-container-new1-empty';
import { SiteHeader } from './stitch-container-new1-site-header';
import { HeroSection } from './stitch-container-new1-hero-section';
import { BentoSection } from './stitch-container-new1-bento-section';
import { LoungeSection } from './stitch-container-new1-lounge-section';
import { EveningMenu } from './stitch-container-new1-evening-menu';
import { ContainerCafeFooter } from './stitch-container-new1-footer';
import { buildDefaultContainerData } from './stitch-container-new1-default-data';

/* ─── Main Component ─────────────────────────────────────────────── */

export function StitchContainerNew1({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrMsg,
  onReservation,
  onExploreMenu,
  onViewSpace,
  onMenuItemClick,
}: Readonly<StitchContainerNew1Props>) {
  const { t } = useTranslation();

  const defaultData: ContainerCafeData = buildDefaultContainerData(t);
  const data = externalData ?? defaultData;
  const errorMessage = externalErrMsg ?? t('common.error');

  /* ─── Scroll-reveal Effect ──────────────────────────────────── */
  useEffect(() => {
    const handleScroll = () => {
      const panels = document.querySelectorAll('.glass-panel');
      panels.forEach((panel) => {
        const el = panel as HTMLElement;
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.8) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }
      });
    };

    const panels = document.querySelectorAll('.glass-panel');
    panels.forEach((panel) => {
      const el = panel as HTMLElement;
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)';
    });

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <ContainerCafeSkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center px-8" style={{ backgroundColor: '#00142b' }}>
        <ContainerCafeError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.menuItems.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8" style={{ backgroundColor: '#00142b' }}>
        <ContainerCafeEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden antialiased"
      style={{
        backgroundColor: '#00142b',
        color: 'var(--aura-chrome-bright)',
      }}
    >
      {/* CSS: custom effects matching the original Stitch HTML */}
      <style>{`
        .menu-card:hover {
          border-color: color-mix(in srgb, var(--aura-chrome-bright) 50%, transparent) !important;
        }
        ::selection {
          background-color: var(--aura-chrome-bright);
          color: var(--aura-noir-deep);
        }
      `}</style>

      <SiteHeader onReservation={onReservation} />
      <HeroSection data={data} onExploreMenu={onExploreMenu} onViewSpace={onViewSpace} />

      <main className="mx-auto max-w-[1200px] space-y-20 px-8 py-20">
        <BentoSection data={data} />
        <LoungeSection data={data} />
        <EveningMenu data={data} onMenuItemClick={onMenuItemClick} />
      </main>

      <ContainerCafeFooter />
    </div>
  );
}
