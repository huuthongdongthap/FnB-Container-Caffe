/**
 * StitchContainerNew2 — AURA CAFE Luxury Container Cafe landing page (Stitch design, New v2)
 *
 * Dark navy glassmorphism landing: hero with premium specialty coffee branding,
 * container aesthetic bento grid, atmosphere section with parallax background,
 * signature selection menu teaser, and footer.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_luxury_container_cafe_2/code.html export.
 */
'use client';

import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

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

/* ─── SVG Icon Components ─────────────────────────────────────────── */

function ArchitectureIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M3 21l9-9 9 9" />
      <path d="M12 3v12" />
      <path d="M9 6l3-3 3 3" />
      <path d="M6 12l3-3" />
      <path d="M18 12l-3-3" />
    </svg>
  );
}

function CoffeeIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M18 8h1a4 4 0 010 8h-1" />
      <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
      <path d="M6 1v3M10 1v3M14 1v3" />
    </svg>
  );
}

function NightsStayIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M12 3a9 9 0 109 9c-4.97 0-9-4.03-9-9z" />
      <path d="M17 7h.01M13 5h.01M19 11h.01" strokeWidth={2} />
    </svg>
  );
}

function ShareIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}

function LocationIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function ContainerCafeNew2Skeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#00142c' }}>
      {/* Nav skeleton */}
      <nav className="fixed top-0 z-50 flex w-full items-center justify-between px-5 py-6 md:px-16" style={{ backgroundColor: 'rgba(11, 32, 58, 0.6)', backdropFilter: 'blur(12px)' }}>
        <div className="h-7 w-36 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
        <div className="hidden items-center gap-8 md:flex">
          <div className="h-4 w-12 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="h-4 w-14 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="h-4 w-16 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-lg" style={{ backgroundColor: '#23364e' }} />
      </nav>

      {/* Hero skeleton */}
      <section className="flex h-[921px] items-center px-5 pt-24 md:px-16">
        <div className="w-full max-w-3xl space-y-8">
          <div className="h-4 w-48 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="h-16 w-3/4 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="h-12 w-1/2 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="h-5 w-full max-w-xl animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="flex flex-wrap gap-4">
            <div className="h-14 w-40 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
            <div className="h-14 w-40 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          </div>
        </div>
      </section>

      {/* Content skeletons */}
      <div className="mx-auto max-w-[1280px] space-y-20 px-5 pb-20 md:px-16">
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="h-1 w-24 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded" style={{ backgroundColor: 'rgba(18, 37, 61, 0.6)' }} />
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
      style={{ backgroundColor: 'rgba(11, 32, 58, 0.8)' }}
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
      <p style={{ color: 'var(--aura-primary, #c6c6c7)' }}>{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function ContainerCafeNew2Empty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'rgba(11, 32, 58, 0.8)' }}
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
      className="fixed top-0 z-50 w-full border-b"
      style={{
        backgroundColor: 'rgba(0, 20, 44, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderColor: 'rgba(80, 69, 59, 0.2)',
      }}
      aria-label={t('common.mainNavigation')}
    >
      <nav className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-6 md:px-16">
        {/* Logo */}
        <div
          className="font-display text-[clamp(1.25rem,3vw,2rem)] font-bold tracking-tighter"
          style={{ color: '#f2c08d' }}
        >
          AURA CAFE
        </div>

        {/* Desktop nav links */}
        <ul className="hidden items-center gap-8 md:flex" role="list">
          {navLinks.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  onNavClick?.(link.id);
                }}
                className={clsx(
                  'font-body text-sm tracking-[0.1em] transition-all duration-300 active:scale-95',
                  link.isActive
                    ? 'border-b-2 pb-1 font-bold'
                    : 'hover:text-[#efbd8a] font-semibold',
                )}
                style={{
                  color: link.isActive ? '#f2c08d' : '#d4c4b7',
                  borderColor: link.isActive ? '#f2c08d' : 'transparent',
                }}
                aria-current={link.isActive ? 'page' : undefined}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Reservation button */}
        <button
          type="button"
          onClick={onReservation}
          className="text-sm font-bold uppercase tracking-[0.1em] px-6 py-2 rounded-lg transition-all duration-300 active:scale-95"
          style={{
            fontFamily: "var(--aura-font-body)",
            backgroundColor: '#d4a574',
            color: '#5b3a13',
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
      className="relative flex min-h-[921px] items-center overflow-hidden px-5 pt-24 md:px-16"
      aria-label={t('containerNew2.heroAriaLabel')}
    >
      <div className="relative z-10 mx-auto w-full max-w-[1280px]">
        <div className="flex flex-col justify-center space-y-8 md:w-8/12">
          {/* Tag */}
          <span
            className="text-sm font-semibold uppercase tracking-[0.2em]"
            style={{ color: '#f2c08d', fontFamily: "var(--aura-font-body)" }}
          >
            {heroTag}
          </span>

          {/* Title */}
          <h1
            className="leading-tight"
            style={{
              fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
              color: '#d4e3ff',
            }}
          >
            <span className="text-[clamp(2.5rem,8vw,4rem)] font-medium md:text-6xl lg:text-7xl">
              {heroTitle}
            </span>
            <br />
            <span
              className="text-[clamp(2rem,6vw,3.5rem)] italic font-normal md:text-5xl lg:text-6xl"
              style={{ color: '#efbd8a' }}
            >
              {heroSubtitle}
            </span>
          </h1>

          {/* Description */}
          <p
            className="max-w-xl text-lg leading-[28px]"
            style={{
              color: '#d4c4b7',
              fontFamily: "var(--aura-font-body)",
            }}
          >
            {heroDescription}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onReservation}
              className="px-8 py-4 text-sm font-bold uppercase tracking-wider transition-all duration-500 rounded-none hover:bg-[#efbd8a] active:scale-95"
              style={{
                fontFamily: "var(--aura-font-body)",
                backgroundColor: '#f2c08d',
                color: '#472a03',
                boxShadow: '0 10px 15px -3px rgba(242, 192, 141, 0.1)',
              }}
              aria-label={t('containerNew2.reservationAria')}
            >
              {reservationLabel}
            </button>
            <button
              type="button"
              onClick={onViewGallery}
              className="shimmer-hover px-8 py-4 text-sm font-bold uppercase tracking-wider transition-all duration-500 rounded-none hover:bg-white/5 active:scale-95"
              style={{
                fontFamily: "var(--aura-font-body)",
                color: '#c6c6c7',
                border: '1px solid rgba(198, 198, 199, 0.3)',
              }}
              aria-label={t('containerNew2.viewGalleryAria')}
            >
              {viewGalleryLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Decorative gradient orb right side */}
      <div
        className="pointer-events-none absolute -right-48 top-0 h-full w-1/2 opacity-30"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(242, 192, 141, 0.15) 0%, transparent 70%)',
        }}
      />
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

  const iconMap: Record<string, React.ReactNode> = {
    architecture: <ArchitectureIcon className="h-8 w-8" />,
    coffee: <CoffeeIcon className="h-8 w-8" />,
    coffee_maker: <CoffeeIcon className="h-8 w-8" />,
    nights_stay: <NightsStayIcon className="h-8 w-8" />,
  };

  return (
    <section className="mx-auto max-w-[1280px] px-5 py-32 md:px-16" aria-labelledby="features-heading">
      <div className="mb-16">
        <h2
          id="features-heading"
          className="text-[clamp(1.75rem,4vw,2rem)] font-medium md:text-4xl"
          style={{
            fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
            color: '#efbd8a',
          }}
        >
          {sectionTitle}
        </h2>
        <div className="mt-3 h-px w-24" style={{ backgroundColor: '#f2c08d' }} />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {cards.map((card, index) => (
          <article
            key={card.id}
            className="glass-card group flex transform flex-col space-y-6 p-8 transition-all duration-500 hover:-translate-y-2 md:p-10"
            style={{
              backgroundColor: 'rgba(11, 32, 58, 0.6)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderTop: '1px solid rgba(242, 192, 141, 0.2)',
              borderLeft: '1px solid rgba(198, 198, 199, 0.1)',
            }}
            aria-label={card.title}
          >
            {/* Icon */}
            <div className="text-4xl" style={{ color: '#f2c08d' }} aria-hidden="true">
              {iconMap[card.icon] ?? (
                <span className="material-symbols-outlined text-4xl">{card.icon}</span>
              )}
            </div>

            {/* Title */}
            <h3
              className="text-[24px]/[32px] font-medium"
              style={{
                fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
                color: '#d4e3ff',
              }}
            >
              {card.title}
            </h3>

            {/* Description */}
            <p
              className="text-base leading-[24px]"
              style={{
                color: '#d4c4b7',
                fontFamily: "var(--aura-font-body)",
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
      className="relative overflow-hidden py-40"
      aria-label={t('containerNew2.atmosphereAriaLabel')}
    >
      {/* Background image with parallax effect */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div
          className="h-full w-full bg-cover bg-fixed bg-center"
          style={{ backgroundImage: `url('${bgUrl}')` }}
          role="img"
          aria-label={bgAlt}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, #00142c, rgba(0, 20, 44, 0.6), transparent)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[1280px] px-5 md:px-16">
        <div
          className="max-w-xl space-y-8 p-8 md:p-12"
          style={{
            backgroundColor: 'rgba(11, 32, 58, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(242, 192, 141, 0.2)',
            borderLeft: '1px solid rgba(198, 198, 199, 0.1)',
          }}
        >
          <h2
            className="text-[clamp(1.75rem,4vw,2rem)] font-medium md:text-4xl"
            style={{
              fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
              color: '#f2c08d',
            }}
          >
            {title}
          </h2>

          <p
            className="text-lg leading-[28px]"
            style={{
              color: '#d4e3ff',
              fontFamily: "var(--aura-font-body)",
            }}
          >
            {quote}
          </p>

          <div className="flex items-center gap-4">
            <div className="h-px w-12" style={{ backgroundColor: '#c6c6c7' }} aria-hidden="true" />
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{
                color: '#c6c6c7',
                fontFamily: "var(--aura-font-body)",
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
      className="mx-auto max-w-[1280px] px-5 py-32 md:px-16"
      aria-labelledby="menu-heading"
    >
      <div className="grid grid-cols-12 items-center gap-6 md:gap-gutter">
        {/* Text column */}
        <div className="col-span-12 space-y-10 md:col-span-6">
          <div>
            <h2
              id="menu-heading"
              className="mb-6 text-[clamp(1.75rem,4vw,2rem)] font-medium md:text-4xl"
              style={{
                fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
                color: '#d4e3ff',
              }}
            >
              {sectionTitle}
            </h2>
            <p
              className="text-base leading-[24px]"
              style={{
                color: '#d4c4b7',
                fontFamily: "var(--aura-font-body)",
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
                className="group flex cursor-pointer items-end justify-between border-b pb-4 transition-colors"
                style={{ borderColor: 'rgba(80, 69, 59, 0.3)' }}
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
                    className="text-sm font-semibold uppercase tracking-[0.1em] transition-colors group-hover:brightness-125"
                    style={{
                      color: '#f2c08d',
                      fontFamily: "var(--aura-font-body)",
                    }}
                  >
                    {item.name}
                  </span>
                  <p
                    className="text-sm"
                    style={{
                      color: '#d4c4b7',
                      fontFamily: "var(--aura-font-body)",
                    }}
                  >
                    {item.description}
                  </p>
                </div>
                <span
                  className="text-sm font-semibold uppercase tracking-[0.1em]"
                  style={{
                    color: '#d4e3ff',
                    fontFamily: "var(--aura-font-body)",
                  }}
                >
                  {item.price}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Image column */}
        <div className="relative col-span-12 h-[400px] overflow-hidden md:col-span-6 md:h-[500px]">
          <img
            className="h-full w-full object-cover"
            src={imageUrl}
            alt={imageAlt}
            loading="lazy"
          />
          <div
            className="pointer-events-none absolute inset-0 m-4"
            style={{ border: '1px solid rgba(242, 192, 141, 0.2)' }}
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
        backgroundColor: '#000e23',
        borderColor: 'rgba(80, 69, 59, 0.1)',
      }}
      aria-label={t('common.footer')}
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-5 py-16 md:flex-row md:items-start md:justify-between md:px-16">
        {/* Brand column */}
        <div className="space-y-6">
          <div
            className="text-[1.375rem] font-medium md:text-2xl"
            style={{
              fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
              color: '#f2c08d',
            }}
          >
            {logo}
          </div>
          <address
            className="space-y-2 not-italic"
            style={{
              color: '#d4c4b7',
              fontFamily: "var(--aura-font-body)",
            }}
          >
            {addressLines.map((line, i) => (
              <p key={i} className="text-base leading-[24px]">{line}</p>
            ))}
            <p
              className="mt-4 text-base"
              style={{ color: '#f2c08d' }}
            >
              {email}
            </p>
          </address>
        </div>

        {/* Link groups */}
        <div className="flex flex-wrap gap-16">
          {linkGroups.map((group) => (
            <div key={group.id} className="flex flex-col space-y-4">
              <span
                className="mb-2 text-xs font-semibold uppercase tracking-widest"
                style={{
                  color: '#c6c6c7',
                  fontFamily: "var(--aura-font-body)",
                }}
              >
                {group.heading}
              </span>
              {group.links.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  className="text-base transition-colors hover:text-[#f2c08d]"
                  style={{
                    color: '#d4c4b7',
                    fontFamily: "var(--aura-font-body)",
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
      <div className="mx-auto max-w-[1280px] border-t px-5 py-8 md:px-16" style={{ borderColor: 'rgba(80, 69, 59, 0.05)' }}>
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p
            className="text-xs tracking-[0.05em]"
            style={{
              color: '#d4c4b7',
              fontFamily: "var(--aura-font-body)",
            }}
          >
            {copyright}
          </p>
          <div className="flex gap-6">
            <span className="cursor-pointer transition-colors hover:text-[#f2c08d]" style={{ color: '#d4c4b7' }} aria-label="Share">
              <ShareIcon />
            </span>
            <span className="cursor-pointer transition-colors hover:text-[#f2c08d]" style={{ color: '#d4c4b7' }} aria-label="Location">
              <LocationIcon />
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
    footerLogo: 'AURA CAFE',
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

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <ContainerCafeNew2Skeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center px-5" style={{ backgroundColor: '#00142c' }}>
        <ContainerCafeNew2Error message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.featureCards.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5" style={{ backgroundColor: '#00142c' }}>
        <ContainerCafeNew2Empty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: '#00142c',
        color: '#d4e3ff',
        fontFamily: "var(--aura-font-body)",
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

      {/* Custom styles */}
      <style>{`
        .shimmer-hover {
          position: relative;
          overflow: hidden;
        }
        .shimmer-hover::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(198, 198, 199, 0.1), transparent);
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
        .glass-card {
          transition: transform 0.5s, box-shadow 0.5s;
        }
        .glass-card:hover {
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        a, button {
          transition: color 0.3s, background-color 0.3s, border-color 0.3s, transform 0.2s, box-shadow 0.3s;
        }
        ::selection {
          background-color: #d4a574;
          color: #5b3a13;
        }
      `}</style>
    </div>
  );
}

export default StitchContainerNew2;
