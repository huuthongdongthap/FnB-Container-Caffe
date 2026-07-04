/**
 * StitchContainerNew2 — AURA CAFE Luxury Container Cafe landing page
 *
 * EXACT match of Stitch design: aura_cafe_luxury_container_cafe_2/code.html
 * Dark navy glassmorphism landing: hero, container aesthetic bento grid,
 * atmosphere parallax section, signature selection menu teaser, footer.
 * Mobile-first responsive. Named export.
 */
'use client';

import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Building2, Coffee, MoonStar, Share2, MapPin } from 'lucide-react';
import { useEffect, useRef } from 'react';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface SignatureItem {
  id: string;
  name: string;
  description: string;
  price: string;
}

export interface NavLink {
  id: string;
  label: string;
  href: string;
  isActive?: boolean;
}

export interface FeatureCard {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface FooterLinkGroup {
  id: string;
  heading: string;
  links: Array<{ id: string; label: string; href: string }>;
}

export interface ContainerCafeNew2Data {
  navLinks: NavLink[];
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  reservationLabel: string;
  viewGalleryLabel: string;
  sectionTitle: string;
  featureCards: FeatureCard[];
  atmosphereTitle: string;
  atmosphereQuote: string;
  atmosphereAttribution: string;
  atmosphereBgUrl: string;
  atmosphereBgAlt: string;
  menuSectionTitle: string;
  menuSectionSubtitle: string;
  signatureItems: SignatureItem[];
  menuImageUrl: string;
  menuImageAlt: string;
  footerLogo: string;
  footerAddressLines: string[];
  footerEmail: string;
  footerLinkGroups: FooterLinkGroup[];
  legalLinks: Array<{ id: string; label: string; href: string }>;
  copyright: string;
}

export type LoadingState = 'idle' | 'loading' | 'error';

export interface StitchContainerNew2Props {
  data?: ContainerCafeNew2Data;
  loadingState?: LoadingState;
  errorMessage?: string;
  onReservation?: () => void;
  onViewGallery?: () => void;
  onMenuItemClick?: (itemId: string) => void;
  onNavClick?: (linkId: string) => void;
}

/* ─── Tailwind config values from original HTML ─────────────────────── */
/* Inline to avoid var(--aura-*) usage per instructions */

const COLORS = {
  background: 'var(--st-surface)',
  surface: 'var(--st-surface)',
  surfaceContainer: 'var(--st-surface-container)',
  surfaceContainerLowest: 'var(--st-surface-container-lowest)',
  onSurface: 'var(--st-primary-fixed)',
  onSurfaceVariant: 'var(--st-on-surface-variant)',
  primary: 'var(--st-secondary)',
  primaryFixedDim: 'var(--st-secondary)',
  primaryContainer: 'var(--st-secondary)',
  onPrimary: 'var(--st-on-secondary)',
  onPrimaryContainer: 'var(--st-on-secondary)',
  secondary: 'var(--st-on-surface-variant)',
  outlineVariant: 'var(--st-outline-variant)',
  error: 'var(--st-error)',
};

const FONTS = {
  display: "'EB Garamond', Georgia, serif",
  body: "'Space Grotesk', sans-serif",
};

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ContainerCafeNew2Skeleton() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: COLORS.background }}>
      {/* Nav skeleton */}
      <nav
        className="fixed top-0 z-50 flex w-full items-center justify-between px-5 py-6 md:px-[64px]"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--st-surface) 80%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid color-mix(in srgb, var(--st-outline-variant) 20%, transparent)',
        }}
      >
        <div className="h-8 w-36 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
        <div className="hidden items-center space-x-8 md:flex">
          <div className="h-4 w-12 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
          <div className="h-4 w-14 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
          <div className="h-4 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
      </nav>

      {/* Hero skeleton */}
      <section className="flex h-[921px] items-center px-5 pt-24 md:px-[64px]">
        <div className="w-full max-w-3xl space-y-8">
          <div className="h-4 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
          <div className="h-16 w-3/4 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
          <div className="h-12 w-1/2 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
          <div className="h-5 w-full max-w-xl animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
          <div className="flex flex-wrap gap-4">
            <div className="h-14 w-40 animate-pulse" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
            <div className="h-14 w-40 animate-pulse" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
          </div>
        </div>
      </section>

      {/* Content skeletons */}
      <div className="mx-auto max-w-[1280px] space-y-20 px-5 pb-20 md:px-[64px]">
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
          <div className="h-px w-24 animate-pulse" style={{ backgroundColor: 'var(--st-surface-container-highest)' }} />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--st-surface-container) 60%, transparent)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

function ContainerCafeNew2Error({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--st-surface-container) 60%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid color-mix(in srgb, var(--st-secondary) 20%, transparent)',
        borderLeft: '1px solid color-mix(in srgb, var(--st-on-surface-variant) 10%, transparent)',
      }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke={COLORS.error} strokeWidth={1.5} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <h3
        className="text-[32px]/[40px] font-medium"
        style={{
          fontFamily: FONTS.display,
          color: COLORS.onSurface,
        }}
      >
        {t('common.error')}
      </h3>
      <p
        className="text-base"
        style={{
          fontFamily: FONTS.body,
          color: COLORS.secondary,
        }}
      >
        {message}
      </p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function ContainerCafeNew2Empty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--st-surface-container) 60%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid color-mix(in srgb, var(--st-secondary) 20%, transparent)',
        borderLeft: '1px solid color-mix(in srgb, var(--st-on-surface-variant) 10%, transparent)',
      }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="var(--st-on-tertiary-container)" strokeWidth={1.5} aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9h6M9 13h6M9 17h4" />
      </svg>
      <h3
        className="text-[32px]/[40px] font-medium"
        style={{
          fontFamily: FONTS.display,
          color: COLORS.onSurface,
        }}
      >
        {t('common.noData')}
      </h3>
    </div>
  );
}

/* ─── Icon Map ─────────────────────────────────────────────────────── */

function FeatureIcon({ icon, className = 'text-4xl' }: { icon: string; className?: string }) {
  const iconStyle = { color: COLORS.primary };
  switch (icon) {
    case 'architecture':
      return (
        <span className={className} style={iconStyle} aria-hidden="true">
          <Building2 className="inline-block h-9 w-9" />
        </span>
      );
    case 'coffee_maker':
    case 'coffee':
      return (
        <span className={className} style={iconStyle} aria-hidden="true">
          <Coffee className="inline-block h-9 w-9" />
        </span>
      );
    case 'nights_stay':
      return (
        <span className={className} style={iconStyle} aria-hidden="true">
          <MoonStar className="inline-block h-9 w-9" />
        </span>
      );
    default:
      return null;
  }
}

/* ─── Sub-components ───────────────────────────────────────────────── */

function SiteHeader({
  navLinks,
  onNavClick,
  onReservation,
}: {
  navLinks: NavLink[];
  onNavClick?: (linkId: string) => void;
  onReservation?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <header
      className="fixed top-0 w-full z-50"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--st-surface) 80%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid color-mix(in srgb, var(--st-outline-variant) 20%, transparent)',
      }}
      aria-label={t('common.mainNavigation')}
    >
      <nav
        className="flex justify-between items-center px-5 py-6 md:px-[64px] max-w-[1280px] mx-auto"
      >
        {/* Logo */}
        <div
          className="font-bold tracking-tighter"
          style={{
            fontFamily: FONTS.display,
            fontSize: '32px',
            lineHeight: '40px',
            fontWeight: 500,
            color: COLORS.primary,
          }}
        >
          {t('containerNew2.brandName', { defaultValue: 'AURA CAFE' })}
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                onNavClick?.(link.id);
              }}
              className={clsx(
                'cursor-pointer active:scale-95 transition-transform',
              )}
              style={{
                fontFamily: FONTS.body,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0.1em',
                fontWeight: link.isActive ? 700 : 600,
                color: link.isActive ? COLORS.primary : COLORS.onSurfaceVariant,
                borderBottom: link.isActive ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                paddingBottom: link.isActive ? '4px' : undefined,
                transition: 'color 300ms, border-color 300ms, transform 200ms',
              }}
              onMouseEnter={(e) => {
                if (!link.isActive) e.currentTarget.style.color = COLORS.primaryFixedDim;
              }}
              onMouseLeave={(e) => {
                if (!link.isActive) e.currentTarget.style.color = COLORS.onSurfaceVariant;
              }}
              aria-current={link.isActive ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Reservation button */}
        <button
          type="button"
          onClick={onReservation}
          className="px-6 py-2 rounded-lg font-bold active:scale-95 transition-all duration-300"
          style={{
            fontFamily: FONTS.body,
            fontSize: '14px',
            lineHeight: '20px',
            letterSpacing: '0.1em',
            fontWeight: 700,
            backgroundColor: COLORS.primaryContainer,
            color: COLORS.onPrimaryContainer,
            transition: 'background-color 300ms, transform 200ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.primaryFixedDim;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.primaryContainer;
          }}
          aria-label={t('containerNew2.reservationAria')}
        >
          {t('containerNew2.reservation')}
        </button>
      </nav>
    </header>
  );
}

function HeroSection({
  heroTag,
  heroTitle,
  heroSubtitle,
  heroDescription,
  reservationLabel,
  viewGalleryLabel,
  onReservation,
  onViewGallery,
}: {
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  reservationLabel: string;
  viewGalleryLabel: string;
  onReservation?: () => void;
  onViewGallery?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="relative h-[921px] flex items-center px-5 md:px-[64px] max-w-[1280px] mx-auto overflow-hidden"
      aria-label={t('containerNew2.heroAriaLabel')}
    >
      {/* 12-column grid matching HTML */}
      <div
        className="grid grid-cols-12 w-full z-10"
        style={{ gap: '24px' }}
      >
        <div className="col-span-12 md:col-span-8 flex flex-col justify-center space-y-8">
          {/* Tag */}
          <div className="space-y-2">
            <span
              className="uppercase"
              style={{
                fontFamily: FONTS.body,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0.2em',
                fontWeight: 600,
                color: COLORS.primary,
              }}
            >
              {heroTag}
            </span>

            {/* Heading */}
            <h1
              className="leading-tight"
              style={{
                fontFamily: FONTS.display,
                fontSize: '64px',
                lineHeight: '72px',
                letterSpacing: '-0.02em',
                fontWeight: 500,
                color: COLORS.onSurface,
              }}
            >
              {heroTitle}
              <br />
              <span
                className="italic"
                style={{
                  color: COLORS.primaryFixedDim,
                  fontFamily: FONTS.display,
                  fontSize: '64px',
                  lineHeight: '72px',
                  letterSpacing: '-0.02em',
                  fontWeight: 500,
                }}
              >
                {heroSubtitle}
              </span>
            </h1>
          </div>

          {/* Description */}
          <p
            className="max-w-xl"
            style={{
              fontFamily: FONTS.body,
              fontSize: '18px',
              lineHeight: '28px',
              fontWeight: 400,
              color: COLORS.onSurfaceVariant,
            }}
          >
            {heroDescription}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onReservation}
              className="px-8 py-4 font-bold uppercase tracking-wider rounded-none active:scale-95 transition-all duration-500"
              style={{
                fontFamily: FONTS.body,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0.1em',
                fontWeight: 700,
                backgroundColor: COLORS.primary,
                color: COLORS.onPrimary,
                boxShadow: `0 10px 15px -3px color-mix(in srgb, var(--st-secondary) 10%, transparent)`,
                transition: 'background-color 500ms, transform 200ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.primaryFixedDim;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.primary;
              }}
              aria-label={t('containerNew2.reservationAria')}
            >
              {reservationLabel}
            </button>
            <button
              type="button"
              onClick={onViewGallery}
              className="shimmer-hover px-8 py-4 font-bold uppercase tracking-wider rounded-none hover:bg-white/5 active:scale-95 transition-all duration-500"
              style={{
                fontFamily: FONTS.body,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0.1em',
                fontWeight: 700,
                color: COLORS.secondary,
                border: '1px solid color-mix(in srgb, var(--st-on-surface-variant) 30%, transparent)',
              }}
              aria-label={t('containerNew2.viewGalleryAria')}
            >
              {viewGalleryLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Abstract Industrial Visual (empty div as per HTML) */}
      <div className="absolute right-0 top-0 w-1/2 h-full -z-10 opacity-60" aria-hidden="true" />
    </section>
  );
}

function FeatureCardsSection({
  sectionTitle,
  cards,
}: {
  sectionTitle: string;
  cards: FeatureCard[];
}) {
  const { t } = useTranslation();
  return (
    <section
      className="py-32 px-5 md:px-[64px] max-w-[1280px] mx-auto"
      aria-labelledby="features-heading"
    >
      <div className="mb-16">
        <h2
          id="features-heading"
          className="mb-4"
          style={{
            fontFamily: FONTS.display,
            fontSize: '32px',
            lineHeight: '40px',
            fontWeight: 500,
            color: COLORS.primaryFixedDim,
          }}
        >
          {sectionTitle}
        </h2>
        <div
          className="h-px w-24"
          style={{ backgroundColor: COLORS.primary }}
          aria-hidden="true"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {cards.map((card) => (
          <article
            key={card.id}
            className="glass-card p-10 flex flex-col space-y-6 group hover:-translate-y-2 transition-all duration-500"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--st-surface-container) 60%, transparent)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderTop: '1px solid color-mix(in srgb, var(--st-secondary) 20%, transparent)',
              borderLeft: '1px solid color-mix(in srgb, var(--st-on-surface-variant) 10%, transparent)',
            }}
            aria-label={card.title}
          >
            {/* Icon */}
            <FeatureIcon icon={card.icon} />

            {/* Title */}
            <h3
              style={{
                fontFamily: FONTS.display,
                fontSize: '24px',
                lineHeight: '32px',
                fontWeight: 500,
                color: COLORS.onSurface,
              }}
            >
              {card.title}
            </h3>

            {/* Description */}
            <p
              style={{
                fontFamily: FONTS.body,
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 400,
                color: COLORS.onSurfaceVariant,
              }}
            >
              {card.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function AtmosphereSection({
  title,
  quote,
  attribution,
  bgUrl,
  bgAlt,
}: {
  title: string;
  quote: string;
  attribution: string;
  bgUrl: string;
  bgAlt: string;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="relative py-40 overflow-hidden"
      aria-label={t('containerNew2.atmosphereAriaLabel')}
    >
      {/* Background image */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div
          className="w-full h-full bg-cover bg-fixed bg-center"
          style={{ backgroundImage: `url('${bgUrl}')` }}
          role="img"
          aria-label={bgAlt}
        />
        {/* Gradient overlay matching HTML */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, var(--st-surface), color-mix(in srgb, var(--st-surface) 60%, transparent), transparent)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 px-5 md:px-[64px] max-w-[1280px] mx-auto">
        <div
          className="max-w-xl space-y-8 p-12"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--st-surface-container) 60%, transparent)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid color-mix(in srgb, var(--st-secondary) 20%, transparent)',
            borderLeft: '1px solid color-mix(in srgb, var(--st-on-surface-variant) 10%, transparent)',
          }}
        >
          <h2
            style={{
              fontFamily: FONTS.display,
              color: COLORS.primary,
            }}
            className="text-[40px]/[48px] md:text-[32px]/[40px] font-medium"
          >
            {title}
          </h2>

          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: '18px',
              lineHeight: '28px',
              fontWeight: 400,
              color: COLORS.onSurface,
            }}
          >
            {quote}
          </p>

          <div className="flex items-center space-x-4">
            <div
              className="h-px w-12"
              style={{ backgroundColor: COLORS.secondary }}
              aria-hidden="true"
            />
            <span
              className="uppercase tracking-widest"
              style={{
                fontFamily: FONTS.body,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0.1em',
                fontWeight: 600,
                color: COLORS.secondary,
              }}
            >
              {attribution}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function MenuTeaserSection({
  sectionTitle,
  sectionSubtitle,
  items,
  imageUrl,
  imageAlt,
  onMenuItemClick,
}: {
  sectionTitle: string;
  sectionSubtitle: string;
  items: SignatureItem[];
  imageUrl: string;
  imageAlt: string;
  onMenuItemClick?: (itemId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="py-32 px-5 md:px-[64px] max-w-[1280px] mx-auto"
      aria-labelledby="menu-heading"
    >
      <div
        className="grid grid-cols-12 items-center"
        style={{ gap: '24px' }}
      >
        {/* Text column */}
        <div className="col-span-12 md:col-span-6 space-y-12">
          <div>
            <h2
              id="menu-heading"
              className="mb-6"
              style={{
                fontFamily: FONTS.display,
                fontSize: '32px',
                lineHeight: '40px',
                fontWeight: 500,
                color: COLORS.onSurface,
              }}
            >
              {sectionTitle}
            </h2>
            <p
              style={{
                fontFamily: FONTS.body,
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 400,
                color: COLORS.onSurfaceVariant,
              }}
            >
              {sectionSubtitle}
            </p>
          </div>

          {/* Menu items list */}
          <ul className="space-y-6" role="list">
            {items.map((item) => (
              <li
                key={item.id}
                className="group flex justify-between items-end border-b pb-4"
                style={{
                  borderColor: 'color-mix(in srgb, var(--st-outline-variant) 30%, transparent)',
                }}
                onClick={() => onMenuItemClick?.(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onMenuItemClick?.(item.id);
                }}
                role="button"
                tabIndex={0}
                aria-label={item.name}
              >
                <div className="space-y-1">
                  <span
                    className="uppercase"
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: '14px',
                      lineHeight: '20px',
                      letterSpacing: '0.1em',
                      fontWeight: 600,
                      color: COLORS.primary,
                    }}
                  >
                    {item.name}
                  </span>
                  <p
                    className="text-sm"
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: '14px',
                      color: COLORS.onSurfaceVariant,
                    }}
                  >
                    {item.description}
                  </p>
                </div>
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: '14px',
                    lineHeight: '20px',
                    letterSpacing: '0.1em',
                    fontWeight: 600,
                    color: COLORS.onSurface,
                  }}
                >
                  {item.price}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Image column */}
        <div className="col-span-12 md:col-span-6 h-[500px] relative overflow-hidden">
          <img
            className="w-full h-full object-cover"
            src={imageUrl}
            alt={imageAlt}
            loading="lazy"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              border: '1px solid color-mix(in srgb, var(--st-secondary) 20%, transparent)',
              margin: '16px',
            }}
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  );
}

function SiteFooter({
  logo,
  addressLines,
  email,
  linkGroups,
  legalLinks,
  copyright,
}: {
  logo: string;
  addressLines: string[];
  email: string;
  linkGroups: FooterLinkGroup[];
  legalLinks: Array<{ id: string; label: string; href: string }>;
  copyright: string;
}) {
  const { t } = useTranslation();
  return (
    <footer
      className="border-t"
      style={{
        backgroundColor: COLORS.surfaceContainerLowest,
        borderColor: 'color-mix(in srgb, var(--st-outline-variant) 10%, transparent)',
      }}
      aria-label={t('common.footer')}
    >
      {/* Main footer content */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-5 md:px-[64px] py-16 max-w-[1280px] mx-auto gap-12">
        {/* Brand column */}
        <div className="space-y-6">
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: '24px',
              lineHeight: '32px',
              fontWeight: 500,
              color: COLORS.primary,
            }}
          >
            {logo}
          </div>
          <address
            className="not-italic space-y-2"
            style={{
              fontFamily: FONTS.body,
              fontSize: '16px',
              lineHeight: '24px',
              fontWeight: 400,
              color: COLORS.onSurfaceVariant,
            }}
          >
            {addressLines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            <p
              className="mt-4"
              style={{ color: COLORS.primary }}
            >
              {email}
            </p>
          </address>
        </div>

        {/* Link groups */}
        <div className="grid grid-cols-2 gap-16">
          {linkGroups.map((group) => (
            <div key={group.id} className="flex flex-col space-y-4">
              <span
                className="uppercase tracking-widest mb-2"
                style={{
                  fontFamily: FONTS.body,
                  fontSize: '12px',
                  lineHeight: '16px',
                  letterSpacing: '0.05em',
                  fontWeight: 500,
                  color: COLORS.secondary,
                }}
              >
                {group.heading}
              </span>
              {group.links.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  className="transition-colors hover:text-[var(--st-secondary)]"
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: '16px',
                    lineHeight: '24px',
                    fontWeight: 400,
                    color: COLORS.onSurfaceVariant,
                  }}
                  aria-label={link.label}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="border-t px-5 md:px-[64px] py-8 max-w-[1280px] mx-auto"
        style={{ borderColor: 'color-mix(in srgb, var(--st-outline-variant) 5%, transparent)' }}
      >
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: '12px',
              lineHeight: '16px',
              letterSpacing: '0.05em',
              fontWeight: 500,
              color: COLORS.onSurfaceVariant,
            }}
          >
            {copyright}
          </p>
          <div className="flex space-x-6">
            <span
              className="cursor-pointer transition-colors hover:text-[var(--st-secondary)]"
              style={{ color: COLORS.onSurfaceVariant }}
              aria-label={t('containerNew2.share')}
            >
              <Share2 className="h-5 w-5" />
            </span>
            <span
              className="cursor-pointer transition-colors hover:text-[var(--st-secondary)]"
              style={{ color: COLORS.onSurfaceVariant }}
              aria-label={t('containerNew2.location')}
            >
              <MapPin className="h-5 w-5" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export function StitchContainerNew2({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrMsg,
  onReservation,
  onViewGallery,
  onMenuItemClick,
  onNavClick,
}: Readonly<StitchContainerNew2Props>) {
  const { t } = useTranslation();

  const defaultData: ContainerCafeNew2Data = {
    navLinks: [
      { id: 'home', label: t('containerNew2.home', { defaultValue: 'Home' }), href: '#', isActive: true },
      { id: 'menu', label: t('containerNew2.menu', { defaultValue: 'Menu' }), href: '#menu' },
      { id: 'location', label: t('containerNew2.location', { defaultValue: 'Location' }), href: '#location' },
    ],
    heroTag: t('containerNew2.heroTag', { defaultValue: 'Premium Specialty Coffee' }),
    heroTitle: t('containerNew2.heroTitle', { defaultValue: 'AURA CAFE —' }),
    heroSubtitle: t('containerNew2.heroSubtitle', { defaultValue: 'Container Caffe & Space' }),
    heroDescription: t('containerNew2.heroDescription', { defaultValue: 'An avant-garde architectural sanctuary in Sa Dec, Vietnam. Experience the intersection of industrial precision and nocturnal luxury through our curated brews.' }),
    reservationLabel: t('containerNew2.reservation', { defaultValue: 'Book a Table' }),
    viewGalleryLabel: t('containerNew2.viewGallery', { defaultValue: 'View Gallery' }),
    sectionTitle: t('containerNew2.sectionTitle', { defaultValue: 'The Container Aesthetic' }),
    featureCards: [
      {
        id: 'architectural-precision',
        icon: 'architecture',
        title: t('containerNew2.feature1Title', { defaultValue: 'Architectural Precision' }),
        description: t('containerNew2.feature1Desc', { defaultValue: 'Our space is built from repurposed industrial containers, refined with high-end glasswork and brushed metallic surfaces.' }),
      },
      {
        id: 'curated-brews',
        icon: 'coffee_maker',
        title: t('containerNew2.feature2Title', { defaultValue: 'Curated Brews' }),
        description: t('containerNew2.feature2Desc', { defaultValue: 'Sourcing only the finest specialty beans, our baristas craft each cup using technical precision and artisanal soul.' }),
      },
      {
        id: 'nocturnal-ambience',
        icon: 'nights_stay',
        title: t('containerNew2.feature3Title', { defaultValue: 'Nocturnal Ambience' }),
        description: t('containerNew2.feature3Desc', { defaultValue: 'Designed for the twilight hours, our lighting system creates a moody, sophisticated environment perfect for late-night inspiration.' }),
      },
    ],
    atmosphereTitle: t('containerNew2.atmosphereTitle', { defaultValue: 'A Symphony of Steel & Shadow' }),
    atmosphereQuote: t('containerNew2.atmosphereQuote', { defaultValue: '"The atmosphere at Aura isn\'t just about the coffee; it\'s about the deliberate tension between raw industrial materials and refined luxury comforts."' }),
    atmosphereAttribution: t('containerNew2.atmosphereAttribution', { defaultValue: 'Architectural Digest' }),
    atmosphereBgUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAs-j2Bs-ZKR94AwJJOXlEEcYcKrWo4SQbA9uu90c26nJ3JdaxSh5XVA4jIMiwR0YNlzVSaoVA70eEWhyTLCRItlpHBJp_Uss3xbqHhJWadWqwgIh0xBK9Fs0cB1eWFgjrjhkhuLQ7OPiuHleH7Bco-Rlf2dZzS2kF3QGvfr4OEGwTfLwxBa23tIOZ5xqQH2cJye5KS56kKqcSe_HXE-KIdAh3egsZpfIWeRNbhpZY9wP320ScttzefwxkPmkjNCyfiGv3dlONbiHM',
    atmosphereBgAlt: t('containerNew2.atmosphereBgAlt', { defaultValue: 'A cinematic, low-light photograph of a high-end container cafe interior at night.' }),
    menuSectionTitle: t('containerNew2.menuSectionTitle', { defaultValue: 'Signature Selection' }),
    menuSectionSubtitle: t('containerNew2.menuSectionSubtitle', { defaultValue: 'Our menu is a technical specification of flavor, balancing acidity and body with architectural balance.' }),
    signatureItems: [
      {
        id: 'nocturnal-espresso',
        name: t('containerNew2.item1Name', { defaultValue: 'Nocturnal Espresso' }),
        description: t('containerNew2.item1Desc', { defaultValue: 'Dark roast, cacao nibs, smoked cedar' }),
        price: '$5.50',
      },
      {
        id: 'chrome-cold-brew',
        name: t('containerNew2.item2Name', { defaultValue: 'Chrome Cold Brew' }),
        description: t('containerNew2.item2Desc', { defaultValue: '12-hour filtration, silver-tip jasmine infusion' }),
        price: '$6.25',
      },
      {
        id: 'bronze-latte',
        name: t('containerNew2.item3Name', { defaultValue: 'Bronze Latte' }),
        description: t('containerNew2.item3Desc', { defaultValue: 'Salted caramel honeycomb, oat silk base' }),
        price: '$6.50',
      },
    ],
    menuImageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDaoDbpEz_9buFiuoAiGaboZBYS98h_vTkxXdaX2E_Vx9YcJQUlCMJUGvLBMs6m37fG3_jvw48erczGoz-5L7jVr3V5H_pzpM6OJwZEgF5pd_fQxxc1vryfQQbqDMFl9p0C9CdbsDqrGmLnRvvVA9usTkW4CK0KEoqHEGWHkFScgt6dR-bzRlQHHrCAMpSe5cbIgw8F-e3_fPje9rOFSHaS6Sle0jIpTCxONV4KmYwAlEvckxwMYyyoNhmreQ2t7DayDLSlCmqqgvM',
    menuImageAlt: t('containerNew2.menuImageAlt', { defaultValue: 'A close-up, high-fashion shot of a signature latte in a minimalist glass cup, resting on a brushed steel counter.' }),
    footerLogo: t('containerNew2.brandName', { defaultValue: 'AURA CAFE' }),
    footerAddressLines: [
      t('containerNew2.address1', { defaultValue: '123 Architectural Way, Sa Dec' }),
      t('containerNew2.address2', { defaultValue: 'Dong Thap, Vietnam' }),
    ],
    footerEmail: 'contact@auracafe.vn',
    footerLinkGroups: [
      {
        id: 'explore',
        heading: t('containerNew2.exploreHeading', { defaultValue: 'Explore' }),
        links: [
          { id: 'explore-menu', label: t('containerNew2.exploreMenu', { defaultValue: 'Menu' }), href: '#menu' },
          { id: 'explore-story', label: t('containerNew2.ourStory', { defaultValue: 'Our Story' }), href: '#story' },
          { id: 'explore-reservation', label: t('containerNew2.reservation', { defaultValue: 'Reservation' }), href: '#reservation' },
        ],
      },
      {
        id: 'legal',
        heading: t('containerNew2.legalHeading', { defaultValue: 'Legal' }),
        links: [
          { id: 'legal-privacy', label: t('containerNew2.privacyPolicy', { defaultValue: 'Privacy Policy' }), href: '#privacy' },
          { id: 'legal-terms', label: t('containerNew2.termsOfService', { defaultValue: 'Terms of Service' }), href: '#terms' },
          { id: 'legal-contact', label: t('containerNew2.contactUs', { defaultValue: 'Contact Us' }), href: '#contact' },
        ],
      },
    ],
    legalLinks: [
      { id: 'legal-bottom-share', label: t('containerNew2.share', { defaultValue: 'Share' }), href: '#share' },
      { id: 'legal-bottom-location', label: t('containerNew2.location', { defaultValue: 'Location' }), href: '#location' },
    ],
    copyright: t('containerNew2.copyright', { defaultValue: '© {year} AURA CAFE. ALL RIGHTS RESERVED.', year: new Date().getFullYear() }),
  };

  const data = externalData ?? defaultData;
  const errorMessage = externalErrMsg ?? t('common.error');

  /* ─── Scroll Animation (matching HTML IntersectionObserver) ──── */
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = rootRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-10');
          }
        });
      },
      { threshold: 0.1 }
    );

    const sections = container.querySelectorAll('section');
    sections.forEach((section) => {
      section.classList.add('transition-all', 'duration-1000', 'opacity-0', 'translate-y-10');
      observer.observe(section);
    });

    // Initialize immediately for first section (hero)
    const first = sections[0];
    if (first) {
      first.classList.remove('opacity-0', 'translate-y-10');
      first.classList.add('opacity-100', 'translate-y-0');
    }

    return () => observer.disconnect();
  }, []);

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <ContainerCafeNew2Skeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center px-5" style={{ backgroundColor: COLORS.background }}>
        <ContainerCafeNew2Error message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
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
      {/* ── Header ─────────────────────────────────────────────── */}
      <SiteHeader
        navLinks={data.navLinks}
        onNavClick={onNavClick}
        onReservation={onReservation}
      />

      <main className="pt-24">
        {/* ── Hero ──────────────────────────────────────────────── */}
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

        {/* ── The Container Aesthetic (Bento Grid) ──────────────── */}
        <FeatureCardsSection
          sectionTitle={data.sectionTitle}
          cards={data.featureCards}
        />

        {/* ── Atmosphere Section ────────────────────────────────── */}
        <AtmosphereSection
          title={data.atmosphereTitle}
          quote={data.atmosphereQuote}
          attribution={data.atmosphereAttribution}
          bgUrl={data.atmosphereBgUrl}
          bgAlt={data.atmosphereBgAlt}
        />

        {/* ── Signature Selection (Menu Teaser) ─────────────────── */}
        <MenuTeaserSection
          sectionTitle={data.menuSectionTitle}
          sectionSubtitle={data.menuSectionSubtitle}
          items={data.signatureItems}
          imageUrl={data.menuImageUrl}
          imageAlt={data.menuImageAlt}
          onMenuItemClick={onMenuItemClick}
        />
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
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
          background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--st-on-surface-variant) 10%, transparent), transparent);
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
          text-shadow: 0 0 12px color-mix(in srgb, var(--st-secondary) 40%, transparent);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        ::selection {
          background-color: var(--st-secondary);
          color: var(--st-on-secondary);
        }
        a, button {
          transition: color 0.3s, background-color 0.3s, border-color 0.3s, transform 0.2s, box-shadow 0.3s;
        }
      `}</style>
    </div>
  );
}

export default StitchContainerNew2;
