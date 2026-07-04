/**
 * StitchContainerNew1 — AURA CAFE Luxury Container Cafe landing page
 *
 * Pixel-perfect match of the original Stitch HTML export:
 * /tmp/stitch_original/stitch_aura_cafe/aura_cafe_luxury_container_cafe_1/code.html
 *
 * Dark navy glassmorphism landing with hero, bento grid, nocturnal lounge,
 * evening selections menu, and footer. Mobile-first responsive. Named export.
 */
'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Layers, Settings2, Globe, Share2 } from 'lucide-react';

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

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ContainerCafeSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#00142b' }}>
      {/* Nav skeleton */}
      <div
        className="fixed top-0 z-50 w-full"
        style={{ backgroundColor: 'rgba(12, 32, 56, 0.6)', backdropFilter: 'blur(12px)' }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-8 py-6">
          <div className="h-6 w-32 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="hidden gap-12 md:flex">
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
          <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
            <div className="h-12 w-44 animate-pulse rounded-none" style={{ backgroundColor: '#23364e' }} />
            <div className="h-12 w-36 animate-pulse rounded-none" style={{ backgroundColor: '#23364e' }} />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="mx-auto max-w-[1200px] space-y-20 px-8 pb-20">
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
          fontFamily: "'EB Garamond', Georgia, serif",
          color: '#d4e3ff',
        }}
      >
        {t('common.error')}
      </h3>
      <p style={{ color: '#c5c6cd' }}>{message}</p>
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
          fontFamily: "'EB Garamond', Georgia, serif",
          color: '#d4e3ff',
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
      className="fixed top-0 z-50 w-full border-b shadow-sm backdrop-blur-md"
      style={{
        backgroundColor: 'rgba(12, 32, 56, 0.6)',
        borderColor: 'rgba(68, 71, 77, 0.15)',
        WebkitBackdropFilter: 'blur(12px)',
        backdropFilter: 'blur(12px)',
      }}
      aria-label={t('common.mainNavigation', { defaultValue: 'Main Navigation' })}
    >
      <nav className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-8 py-6">
        {/* Brand — text-on-surface (#d4e3ff) per original */}
        <div
          className="text-[24px] leading-[1.4] tracking-widest uppercase"
          style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            color: '#d4e3ff',
          }}
        >
          AURA CAFE
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-12 md:flex">
          <a
            href="/"
            className="border-b-2 pb-1 font-bold"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '14px',
              lineHeight: '1.0',
              letterSpacing: '0.1em',
              color: '#b8c7e2',
              borderColor: '#b8c7e2',
            }}
            aria-current="page"
          >
            {t('containerNew1.home', { defaultValue: 'Home' })}
          </a>
          <a
            href="/menu"
            className="transition-colors"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '14px',
              lineHeight: '1.0',
              letterSpacing: '0.1em',
              color: '#c5c6cd',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#d4e3ff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#c5c6cd'; }}
          >
            {t('containerNew1.menu', { defaultValue: 'Menu' })}
          </a>
          <a
            href="/about"
            className="transition-colors"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '14px',
              lineHeight: '1.0',
              letterSpacing: '0.1em',
              color: '#c5c6cd',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#d4e3ff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#c5c6cd'; }}
          >
            {t('containerNew1.location', { defaultValue: 'Location' })}
          </a>
        </div>

        {/* Reservation button — px-md(24px) py-xs(4px), rounded-full per original */}
        <button
          type="button"
          onClick={onReservation}
          className="rounded-full px-6 transition-transform hover:scale-105 active:scale-95"
          style={{
            paddingTop: '4px',
            paddingBottom: '4px',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '14px',
            lineHeight: '1.0',
            letterSpacing: '0.1em',
            backgroundColor: '#efbd8a',
            color: '#472a03',
          }}
          aria-label={t('containerNew1.reservation', { defaultValue: 'Reservation' })}
        >
          {t('containerNew1.reservation', { defaultValue: 'Reservation' })}
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
      className="relative flex h-screen items-center justify-center overflow-hidden pt-20"
      aria-label={t('containerNew1.heroAriaLabel', { defaultValue: 'Hero Section' })}
    >
      {/* Content */}
      <div className="relative z-10 max-w-4xl px-8 text-center">
        {/* Tag — text-tertiary (#efbd8a), font-label-md, tracking-[0.3em] */}
        <span
          className="mb-6 block text-[14px] uppercase leading-[1.0] tracking-[0.3em]"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: '#efbd8a',
            fontWeight: 500,
          }}
        >
          {data.heroTag}
        </span>

        {/* Title */}
        <h1
          className="mb-6 leading-tight md:text-[80px]"
          style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontSize: '48px',
            color: '#d4e3ff',
            fontWeight: 500,
          }}
        >
          {data.heroTitle}
          <br />
          <span className="font-normal italic">{data.heroSubtitle}</span>
        </h1>

        {/* Description — font-body-lg (18px, lh:1.6) */}
        <p
          className="mx-auto mb-12 max-w-2xl text-lg"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            lineHeight: '1.6',
            color: '#c5c6cd',
          }}
        >
          {data.heroDescription}
        </p>

        <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
          {/* Explore the Menu — rounded-none per original */}
          <button
            type="button"
            onClick={onExploreMenu}
            className="rounded-none px-12 py-3 text-[14px] uppercase leading-[1.0] tracking-widest transition-all"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 500,
              backgroundColor: '#efbd8a',
              color: '#472a03',
              boxShadow: '0 0 15px rgba(212, 165, 116, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 25px rgba(212, 165, 116, 0.6)';
              e.currentTarget.style.backgroundColor = '#efbd8a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 15px rgba(212, 165, 116, 0.3)';
              e.currentTarget.style.backgroundColor = '#efbd8a';
            }}
            aria-label={t('containerNew1.exploreMenu', { defaultValue: 'Explore the Menu' })}
          >
            {t('containerNew1.exploreMenu', { defaultValue: 'Explore the Menu' })}
          </button>
          {/* View Space — border-secondary/30 (rgba 198,198,199,0.3) */}
          <button
            type="button"
            onClick={onViewSpace}
            className="rounded-none px-12 py-3 text-[14px] uppercase leading-[1.0] tracking-widest transition-all"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 500,
              border: '1px solid rgba(198, 198, 199, 0.3)',
              color: '#c6c6c7',
              background: 'transparent',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(198, 198, 199, 0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            aria-label={t('containerNew1.viewSpace', { defaultValue: 'View Space' })}
          >
            {t('containerNew1.viewSpace', { defaultValue: 'View Space' })}
          </button>
        </div>
      </div>

      {/* Scroll indicator — bottom-base (8px) per original */}
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 opacity-60">
        <span
          className="text-xs uppercase tracking-widest"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            lineHeight: '1.0',
            letterSpacing: '0.05em',
            fontWeight: 600,
            color: '#c6c6c7',
          }}
        >
          {t('containerNew1.scroll', { defaultValue: 'Scroll' })}
        </span>
        <div className="h-12 w-[1px] bg-gradient-to-b from-[#c6c6c7] to-transparent" />
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
      className={clsx('glass-panel flex-1', highlight && 'border-l-4')}
      style={{
        padding: '24px',
        backgroundColor: 'rgba(18, 37, 61, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(198, 198, 199, 0.15)',
        borderLeftColor: highlight ? '#efbd8a' : undefined,
        borderLeftWidth: highlight ? '4px' : undefined,
      }}
    >
      <div className="mb-3 flex items-center gap-3">
        <span style={{ color: '#efbd8a' }}>{icon}</span>
        <h4
          className="text-[14px] uppercase leading-[1.0] tracking-[0.1em]"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 500,
            color: '#c6c6c7',
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
        className="text-base"
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          lineHeight: '1.6',
          color: '#c5c6cd',
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
      className="glass-panel group cursor-pointer transition-colors"
      style={{
        padding: '24px',
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
            className="text-[24px] leading-[1.4]"
            style={{
              fontFamily: "'EB Garamond', Georgia, serif",
              color: '#d4e3ff',
              fontWeight: 400,
            }}
          >
            {item.name}
          </h4>
          <p
            className="mt-1 text-xs leading-[1.0] tracking-[0.05em]"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              color: '#efbd8a',
            }}
          >
            {item.description}
          </p>
        </div>
        <span
          className="text-[14px] leading-[1.0] tracking-[0.1em]"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 500,
            color: '#d4e3ff',
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
    heroTag: t('containerNew1.heroTag', { defaultValue: 'Industrial Luxury' }),
    heroTitle: t('containerNew1.heroTitle', { defaultValue: 'AURA CAFE —' }),
    heroSubtitle: t('containerNew1.heroSubtitle', { defaultValue: 'Container Caffe & Space' }),
    heroDescription: t('containerNew1.heroDescription', {
      defaultValue:
        'Experience the intersection of raw industrial aesthetics and premium nocturnal comfort. Our shipping container architecture creates an exclusive haven for the sophisticated coffee connoisseur.',
    }),
    heroImageUrl: '',
    heroImageAlt: t('containerNew1.heroImageAlt', {
      defaultValue:
        'A cinematic architectural shot of a sleek black shipping container cafe at night. The structure features floor-to-ceiling frosted glass panels that emit a soft blue glow.',
    }),
    sectionTitle: t('containerNew1.sectionTitle', { defaultValue: 'The Container Aesthetic' }),
    featureCardTitle: t('containerNew1.featureCardTitle', { defaultValue: 'Industrial Luxury Redefined' }),
    featureCardText: t('containerNew1.featureCardText', {
      defaultValue:
        'Constructed from repurposed high-cube shipping containers, our architecture celebrates the raw beauty of structural steel, softened by curated textures and ambient lighting. Each seam tells a story of global travel, now anchored in a premium urban setting.',
    }),
    featureImageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBsJ-aUIE708Rnn2voLZkj1EFSTKYm9uFUUsl4N8kkRvw0mUK2olfYxBo-dx3uuGmzr9Xbj65PpNiXX0qfIpjNj1pq6PMnY2wxKt3DZfqSENNPEwFwR51It_t46VXSlUL-LrfH-Mbui8y4QoLjmgREQQyp_1fwSZy8F-Wubv5T1C51YF_V2edIcW_VmwQOuqLsY_d5b5VsbqhzXau3kfE46n7Wgn4SAY-1dov0z-6Fa3Tvm5f_YVukHL82ZefgiIPbEDjZxYbCkmdk',
    featureImageAlt: t('containerNew1.featureImageAlt', {
      defaultValue:
        'A cinematic architectural shot of a sleek black shipping container cafe at night. Polished bronze accents and industrial chrome beams under dramatic spotlighting.',
    }),
    detailCards: [
      {
        id: 'frosted-glass',
        icon: 'layers',
        title: t('containerNew1.frostedGlassTitle', { defaultValue: 'Frosted Glass Modules' }),
        description: t('containerNew1.frostedGlassDesc', {
          defaultValue:
            'Translucent panels provide privacy while diffusing the nocturnal urban glow, creating an ethereal inner sanctum.',
        }),
      },
      {
        id: 'chrome-bronze',
        icon: 'precision_manufacturing',
        title: t('containerNew1.chromeBronzeTitle', { defaultValue: 'Chrome & Bronze' }),
        description: t('containerNew1.chromeBronzeDesc', {
          defaultValue:
            'Metallic accents provide a sharp contrast to the matte navy finishes, reflecting the precision of modern design.',
        }),
        highlight: true,
      },
    ],
    loungeTag: t('containerNew1.loungeTag', { defaultValue: 'The Experience' }),
    loungeTitle: t('containerNew1.loungeTitle', { defaultValue: 'Nocturnal Lounge' }),
    loungeDescription: t('containerNew1.loungeDescription', {
      defaultValue:
        'When the sun sets, Aura Cafe transforms. The atmosphere shifts to a sophisticated nocturnal lounge where shadows and light play across metallic surfaces. It’s a space for deep conversation, focused work, or solitary reflection.',
    }),
    loungeImageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCvEFA1n0gDJ7sY-7Kf08hzbSpUGSfNrJaB4u1K95Kd3SxOsBa8XqPdqOh5YFdoL24nY_UnuSGW0UIal6mxwS1EsohB4InWFDMvbaHx1VSHzFTlgQ5shAyGEXnc5dfQN_E_p-0td8GKICCe5jihht0-pKTrxDg-1jXyLytANRaea1_TQZJwUMuDSvhHgGnMFHW2YLoXz4FTQ0HAUcBDNXLHR3A_4Q1B6UOSESHqI5jPZ7plyVt_-SyBl7BKSNS1nEG7FdQ7Psa3eNM',
    loungeImageAlt: t('containerNew1.loungeImageAlt', {
      defaultValue:
        'A moody interior view of a premium nocturnal lounge inside an industrial container space with warm bronze desk lamps and subtle blue neon strips.',
    }),
    loungeFeatures: [
      {
        id: 'soundscapes',
        number: '01',
        title: t('containerNew1.soundscapesTitle', { defaultValue: 'Curated Soundscapes' }),
        description: t('containerNew1.soundscapesDesc', {
          defaultValue: 'Deep ambient and minimalist electronic beats.',
        }),
      },
      {
        id: 'artisanal-brews',
        number: '02',
        title: t('containerNew1.artisanalBrewsTitle', { defaultValue: 'Artisanal Brews' }),
        description: t('containerNew1.artisanalBrewsDesc', {
          defaultValue: 'Single-origin beans roasted specifically for evening consumption.',
        }),
      },
    ],
    menuSectionTitle: t('containerNew1.menuSectionTitle', { defaultValue: 'Evening Selections' }),
    menuSectionSubtitle: t('containerNew1.menuSectionSubtitle', { defaultValue: 'Signature Pairings' }),
    menuItems: [
      {
        id: 'aura-black',
        name: t('containerNew1.auraBlack', { defaultValue: 'Aura Black' }),
        description: t('containerNew1.auraBlackDesc', { defaultValue: 'Double Ristretto + Dark Truffle' }),
        price: '$12',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDp4XjinRclf8CqNnLmIYewjeHbcjniV5nJGvxoD2IjrlUbmkrMcDC_ONgYpcefGbGkMdlu2L4_UqAXjPyez25KFnXUE9J_IY16PganHo5aQ-fIN4adFW5hg3qRq3olg3BCvt8e2JMw55xa1TRDKCVHel6KyODuNzsV9-0uYYZR-c21TyiUrtRkzSSfzWNQBPuHgpQeAibKB0Yy4pCJdLqIExztWIOq3ZSKhKWsJ4bfw3yeK_5l934xHQ9J0JUwEorAHNNnESrw_Go',
        imageAlt: t('containerNew1.auraBlackAlt', {
          defaultValue:
            'A top-down artistic photograph of a premium espresso served in a handcrafted ceramic matte black cup with a dark chocolate truffle dusted with edible gold leaf.',
        }),
      },
      {
        id: 'midnight-cold',
        name: t('containerNew1.midnightCold', { defaultValue: 'Midnight Cold' }),
        description: t('containerNew1.midnightColdDesc', { defaultValue: 'Nitrogen Infused + Botanical Hint' }),
        price: '$14',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBUzS7x7cFXOR5vzWdE_sSz2STpDN5tNUhDp9WBaIkJ7OpLNpl_ScnMKMmUcvpYc_0LdudBNyGyAJ7r3fVFjVdLjfLDDq4Cg9EO8tgbuZxfMAVCUAXFykHWzPL68JAXnbdCg2tm9rdW7iVavzyYdxEILW-5QfgQ_M2uOOuTd2ZteQHCJI_iAQK8HZ_hQsd7oK_WoWIY5I1yzWiOIyXm1QLIr8E_OKMzNasmpOsiL-oO4exyXNvFrRVPlYKye2ZkGOnom5ONrV2VQx4',
        imageAlt: t('containerNew1.midnightColdAlt', {
          defaultValue:
            'A sophisticated cold brew coffee cocktail served in a tall glass with a single oversized clear ice cube, dried lavender sprig, and orange zest garnish.',
        }),
      },
      {
        id: 'chrome-velvet',
        name: t('containerNew1.chromeVelvet', { defaultValue: 'Chrome Velvet' }),
        description: t('containerNew1.chromeVelvetDesc', { defaultValue: 'Smoked Vanilla + Oat Silk' }),
        price: '$11',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAlc7BYI9NI0PGTmim_5GHC-P_uKaVfNMXUPfsNaXXLQYoqqeRPHA-fMzA32yhTH41h_sMNFkL0gTjPJewjllQw3Inyy3HEZMxPVxMLw2AP0S1Vd-140Tsr8vG6bKu6XREidhYfDlgWetla_Au3nEXBWaSw40-Pci30e-gGXtBMO7VzD4Z-fOy6U0OyN03XE1hYacQT3bmVGS-vjyPFzmEO2eqClIWqLmffgOHNAzW-q_qTv9qz5ORsM7vLFHnbFDOEHAAPLQySrwo',
        imageAlt: t('containerNew1.chromeVelvetAlt', {
          defaultValue:
            'A minimalist presentation of a smoked vanilla latte in a clear heat-resistant glass with cinnamon stick, set on a chrome saucer with warm bronze side lighting.',
        }),
      },
    ],
  };

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
        color: '#d4e3ff',
      }}
    >
      {/* CSS: custom effects matching the original Stitch HTML */}
      <style>{`
        .menu-card:hover {
          border-color: rgba(239, 189, 138, 0.5) !important;
        }
        ::selection {
          background-color: #efbd8a;
          color: #472a03;
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <SiteHeader onReservation={onReservation} />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <HeroSection
        data={data}
        onExploreMenu={onExploreMenu}
        onViewSpace={onViewSpace}
      />

      {/* ── Main Content Canvas ────────────────────────────────── */}
      <main className="mx-auto max-w-[1200px] space-y-20 px-8 py-20">
        {/* ── The Container Aesthetic (Bento Grid) ──────────────── */}
        <section id="aesthetic">
          {/* Section heading */}
          <div className="mb-6">
            <h2
              className="text-[48px] leading-[1.1] tracking-[-0.02em]"
              style={{
                fontFamily: "'EB Garamond', Georgia, serif",
                fontWeight: 500,
                color: '#d4e3ff',
              }}
            >
              {data.sectionTitle}
            </h2>
            {/* Divider — w-24, h-[1px], bg-tertiary per original */}
            <div className="mt-3 h-[1px] w-24" style={{ backgroundColor: '#efbd8a' }} />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-stretch">
            {/* Main Feature Card (md:col-span-7) */}
            <div
              className="glass-panel group flex flex-col justify-between md:col-span-7"
              style={{
                padding: '48px',
                backgroundColor: 'rgba(18, 37, 61, 0.6)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(198, 198, 199, 0.15)',
              }}
            >
              <div>
                <h3
                  className="mb-6 text-[32px] leading-[1.3] italic"
                  style={{
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontWeight: 400,
                    color: '#efbd8a',
                  }}
                >
                  {data.featureCardTitle}
                </h3>
                <p
                  className="text-base"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    lineHeight: '1.6',
                    color: '#c5c6cd',
                  }}
                >
                  {data.featureCardText}
                </p>
              </div>

              {/* Image — mt-lg(48px), rounded-lg, aspect-video per original */}
              <div className="relative mt-12 overflow-hidden rounded-lg aspect-video">
                <div
                  className="pointer-events-none absolute inset-0 z-10 opacity-20"
                  style={{
                    backgroundColor: 'rgba(18, 37, 61, 0.6)',
                    backdropFilter: 'blur(12px)',
                  }}
                />
                <img
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[0.5]"
                  src={data.featureImageUrl}
                  alt={data.featureImageAlt}
                  loading="lazy"
                />
              </div>
            </div>

            {/* Detail Cards Column (md:col-span-5) */}
            <div className="flex flex-col gap-6 md:col-span-5">
              {data.detailCards.map((card) => (
                <DetailCard
                  key={card.id}
                  icon={
                    card.id === 'frosted-glass'
                      ? <Layers className="h-5 w-5" />
                      : <Settings2 className="h-5 w-5" />
                  }
                  title={card.title}
                  description={card.description}
                  highlight={card.highlight}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Nocturnal Lounge ──────────────────────────────────── */}
        <section id="lounge" className="py-20">
          <div
            className="flex flex-col overflow-hidden rounded-xl md:flex-row"
            style={{
              backgroundColor: 'rgba(25, 45, 75, 0.8)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(198, 198, 199, 0.3)',
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
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0c2038]" />
            </div>

            {/* Text side — p-xl (80px) per original */}
            <div className="flex flex-col justify-center p-20 md:w-1/2">
              {/* Tag — font-label-sm, text-tertiary per original */}
              <span
                className="mb-3 text-xs uppercase leading-[1.0] tracking-[0.2em]"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  color: '#efbd8a',
                }}
              >
                {data.loungeTag}
              </span>

              <h2
                className="mb-6 text-[48px] leading-[1.1] tracking-[-0.02em]"
                style={{
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontWeight: 500,
                  color: '#d4e3ff',
                }}
              >
                {data.loungeTitle}
              </h2>

              <p
                className="mb-12 text-lg"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  lineHeight: '1.6',
                  color: '#c5c6cd',
                }}
              >
                {data.loungeDescription}
              </p>

              {/* Features */}
              <div className="space-y-6">
                {data.loungeFeatures.map((feature) => (
                  <div
                    key={feature.id}
                    className="flex items-start gap-6 pb-6"
                    style={{ borderBottom: '0.5px solid rgba(198, 198, 199, 0.4)' }}
                  >
                    <span
                      className="text-[24px] leading-[1.4] italic"
                      style={{
                        fontFamily: "'EB Garamond', Georgia, serif",
                        fontWeight: 400,
                        color: '#efbd8a',
                      }}
                    >
                      {feature.number}
                    </span>
                    <div>
                      <h5
                        className="mb-1 text-[14px] uppercase leading-[1.0] tracking-[0.1em]"
                        style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontWeight: 500,
                          color: '#d4e3ff',
                        }}
                      >
                        {feature.title}
                      </h5>
                      <p
                        className="text-base"
                        style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          lineHeight: '1.6',
                          color: '#c5c6cd',
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

        {/* ── Evening Selections (Menu Preview) ────────────────── */}
        <section className="space-y-6">
          <div className="text-center">
            <h2
              className="text-[48px] leading-[1.1] tracking-[-0.02em]"
              style={{
                fontFamily: "'EB Garamond', Georgia, serif",
                fontWeight: 500,
                color: '#d4e3ff',
              }}
            >
              {data.menuSectionTitle}
            </h2>
            <p
              className="text-[14px] uppercase leading-[1.0] tracking-widest"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 500,
                color: '#c6c6c7',
              }}
            >
              {data.menuSectionSubtitle}
            </p>
          </div>

          {/* Grid — gap-gutter(24px) per original */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {data.menuItems.map((item) => (
              <MenuCard key={item.id} item={item} onClick={onMenuItemClick} />
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer
        className="w-full border-t py-20"
        style={{
          backgroundColor: '#000e22',
          borderColor: 'rgba(68, 71, 77, 0.4)',
        }}
        aria-label={t('common.footer', { defaultValue: 'Footer' })}
      >
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-8 text-center">
          {/* Brand — text-primary (#b8c7e2) per original footer */}
          <div
            className="text-[24px] leading-[1.4] tracking-widest uppercase"
            style={{
              fontFamily: "'EB Garamond', Georgia, serif",
              fontWeight: 400,
              color: '#b8c7e2',
            }}
          >
            AURA CAFE
          </div>

          {/* Links */}
          <div className="flex gap-12">
            <a
              href="#"
              className="uppercase tracking-widest opacity-80 transition-all hover:opacity-100"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '14px',
                lineHeight: '1.0',
                letterSpacing: '0.1em',
                fontWeight: 500,
                color: '#c5c6cd',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#b8c7e2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#c5c6cd'; }}
            >
              {t('common.privacyPolicy', { defaultValue: 'Privacy' })}
            </a>
            <a
              href="#"
              className="uppercase tracking-widest opacity-80 transition-all hover:opacity-100"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '14px',
                lineHeight: '1.0',
                letterSpacing: '0.1em',
                fontWeight: 500,
                color: '#c5c6cd',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#b8c7e2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#c5c6cd'; }}
            >
              {t('common.termsOfService', { defaultValue: 'Terms' })}
            </a>
            <a
              href="#"
              className="uppercase tracking-widest opacity-80 transition-all hover:opacity-100"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '14px',
                lineHeight: '1.0',
                letterSpacing: '0.1em',
                fontWeight: 500,
                color: '#c5c6cd',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#b8c7e2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#c5c6cd'; }}
            >
              {t('containerNew1.contact', { defaultValue: 'Contact' })}
            </a>
          </div>

          {/* Copyright — mt-md(24px) added on top of gap-6 per original */}
          <p
            className="mt-6 text-xs uppercase leading-[1.0] tracking-widest"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              color: 'rgba(197, 198, 205, 0.6)',
            }}
          >
            {t('containerNew1.copyright', {
              year: new Date().getFullYear(),
              defaultValue: '© 2024 AURA CAFE. ALL RIGHTS RESERVED.',
            })}
          </p>

          {/* Social icons — mt-md(24px) per original */}
          <div
            className="mt-6 flex gap-6"
          >
            <div
              className="group flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
              style={{ borderColor: 'rgba(198, 198, 199, 0.2)' }}
              aria-label={t('containerNew1.socialWebsite', { defaultValue: 'Website' })}
              role="button"
              tabIndex={0}
            >
              <Globe
                className="h-5 w-5 transition-colors"
                style={{ color: '#c6c6c7' }}
              />
            </div>
            <div
              className="group flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
              style={{ borderColor: 'rgba(198, 198, 199, 0.2)' }}
              aria-label={t('containerNew1.socialShare', { defaultValue: 'Share' })}
              role="button"
              tabIndex={0}
            >
              <Share2
                className="h-5 w-5 transition-colors"
                style={{ color: '#c6c6c7' }}
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
