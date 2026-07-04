/**
 * StitchContainerNew1 — AURA CAFE Luxury Container Cafe landing page (Stitch design, New v1)
 *
 * Dark navy glassmorphism landing: hero, container aesthetic bento grid,
 * nocturnal lounge, evening selections menu, and footer.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_luxury_container_cafe_1/code.html export.
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  imageAlt: string;
}

export interface NocturnalFeature {
  id: string;
  number: string;
  title: string;
  description: string;
}

export interface ContainerCafeData {
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroImageUrl: string;
  heroImageAlt: string;
  sectionTitle: string;
  featureCardTitle: string;
  featureCardText: string;
  featureImageUrl: string;
  featureImageAlt: string;
  detailCards: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    highlight?: boolean;
  }>;
  loungeTag: string;
  loungeTitle: string;
  loungeDescription: string;
  loungeImageUrl: string;
  loungeImageAlt: string;
  loungeFeatures: NocturnalFeature[];
  menuSectionTitle: string;
  menuSectionSubtitle: string;
  menuItems: MenuItem[];
}

export type LoadingState = 'idle' | 'loading' | 'error';

export interface StitchContainerNew1Props {
  data?: ContainerCafeData;
  loadingState?: LoadingState;
  errorMessage?: string;
  onReservation?: () => void;
  onExploreMenu?: () => void;
  onViewSpace?: () => void;
  onMenuItemClick?: (itemId: string) => void;
}

/* ─── SVG Icon Components ─────────────────────────────────────────── */

function ArrowDownIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

function LayersIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <rect x="3" y="3" width="18" height="9" rx="1" />
      <rect x="3" y="14" width="18" height="7" rx="1" />
    </svg>
  );
}

function PrecisionIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PublicIcon({ className = 'h-5 w-5', ...rest }: { className?: string; [key: string]: unknown }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z" />
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

function ShareIcon({ className = 'h-5 w-5', ...rest }: { className?: string; [key: string]: unknown }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ContainerCafeSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
      {/* Nav skeleton */}
      <div className="fixed top-0 z-50 w-full" style={{ backgroundColor: 'rgba(12, 32, 56, 0.6)', backdropFilter: 'blur(12px)' }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-8 py-6">
          <div className="h-6 w-32 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="hidden gap-6 md:flex">
            <div className="h-4 w-12 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
            <div className="h-4 w-14 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
            <div className="h-4 w-16 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          </div>
          <div className="h-10 w-28 animate-pulse rounded-full" style={{ backgroundColor: '#23364e' }} />
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="flex min-h-screen items-center justify-center px-8 pt-20">
        <div className="mx-auto max-w-4xl space-y-6 text-center">
          <div className="mx-auto h-4 w-40 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="mx-auto h-16 w-3/4 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="mx-auto h-4 w-full max-w-xl animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="mx-auto h-4 w-3/4 max-w-md animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
            <div className="h-12 w-44 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
            <div className="h-12 w-36 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="mx-auto max-w-[1200px] space-y-12 px-8 pb-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="h-96 animate-pulse rounded-xl md:col-span-7" style={{ backgroundColor: 'rgba(18, 37, 61, 0.6)' }} />
          <div className="flex flex-col gap-6 md:col-span-5">
            <div className="h-40 animate-pulse rounded-xl" style={{ backgroundColor: 'rgba(18, 37, 61, 0.6)' }} />
            <div className="h-40 animate-pulse rounded-xl" style={{ backgroundColor: 'rgba(18, 37, 61, 0.6)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

function ContainerCafeError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'rgba(12, 32, 56, 0.8)' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="#ffb4ab" strokeWidth={1.5} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('common.error')}
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function ContainerCafeEmpty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'rgba(12, 32, 56, 0.8)' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="#5a6270" strokeWidth={1.5} aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9h6M9 13h6M9 17h4" />
      </svg>
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('common.noData')}
      </h3>
    </div>
  );
}

/* ─── Sub-components ───────────────────────────────────────────────── */

function SiteHeader({ onReservation }: { onReservation?: () => void }) {
  const { t } = useTranslation();
  return (
    <header
      className="fixed top-0 z-50 w-full border-b shadow-sm"
      style={{
        backgroundColor: 'rgba(12, 32, 56, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderColor: 'rgba(68, 71, 77, 0.15)',
      }}
      aria-label={t('common.mainNavigation')}
    >
      <nav className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-8 py-6">
        <div
          className="text-2xl uppercase tracking-widest"
          style={{
            fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
            color: 'var(--aura-text-primary, #e8e8e8)',
          }}
        >
          AURA CAFE
        </div>

        <div className="hidden items-center gap-12 md:flex">
          <a
            href="#"
            className="border-b-2 pb-1 text-sm font-bold uppercase tracking-[0.1em] transition-colors"
            style={{
              fontFamily: "var(--aura-font-body)",
              color: 'var(--aura-primary, #c6c6c7)',
              borderColor: 'var(--aura-primary, #c6c6c7)',
            }}
            aria-current="page"
          >
            {t('containerNew1.home')}
          </a>
          <a
            href="#"
            className="text-sm uppercase tracking-[0.1em] transition-colors"
            style={{
              fontFamily: "var(--aura-font-body)",
              color: 'var(--aura-text-secondary, #a0a8b0)',
            }}
          >
            {t('containerNew1.menu')}
          </a>
          <a
            href="#"
            className="text-sm uppercase tracking-[0.1em] transition-colors"
            style={{
              fontFamily: "var(--aura-font-body)",
              color: 'var(--aura-text-secondary, #a0a8b0)',
            }}
          >
            {t('containerNew1.location')}
          </a>
        </div>

        <button
          type="button"
          onClick={onReservation}
          className="rounded-full px-6 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-all hover:scale-105"
          style={{
            fontFamily: "var(--aura-font-body)",
            backgroundColor: '#efbd8a',
            color: '#472a03',
          }}
          aria-label={t('containerNew1.reservation')}
        >
          {t('containerNew1.reservation')}
        </button>
      </nav>
    </header>
  );
}

function HeroSection({
  data,
  onExploreMenu,
  onViewSpace,
}: {
  data: ContainerCafeData;
  onExploreMenu?: () => void;
  onViewSpace?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="relative flex h-screen items-center justify-center overflow-hidden pt-32"
      aria-label={t('containerNew1.heroAriaLabel')}
    >
      {/* Dark overlay background */}
      <div className="absolute inset-0" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }} />

      {/* Content */}
      <div className="relative z-10 max-w-4xl px-8 text-center">
        <span
          className="mb-6 block text-sm uppercase tracking-[0.3em]"
          style={{
            fontFamily: "var(--aura-font-body)",
            color: '#efbd8a',
          }}
        >
          {data.heroTag}
        </span>

        <h1
          className="mb-6 text-5xl leading-tight md:text-7xl"
          style={{
            fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
            color: 'var(--aura-text-primary, #e8e8e8)',
          }}
        >
          {data.heroTitle}
          <br />
          <span className="italic font-normal">{data.heroSubtitle}</span>
        </h1>

        <p
          className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed"
          style={{
            fontFamily: "var(--aura-font-body)",
            color: 'var(--aura-text-secondary, #a0a8b0)',
          }}
        >
          {data.heroDescription}
        </p>

        <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
          <button
            type="button"
            onClick={onExploreMenu}
            className="bronze-glow-container w-full px-12 py-4 text-sm font-bold uppercase tracking-widest transition-all hover:brightness-110 md:w-auto"
            style={{
              fontFamily: "var(--aura-font-body)",
              backgroundColor: '#efbd8a',
              color: '#472a03',
            }}
            aria-label={t('containerNew1.exploreMenu')}
          >
            {t('containerNew1.exploreMenu')}
          </button>
          <button
            type="button"
            onClick={onViewSpace}
            className="btn-chrome-container w-full px-12 py-4 text-sm font-bold uppercase tracking-widest transition-all md:w-auto"
            style={{
              fontFamily: "var(--aura-font-body)",
            }}
            aria-label={t('containerNew1.viewSpace')}
          >
            {t('containerNew1.viewSpace')}
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 opacity-60">
        <span
          className="text-xs uppercase tracking-widest"
          style={{
            fontFamily: "var(--aura-font-body)",
            color: 'var(--aura-primary, #c6c6c7)',
          }}
        >
          {t('containerNew1.scroll')}
        </span>
        <div className="h-12 w-px bg-gradient-to-b from-[var(--aura-primary, #c6c6c7)] to-transparent" />
      </div>
    </section>
  );
}

function DetailCard({
  icon,
  title,
  description,
  highlight = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex-1 p-6',
        highlight && 'border-l-4',
      )}
      style={{
        backgroundColor: 'rgba(18, 37, 61, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: highlight ? undefined : '1px solid rgba(198, 198, 199, 0.15)',
        borderLeftColor: highlight ? '#efbd8a' : undefined,
        borderLeftWidth: highlight ? '4px' : undefined,
      }}
    >
      <div className="mb-3 flex items-center gap-3">
        <span style={{ color: '#efbd8a' }}>{icon}</span>
        <h4
          className="text-sm uppercase tracking-[0.1em]"
          style={{
            fontFamily: "var(--aura-font-body)",
            color: 'var(--aura-primary, #c6c6c7)',
          }}
        >
          {title}
        </h4>
        {highlight && (
          <div
            className="h-2 w-2 animate-pulse rounded-full"
            style={{
              backgroundColor: '#efbd8a',
              boxShadow: '0 0 8px #efbd8a',
            }}
          />
        )}
      </div>
      <p
        className="text-base leading-relaxed"
        style={{
          fontFamily: "var(--aura-font-body)",
          color: 'var(--aura-text-secondary, #a0a8b0)',
        }}
      >
        {description}
      </p>
    </div>
  );
}

function MenuCard({
  item,
  onClick,
}: {
  item: MenuItem;
  onClick?: (id: string) => void;
}) {
  return (
    <article
      className="group cursor-pointer p-6 transition-colors"
      style={{
        backgroundColor: 'rgba(18, 37, 61, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(198, 198, 199, 0.15)',
      }}
      onClick={() => onClick?.(item.id)}
      aria-label={item.name}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(item.id); }}
    >
      <div className="mb-6 aspect-square overflow-hidden" style={{ backgroundColor: '#23364e' }}>
        <img
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          src={item.imageUrl}
          alt={item.imageAlt}
          loading="lazy"
        />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <h4
            className="text-2xl"
            style={{
              fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
              color: 'var(--aura-text-primary, #e8e8e8)',
            }}
          >
            {item.name}
          </h4>
          <p
            className="mt-1 text-xs uppercase tracking-widest"
            style={{
              fontFamily: "var(--aura-font-body)",
              color: '#efbd8a',
            }}
          >
            {item.description}
          </p>
        </div>
        <span
          className="text-sm font-bold uppercase tracking-[0.1em]"
          style={{
            fontFamily: "var(--aura-font-body)",
            color: 'var(--aura-text-primary, #e8e8e8)',
          }}
        >
          {item.price}
        </span>
      </div>
    </article>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

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

  const defaultData: ContainerCafeData = {
    heroTag: t('containerNew1.heroTag'),
    heroTitle: t('containerNew1.heroTitle'),
    heroSubtitle: t('containerNew1.heroSubtitle'),
    heroDescription: t('containerNew1.heroDescription'),
    heroImageUrl: '',
    heroImageAlt: t('containerNew1.heroImageAlt'),
    sectionTitle: t('containerNew1.sectionTitle'),
    featureCardTitle: t('containerNew1.featureCardTitle'),
    featureCardText: t('containerNew1.featureCardText'),
    featureImageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBsJ-aUIE708Rnn2voLZkj1EFSTKYm9uFUUsl4N8kkRvw0mUK2olfYxBo-dx3uuGmzr9Xbj65PpNiXX0qfIpjNj1pq6PMnY2wxKt3DZfqSENNPEwFwR51It_t46VXSlUL-LrfH-Mbui8y4QoLjmgREQQyp_1fwSZy8F-Wubv5T1C51YF_V2edIcW_VmwQOuqLsY_d5b5VsbqhzXau3kfE46n7Wgn4SAY-1dov0z-6Fa3Tvm5f_YVukHL82ZefgiIPbEDjZxYbCkmdk',
    featureImageAlt: t('containerNew1.featureImageAlt'),
    detailCards: [
      {
        id: 'frosted-glass',
        icon: 'layers',
        title: t('containerNew1.frostedGlassTitle'),
        description: t('containerNew1.frostedGlassDesc'),
      },
      {
        id: 'chrome-bronze',
        icon: 'precision_manufacturing',
        title: t('containerNew1.chromeBronzeTitle'),
        description: t('containerNew1.chromeBronzeDesc'),
        highlight: true,
      },
    ],
    loungeTag: t('containerNew1.loungeTag'),
    loungeTitle: t('containerNew1.loungeTitle'),
    loungeDescription: t('containerNew1.loungeDescription'),
    loungeImageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCvEFA1n0gDJ7sY-7Kf08hzbSpUGSfNrJaB4u1K95Kd3SxOsBa8XqPdqOh5YFdoL24nY_UnuSGW0UIal6mxwS1EsohB4InWFDMvbaHx1VSHzFTlgQ5shAyGEXnc5dfQN_E_p-0td8GKICCe5jihht0-pKTrxDg-1jXyLytANRaea1_TQZJwUMuDSvhHgGnMFHW2YLoXz4FTQ0HAUcBDNXLHR3A_4Q1B6UOSESHqI5jPZ7plyVt_-SyBl7BKSNS1nEG7FdQ7Psa3eNM',
    loungeImageAlt: t('containerNew1.loungeImageAlt'),
    loungeFeatures: [
      {
        id: 'soundscapes',
        number: '01',
        title: t('containerNew1.soundscapesTitle'),
        description: t('containerNew1.soundscapesDesc'),
      },
      {
        id: 'artisanal-brews',
        number: '02',
        title: t('containerNew1.artisanalBrewsTitle'),
        description: t('containerNew1.artisanalBrewsDesc'),
      },
    ],
    menuSectionTitle: t('containerNew1.menuSectionTitle'),
    menuSectionSubtitle: t('containerNew1.menuSectionSubtitle'),
    menuItems: [
      {
        id: 'aura-black',
        name: t('containerNew1.auraBlack'),
        description: t('containerNew1.auraBlackDesc'),
        price: '$12',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDp4XjinRclf8CqNnLmIYewjeHbcjniV5nJGvxoD2IjrlUbmkrMcDC_ONgYpcefGbGkMdlu2L4_UqAXjPyez25KFnXUE9J_IY16PganHo5aQ-fIN4adFW5hg3qRq3olg3BCvt8e2JMw55xa1TRDKCVHel6KyODuNzsV9-0uYYZR-c21TyiUrtRkzSSfzWNQBPuHgpQeAibKB0Yy4pCJdLqIExztWIOq3ZSKhKWsJ4bfw3yeK_5l934xHQ9J0JUwEorAHNNnESrw_Go',
        imageAlt: t('containerNew1.auraBlackAlt'),
      },
      {
        id: 'midnight-cold',
        name: t('containerNew1.midnightCold'),
        description: t('containerNew1.midnightColdDesc'),
        price: '$14',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBUzS7x7cFXOR5vzWdE_sSz2STpDN5tNUhDp9WBaIkJ7OpLNpl_ScnMKMmUcvpYc_0LdudBNyGyAJ7r3fVFjVdLjfLDDq4Cg9EO8tgbuZxfMAVCUAXFykHWzPL68JAXnbdCg2tm9rdW7iVavzyYdxEILW-5QfgQ_M2uOOuTd2ZteQHCJI_iAQK8HZ_hQsd7oK_WoWIY5I1yzWiOIyXm1QLIr8E_OKMzNasmpOsiL-oO4exyXNvFrRVPlYKye2ZkGOnom5ONrV2VQx4',
        imageAlt: t('containerNew1.midnightColdAlt'),
      },
      {
        id: 'chrome-velvet',
        name: t('containerNew1.chromeVelvet'),
        description: t('containerNew1.chromeVelvetDesc'),
        price: '$11',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAlc7BYI9NI0PGTmim_5GHC-P_uKaVfNMXUPfsNaXXLQYoqqeRPHA-fMzA32yhTH41h_sMNFkL0gTjPJewjllQw3Inyy3HEZMxPVxMLw2AP0S1Vd-140Tsr8vG6bKu6XREidhYfDlgWetla_Au3nEXBWaSw40-Pci30e-gGXtBMO7VzD4Z-fOy6U0OyN03XE1hYacQT3bmVGS-vjyPFzmEO2eqClIWqLmffgOHNAzW-q_qTv9qz5ORsM7vLFHnbFDOEHAAPLQySrwo',
        imageAlt: t('containerNew1.chromeVelvetAlt'),
      },
    ],
  };

  const data = externalData ?? defaultData;
  const errorMessage = externalErrMsg ?? t('common.error');

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <ContainerCafeSkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center px-8" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
        <ContainerCafeError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.menuItems.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
        <ContainerCafeEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: 'var(--aura-bg-page, #0A1A2E)',
        color: 'var(--aura-text-primary, #e8e8e8)',
        fontFamily: "var(--aura-font-body)",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <SiteHeader onReservation={onReservation} />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <HeroSection
        data={data}
        onExploreMenu={onExploreMenu}
        onViewSpace={onViewSpace}
      />

      {/* ── The Container Aesthetic (Bento Grid) ───────────────── */}
      <section className="mx-auto max-w-[1200px] px-8 pb-20" id="aesthetic" aria-labelledby="aesthetic-heading">
        <div className="mb-6">
          <h2
            id="aesthetic-heading"
            className="text-5xl"
            style={{
              fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
              color: 'var(--aura-text-primary, #e8e8e8)',
            }}
          >
            {data.sectionTitle}
          </h2>
          <div className="mt-3 h-px w-24" style={{ backgroundColor: '#efbd8a' }} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-stretch">
          {/* Main Feature Card */}
          <div
            className="group flex flex-col justify-between p-8 md:col-span-7"
            style={{
              backgroundColor: 'rgba(18, 37, 61, 0.6)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(198, 198, 199, 0.15)',
            }}
          >
            <div>
              <h3
                className="mb-6 text-3xl italic md:text-4xl"
                style={{
                  fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
                  color: '#efbd8a',
                }}
              >
                {data.featureCardTitle}
              </h3>
              <p
                className="text-base leading-relaxed"
                style={{
                  fontFamily: "var(--aura-font-body)",
                  color: 'var(--aura-text-secondary, #a0a8b0)',
                }}
              >
                {data.featureCardText}
              </p>
            </div>

            <div className="relative mt-8 overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
              <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  backgroundColor: 'rgba(18, 37, 61, 0.6)',
                  backdropFilter: 'blur(12px)',
                  opacity: 0.2,
                }}
              />
              <img
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                style={{ filter: 'grayscale(0.5)' }}
                src={data.featureImageUrl}
                alt={data.featureImageAlt}
                loading="lazy"
              />
            </div>
          </div>

          {/* Detail Cards Column */}
          <div className="flex flex-col gap-6 md:col-span-5">
            {data.detailCards.map((card) => (
              <DetailCard
                key={card.id}
                icon={card.id === 'frosted-glass' ? <LayersIcon className="h-5 w-5" /> : <PrecisionIcon className="h-5 w-5" />}
                title={card.title}
                description={card.description}
                highlight={card.highlight}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Nocturnal Lounge ────────────────────────────────────── */}
      <section className="py-20" id="lounge" aria-labelledby="lounge-heading">
        <div
          className="mx-auto flex max-w-[1200px] flex-col overflow-hidden md:flex-row"
          style={{
            backgroundColor: 'rgba(25, 45, 75, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(198, 198, 199, 0.3)',
            borderRadius: '0.75rem',
          }}
        >
          {/* Image side */}
          <div className="relative h-[500px] md:w-1/2">
            <img
              className="h-full w-full object-cover"
              src={data.loungeImageUrl}
              alt={data.loungeImageAlt}
              loading="lazy"
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to right, transparent, #0c2038)',
              }}
            />
          </div>

          {/* Text side */}
          <div className="flex flex-col justify-center p-10 md:w-1/2 md:p-14">
            <span
              className="mb-3 text-xs uppercase tracking-[0.2em]"
              style={{
                fontFamily: "var(--aura-font-body)",
                color: '#efbd8a',
              }}
            >
              {data.loungeTag}
            </span>
            <h2
              id="lounge-heading"
              className="mb-6 text-5xl"
              style={{
                fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
                color: 'var(--aura-text-primary, #e8e8e8)',
              }}
            >
              {data.loungeTitle}
            </h2>
            <p
              className="mb-8 text-lg leading-relaxed"
              style={{
                fontFamily: "var(--aura-font-body)",
                color: 'var(--aura-text-secondary, #a0a8b0)',
              }}
            >
              {data.loungeDescription}
            </p>

            <div className="space-y-6">
              {data.loungeFeatures.map((feature) => (
                <div
                  key={feature.id}
                  className="flex items-start gap-6 pb-6"
                  style={{ borderBottom: '0.5px solid rgba(198, 198, 199, 0.4)' }}
                >
                  <span
                    className="text-2xl italic"
                    style={{
                      fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
                      color: '#efbd8a',
                    }}
                  >
                    {feature.number}
                  </span>
                  <div>
                    <h5
                      className="mb-1 text-sm uppercase tracking-[0.1em]"
                      style={{
                        fontFamily: "var(--aura-font-body)",
                        color: 'var(--aura-text-primary, #e8e8e8)',
                      }}
                    >
                      {feature.title}
                    </h5>
                    <p
                      className="text-base"
                      style={{
                        fontFamily: "var(--aura-font-body)",
                        color: 'var(--aura-text-secondary, #a0a8b0)',
                      }}
                    >
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Evening Selections (Menu Preview) ──────────────────── */}
      <section className="mx-auto max-w-[1200px] space-y-10 px-8 pb-20" aria-labelledby="menu-heading">
        <div className="text-center">
          <h2
            id="menu-heading"
            className="text-5xl"
            style={{
              fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
              color: 'var(--aura-text-primary, #e8e8e8)',
            }}
          >
            {data.menuSectionTitle}
          </h2>
          <p
            className="mt-3 text-sm uppercase tracking-widest"
            style={{
              fontFamily: "var(--aura-font-body)",
              color: 'var(--aura-primary, #c6c6c7)',
            }}
          >
            {data.menuSectionSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {data.menuItems.map((item) => (
            <MenuCard key={item.id} item={item} onClick={onMenuItemClick} />
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer
        className="w-full border-t py-20"
        style={{
          backgroundColor: 'var(--aura-bg-surface, #071c33)',
          borderColor: 'rgba(68, 71, 77, 0.4)',
        }}
        aria-label={t('common.footer')}
      >
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-8 text-center">
          <div
            className="text-2xl uppercase tracking-widest"
            style={{
              fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
              color: 'var(--aura-primary, #c6c6c7)',
            }}
          >
            AURA CAFE
          </div>

          <div className="flex gap-12">
            <a
              href="#"
              className="text-sm uppercase tracking-widest opacity-80 transition-all hover:opacity-100"
              style={{
                fontFamily: "var(--aura-font-body)",
                color: 'var(--aura-text-secondary, #a0a8b0)',
              }}
            >
              {t('common.privacyPolicy')}
            </a>
            <a
              href="#"
              className="text-sm uppercase tracking-widest opacity-80 transition-all hover:opacity-100"
              style={{
                fontFamily: "var(--aura-font-body)",
                color: 'var(--aura-text-secondary, #a0a8b0)',
              }}
            >
              {t('common.termsOfService')}
            </a>
            <a
              href="#"
              className="text-sm uppercase tracking-widest opacity-80 transition-all hover:opacity-100"
              style={{
                fontFamily: "var(--aura-font-body)",
                color: 'var(--aura-text-secondary, #a0a8b0)',
              }}
            >
              {t('containerNew1.contact')}
            </a>
          </div>

          <p
            className="mt-4 text-xs uppercase tracking-widest"
            style={{
              fontFamily: "var(--aura-font-body)",
              color: 'rgba(197, 198, 205, 0.6)',
            }}
          >
            {t('containerNew1.copyright', { year: new Date().getFullYear() })}
          </p>

          <div className="mt-4 flex gap-6">
            <div
              className="group flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
              style={{
                borderColor: 'rgba(198, 198, 199, 0.2)',
              }}
              aria-label={t('containerNew1.socialWebsite')}
              role="button"
              tabIndex={0}
            >
              <PublicIcon className="h-5 w-5 transition-colors group-hover:text-[#efbd8a]" />
            </div>
            <div
              className="group flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
              style={{
                borderColor: 'rgba(198, 198, 199, 0.2)',
              }}
              aria-label={t('containerNew1.socialShare')}
              role="button"
              tabIndex={0}
            >
              <ShareIcon className="h-5 w-5 transition-colors group-hover:text-[#efbd8a]" />
            </div>
          </div>
        </div>
      </footer>

      {/* Custom styles */}
      <style>{`
        .bronze-glow-container {
          box-shadow: 0 0 15px rgba(212, 165, 116, 0.3);
        }
        .bronze-glow-container:hover {
          box-shadow: 0 0 25px rgba(212, 165, 116, 0.6);
        }
        .btn-chrome-container {
          background: transparent;
          border: 0.5px solid var(--aura-primary, #c6c6c7);
          color: var(--aura-primary, #c6c6c7);
          position: relative;
          overflow: hidden;
        }
        .btn-chrome-container:hover {
          background: rgba(198, 198, 199, 0.1);
          box-shadow: 0 0 15px rgba(198, 198, 199, 0.2);
        }
      `}</style>
    </div>
  );
}
