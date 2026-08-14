/**
 * StitchAbout — AURA CAFE Story, Timeline & Spaces (Stitch design)
 *
 * Dark navy glassmorphism about page with hero, bento story grid,
 * vertical timeline, values cards, zones grid, and CTA banner.
 * Source: Stitch AI about/design.html export.
 * Mobile-first responsive.
 */
'use client';

import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';

/* ─── Re-export types for backward compatibility ──────────────────── */
export type {
  Zone,
  TimelinePhase,
  StoryCard,
  ValueCard,
  AboutPageData,
  LoadingState,
  StitchAboutProps,
} from './stitch-about-types';

/* ─── Imports ────────────────────────────────────────────────────── */
import type { StitchAboutProps } from './stitch-about-types';
import { AboutSkeleton } from './stitch-about-skeleton';
import { AboutError } from './stitch-about-error';
import { AboutEmpty } from './stitch-about-empty';
import { HeaderNav } from './stitch-about-header-nav';
import { HeroSection } from './stitch-about-hero-section';
import { StorySection } from './stitch-about-story-section';
import { TimelineSection } from './stitch-about-timeline-section';
import { ValuesSection } from './stitch-about-values-section';
import { ZonesSection } from './stitch-about-zones-section';
import { TeamSection } from './stitch-about-team-section';
import { CtaSection } from './stitch-about-cta-section';
import { AboutFooter } from './stitch-about-footer';
import { useDefaultAboutData } from './stitch-about-default-data';

/* ─── Main Component ─────────────────────────────────────────────── */

export default function StitchAbout({
  data: externalData,
  loadingState = 'idle',
  errorMessage = 'An unexpected error occurred. Please try again.',
  onCtaClick,
  onZoneClick,
}: Readonly<StitchAboutProps>) {
  const { t } = useTranslation();
  const defaultAboutData = useDefaultAboutData();

  const data = externalData ?? defaultAboutData;

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <AboutSkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-[var(--aura-container-padding,24px)]"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <AboutError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.storyCards.length === 0) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-[var(--aura-container-padding,24px)]"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <AboutEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pt-16"
      style={{
        backgroundColor: 'var(--aura-bg-page, #0A1A2E)',
        color: 'var(--aura-text-primary, #e8e8e8)',
      }}
    >
      <HeaderNav />

      <Helmet>
        <title>{t('aboutSeoTitle', 'Khong Gian Container — AURA CAFE Sa Dec')}</title>
        <meta name="description" content={t('aboutSeoDescription', 'Kham pha cau chuyen va khong gian container doc dao tai AURA CAFE')} />
      </Helmet>

      <HeroSection subtitle={data.heroSubtitle} title={data.heroTitle} />
      <StorySection title={t('about.storyTitle')} lead={data.storyLead} cards={data.storyCards} />
      <TimelineSection phases={data.timelinePhases} />
      <ValuesSection values={data.values} />
      <ZonesSection zones={data.zones} onZoneClick={onZoneClick} />
      <CtaSection onCtaClick={onCtaClick} />
      <TeamSection />
      <AboutFooter />

      {/* Custom styles */}
      <style>{`
        .glass-card-about {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--aura-border-muted, rgba(168, 169, 173, 0.2));
        }
        .chrome-border-top {
          border-top: 1px solid var(--aura-border-muted-strong, rgba(168, 169, 173, 0.4));
        }
        .timeline-line-about {
          background: linear-gradient(to bottom, transparent, var(--aura-chrome-light) 15%, var(--aura-chrome-light) 85%, transparent);
        }
      `}</style>
    </div>
  );
}
