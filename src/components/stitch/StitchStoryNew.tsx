/**
 * StitchStoryNew — AURA CAFE Our Story (Stitch design export conversion)
 *
 * Dark navy glassmorphism story page with hero, bento story grid,
 * vertical timeline, values cards, team section, CTA banner, and footer.
 * Source: stitch-exports/stitch_aura_cafe/aura_cafe_our_story/code.html
 * Mobile-first responsive. Chrome/silver + bronze accents.
 */
'use client';

import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  ArrowRight,
  Building2,
  Settings2,
  Moon,
  Verified,
  Coffee,
  Leaf,
  ChevronDown,
  Megaphone,
  Map,
  Mail,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface TeamMember {
  name: string;
  role: string;
  imageUrl: string;
  imageAlt: string;
}

export interface TimelinePhase {
  phase: string;
  year: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  isActive?: boolean;
}

export interface StitchStoryNewProps {
  heroBgUrl?: string;
  teamMembers?: TeamMember[];
  onCtaClick?: () => void;
  onNavClick?: (section: string) => void;
}

/* ─── Default Image URLs ────────────────────────────────────────────── */

const defaultHeroBgUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuACV1Udt-Hrc1M1LgOPzS7v8AzKj9LY37FvF84qcsl1xnhN5UpzbjAL7YECy1F2462ZGEk_OP-7A8hik2pOP99Nojnf51y7Mb9IXjGQlTQSBeym9fR_cxzw_ny6yQEcG98L50URyngya9UOMRkc7u4sVMPyLbRdY_AX2IBE_yf7BLinia4L9wIYd3OwmyUkxasutf0d7CdGedJ3TmOVNoAzkuqjCqp37ucfYgkbSivwlE_Pm9uErwenNM_ZOMrcNHe0Ix1egPArFyo';

const defaultArchImageUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCPfD_Jmk4XFRuVxW23V1fnlA6_1Qu-BNqDWJ2dpYOrn8KE3OveBmrH_EZjrTYFUye1O7Z7Gj2F4NBEqEUsDLx1urd5bqF8rfNfm__g3buZH-uLov62E2-ARnhpxV7zv_x_p4WMOBdCM_TGrZxa3MiOWyeKRL_W2uZj1KDk010YbY7YToBkm21ofLeEpe8RYO1cr4GNwf5WRzOjmdu22tBl8Js-tyfMD_Dri79MVsa3HrV0_T72l6Fzl0P1IKoO4OU5b6MB5KPfGas';

const defaultTimelineImages = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDrhST6weshnMyYXw_5Rn-ORCRUIsoDhbpt4ajVNC7rffHA7Ygn2Lpa6AvG4KEuHwCqsSAEeeXovAV2kvEOJVctf2y3oKYBKE3mSnN9kti5v0Y5bjMx7-cUNU8j6uBXF8SQFINn5nnN1uEv0-2r8_VKIWVen676wqEQwPLD3O1XQftQ-ZC6qbCN7BS2ejgf7UYM5aY4r-Qft1c6Y8dcrXqOClP6hxQ2bXEl0kNiy5wulHktiPGAbZzf1SyVlodxcRjyu3dp56PIh6Y',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDzYD6fZHQNR0tpkcoeWVdrTHNO7Y5o9j3mUU_OcfTKuY8u_hRj88Y6WeI0Y9qNb0gIdAw68wpMJm5mrk_c1K-9UC7xUHbRF3vRCjta0kLR-JE5ndeoDbWXyP-4ZiHQepOstt1XmmosLdZpMLCtM9X878CPMNhUhFI6sf241zxJROvJcMbZCYfQAGwjg_J9VVdKNfzURrMsBqsh4kAzEIXf1lx9w96rLKTI9iqa7s-mmymcJcRo4--IXyE1IbVTvr1E_IZUKL2GMso',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBYYcihYurow2nJrdoCiHePwHUYCxmNt1zlg0kMou4a5zFHuyLbwQbY5OqQJvPLeWaXqn_hUV5V6sJGl9OzUToekQCxgn1IDMC0Nsxy0Q9Gu-YJEM1SR8S5J4eWTQicX2ZwTPYqukPe2j6qMM2zMjs7HRbj5jRVAbKJeSiAe-bdslvZUWzABh6QeSjANkXYIi-OoMoLF6-PYx2GmL2oFp4rc89l3xVNJlUmH1ZsIYlcea3ho3bcBNH6oIX6hCInznM0NKWjqiSLwHc',
] as const; // length 3, indexes 0-2 always defined

const defaultTeamMembers: TeamMember[] = [
  {
    name: 'Elias Thorne',
    role: 'storyNew.teamRole1',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD0hTVOW-2T_HSEmq53Pb7AEZBFR8ae8eJMY3PL54yKWKRtc9WanD14EXEJmov3uC1btKTebvh8xQr1BkheLr9GnPYtaEBtln5SEecxLVz75JiU8Vf8wo3BAP4bFUXL1UXQ0_6CQvlvck3-HkAQYzX8mY-oOAV22qfADhgusqex-eb2bG3SQn2AJy-XJd76e8LG4atTMmuXQT6JPgVHZgbR7j4Ubp6es3ijUYIvxBCCuJQAtEFlMdccyJJvlYFvABHqRhDKBmx3OMM',
    imageAlt: 'Portrait of Elias Thorne, Principal Architect in dark turtleneck',
  },
  {
    name: 'Sarah Chen',
    role: 'storyNew.teamRole2',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDgfqivZ4J9F9ALO0GTgB_Z0rbCTmUEawwAR3hXr_VRk1h6IR3BcDC7KAMutiNOeRpxmwZlgVDY9V8_iYr-v8hJTfrkRWNkfvJyXcgKUWI8yIFHdLiIvcMo4yHk2tdaNRNoSaAzwEdjqWEjTb-i7e3RHKgN-kPRcwmfCV8kTbD-TrKGj_D2r2ogO-xEtstKWc1OOuYtLFJvj1HHJnyixp68v0NvphBEmertvS1t0AVjjT7VhuWtaE1O4KS0Bq0vOqpCySKxJhslSZQ',
    imageAlt: 'Portrait of Sarah Chen, Extraction Engineer holding glass beaker',
  },
  {
    name: 'Marcus Vane',
    role: 'storyNew.teamRole3',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAYaFzAQnHsBcweMI-ofjrDs7pX4coYiiouhaKBmGvhfibi7v8L2wPAZeTwkZXBTP4cY_eXb8wzqxzepG385zAsb1cEEzk-McHQF4m6D9Yr8YD1MTNJYKUoXxSuIc3hyozLHE0Ck2TDPqBtEWrtdsJUm8rLq2l231MGOHD9F1_xaK2lOX5tjqYa3Jq7m8_IcWvwCUq8CrzObjAiWVByuImnMtQET04w32DqQM8o7HvfEqzJoOo2RI_SOsfCvgxcx_7QpleGgYWcpvE',
    imageAlt: 'Portrait of Marcus Vane, Head of Roast in warehouse with coffee sacks',
  },
  {
    name: 'Lena Rossi',
    role: 'storyNew.teamRole4',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAvoHrNnq13Jbj-7p-DBqbVcqXI9vg6xDFaroJ0sK8Zvc0Li1IF7NgFOyRLz2rnimLmKipejw4MNY5SZgXDYR03xCNQGAqpPH7Ttw8pJSmuKZnrCLOYc0_EBUFmoh8r-I-FUbFQMw92vfpXcDpNQEJslu9GtwTeSmGcdfwLpB2211lwtVhxf70G8lbF2zyApMwot3LtykT5pEsDMSo-eqJ3N7Tuddj-_LhtDWgEfK14MidFI2_NBcTDU3c6YoQSoQtResKGGhdknV8',
    imageAlt: 'Portrait of Lena Rossi, Operations Lead in navy suit at cafe',
  },
];

/* ─── Navigation ─────────────────────────────────────────────────────── */

function NavBar({ onNavClick }: { onNavClick?: (section: string) => void }) {
  const { t } = useTranslation();
  const navItems = [
    { key: 'menu', label: t('storyNew.navMenu') },
    { key: 'story', label: t('storyNew.navStory'), active: true },
    { key: 'locations', label: t('storyNew.navLocations') },
    { key: 'gallery', label: t('storyNew.navGallery') },
    { key: 'reservation', label: t('storyNew.navReservation') },
  ];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-[rgba(68,71,77,0.3)] bg-white/[0.05] backdrop-blur-[20px]"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-[var(--aura-container-padding,24px)]">
        <a
          href="#"
          className="font-display text-[var(--aura-primary, #c6c6c7)] uppercase tracking-tighter"
          style={{ fontSize: 'var(--aura-text-title-lg, 20px)' }}
          aria-label="Aura Cafe home"
        >
          AURA CAFE
        </a>

        {/* Desktop nav links */}
        <div className="hidden items-center space-x-10 md:flex">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavClick?.(item.key)}
              className={clsx(
                'font-body text-xs uppercase tracking-wider transition-colors duration-300',
                item.active
                  ? 'border-b-2 border-[var(--aura-tertiary,#d4a574)] pb-1 text-[var(--aura-tertiary,#d4a574)]'
                  : 'text-[var(--aura-text-secondary,#a0a8b0)] hover:text-[var(--aura-tertiary,#d4a574)]',
              )}
              aria-label={item.label}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onNavClick?.('order')}
          className="bg-[var(--aura-tertiary,#d4a574)] px-6 py-2 text-xs font-bold uppercase tracking-widest text-[var(--aura-bg-page, #0A1A2E)] transition-all hover:bg-[var(--aura-tertiary,#d4a574)]"
          aria-label={t('storyNew.orderNow')}
        >
          {t('storyNew.orderNow')}
        </button>
      </div>
    </nav>
  );
}

/* ─── Hero Section ───────────────────────────────────────────────────── */

function HeroSection({ bgImageUrl }: { bgImageUrl: string }) {
  const { t } = useTranslation();

  return (
    <section
      className="relative flex h-screen items-center justify-center overflow-hidden"
      aria-label="Hero banner"
    >
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 z-10 bg-[var(--aura-bg-page, #0A1A2E)]/80" />
        <div
          className="h-full w-full bg-cover bg-center"
          style={{ backgroundImage: `url('${bgImageUrl}')` }}
          role="img"
          aria-label={t('storyNew.heroImageAlt')}
        />
      </div>

      {/* Content */}
      <div className="relative z-20 px-6 text-center">
        <p className="mb-6 block animate-pulse font-body text-sm uppercase tracking-[0.4em] text-[var(--aura-text-secondary,#a0a8b0)]">
          {t('storyNew.established')}
        </p>
        <h1 className="mx-auto mb-8 max-w-5xl font-display text-5xl font-medium leading-tight text-white md:text-8xl lg:text-9xl">
          {t('storyNew.heroTitle')}{' '}
          <span className="italic text-[var(--aura-tertiary,#d4a574)]">
            {t('storyNew.heroTitleItalic')}
          </span>
        </h1>
        <div className="mx-auto h-px w-24 opacity-50" style={{ backgroundColor: 'var(--aura-text-secondary, #a0a8b0)' }} />
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-4">
        <span className="font-body text-xs uppercase tracking-widest text-[var(--aura-text-secondary,#a0a8b0)] opacity-60">
          {t('storyNew.scrollToExplore')}
        </span>
        <ChevronDown className="h-5 w-5 animate-bounce text-[var(--aura-text-secondary,#a0a8b0)] opacity-60" />
      </div>
    </section>
  );
}

/* ─── Story Bento Grid Section ───────────────────────────────────────── */

function StorySection() {
  const { t } = useTranslation();

  return (
    <section
      className="px-[var(--aura-container-padding,24px)] py-24 md:py-32"
      aria-label={t('storyNew.storyTitle')}
    >
      <div className="mx-auto max-w-[1280px]">
        {/* Header */}
        <div className="mb-12 md:mb-16">
          <h2 className="mb-4 font-display text-4xl text-[var(--aura-text-primary,#e8e8e8)] md:text-5xl">
            {t('storyNew.storyTitle')}
          </h2>
          <p className="max-w-2xl font-light leading-relaxed text-[var(--aura-text-secondary,#a0a8b0)]">
            {t('storyNew.storyLead')}
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 gap-[var(--aura-card-gap,16px)] md:grid-cols-12">
          {/* Architectural Salvage — featured card */}
          <div className="group flex flex-col justify-between rounded-lg border border-[rgba(168,169,173,0.2)] border-t border-t-[rgba(168,169,173,0.4)] bg-white/[0.05] p-8 backdrop-blur-[20px] md:col-span-7 md:p-12">
            <div>
              <div className="mb-8 flex items-center gap-4">
                <Building2
                  className="h-8 w-8"
                  style={{ color: 'var(--aura-tertiary, #d4a574)' }}
                  aria-hidden="true"
                />
                <span className="font-bold tracking-tighter text-[var(--aura-text-secondary,#a0a8b0)]">
                  REF: 001
                </span>
              </div>
              <h3 className="mb-6 font-display text-2xl text-white md:text-3xl">
                {t('storyNew.refArchitecture')}
              </h3>
              <p className="leading-relaxed text-[var(--aura-text-secondary,#a0a8b0)]">
                {t('storyNew.descArchitecture')}
              </p>
            </div>
            <div className="mt-8 h-48 overflow-hidden rounded-lg border border-white/5 md:h-64">
              <img
                className="h-full w-full scale-105 object-cover opacity-70 grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0"
                src={defaultArchImageUrl}
                alt={t('storyNew.imgArchitectureAlt')}
                loading="lazy"
              />
            </div>
          </div>

          {/* Right column stack */}
          <div className="flex flex-col gap-[var(--aura-card-gap,16px)] md:col-span-5">
            {/* Precision Brewing */}
            <div className="group flex h-full flex-col rounded-lg border border-[rgba(168,169,173,0.2)] border-t border-t-[rgba(168,169,173,0.4)] bg-white/[0.05] p-8 backdrop-blur-[20px] md:p-10">
              <Settings2
                className="mb-6 h-7 w-7"
                style={{ color: 'var(--aura-tertiary, #d4a574)' }}
                aria-hidden="true"
              />
              <h3 className="mb-4 font-display text-xl text-white">
                {t('storyNew.refBrewing')}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--aura-text-secondary,#a0a8b0)]">
                {t('storyNew.descBrewing')}
              </p>
            </div>

            {/* Nocturnal Sanctuary */}
            <div className="group flex h-full flex-col rounded-lg border border-[rgba(168,169,173,0.2)] border-t border-t-[rgba(168,169,173,0.4)] bg-white/[0.05] p-8 backdrop-blur-[20px] md:p-10">
              <Moon
                className="mb-6 h-7 w-7"
                style={{ color: 'var(--aura-tertiary, #d4a574)' }}
                aria-hidden="true"
              />
              <h3 className="mb-4 font-display text-xl text-white">
                {t('storyNew.refSanctuary')}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--aura-text-secondary,#a0a8b0)]">
                {t('storyNew.descSanctuary')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Timeline Section ───────────────────────────────────────────────── */

const timelinePhases: TimelinePhase[] = [
  {
    phase: 'PHASE 01',
    year: '2022',
    title: 'storyNew.phase01Title',
    description: 'storyNew.phase01Desc',
    imageUrl: defaultTimelineImages[0],
    imageAlt: 'Architectural blueprints of container cafe layout on dark desk',
  },
  {
    phase: 'PHASE 02',
    year: '2023',
    title: 'storyNew.phase02Title',
    description: 'storyNew.phase02Desc',
    imageUrl: defaultTimelineImages[1],
    imageAlt: 'Welding spark on steel container frame in industrial workshop',
  },
  {
    phase: 'PHASE 03',
    year: '2024',
    title: 'storyNew.phase03Title',
    description: 'storyNew.phase03Desc',
    imageUrl: defaultTimelineImages[2],
    imageAlt: 'Completed Aura Cafe glowing at night with warm bronze light',
    isActive: true,
  },
];

function TimelineSection() {
  const { t } = useTranslation();

  return (
    <section
      className="relative py-24 md:py-32"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
      aria-label={t('storyNew.timelineTitle')}
    >
      <div className="mx-auto max-w-[1280px] px-[var(--aura-container-padding,24px)]">
        {/* Header */}
        <div className="mb-16 text-center md:mb-24">
          <h2
            className="mb-4 font-display text-4xl text-[var(--aura-text-primary,#e8e8e8)] md:text-5xl"
          >
            {t('storyNew.timelineTitle')}
          </h2>
          <p className="font-body text-xs uppercase tracking-[0.3em] text-[var(--aura-text-secondary,#a0a8b0)]">
            {t('storyNew.timelineSubtitle')}
          </p>
        </div>

        {/* Timeline */}
        <div className="relative mx-auto max-w-4xl">
          {/* Vertical line with gradient */}
          <div
            className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2"
            style={{
              background: 'linear-gradient(to bottom, transparent, #A8A9AD 15%, #A8A9AD 85%, transparent)',
            }}
          />

          {timelinePhases.map((phase, idx) => {
            const isLeft = idx % 2 === 0;
            return (
              <div
                key={phase.phase}
                className={clsx(
                  'relative mb-20 grid grid-cols-1 items-center gap-8 md:mb-32 md:grid-cols-2 md:gap-16',
                  idx === timelinePhases.length - 1 && 'mb-0',
                )}
              >
                {/* Text side */}
                <div
                  className={clsx(
                    !isLeft && 'md:order-2',
                    isLeft ? 'md:text-right' : 'md:text-left',
                  )}
                >
                  <p className="mb-2 block font-body text-xs font-bold tracking-widest text-[var(--aura-tertiary,#d4a574)]">
                    {phase.phase}: {phase.year}
                  </p>
                  <h4 className="mb-4 font-display text-2xl font-semibold text-white">
                    {t(phase.title)}
                  </h4>
                  <p className="text-sm text-[var(--aura-text-secondary,#a0a8b0)]">
                    {t(phase.description)}
                  </p>
                </div>

                {/* Image side */}
                <div
                  className={clsx(
                    'relative flex items-center',
                    isLeft ? 'justify-start md:justify-center' : 'justify-end md:justify-center',
                  )}
                >
                  {/* Timeline dot */}
                  <div
                    className={clsx(
                      'absolute z-10 h-4 w-4 rounded-full border-4',
                      isLeft ? '-left-[8.5px] md:left-auto' : '-left-[8.5px] md:right-auto',
                      phase.isActive
                        ? 'border-[var(--aura-tertiary,#d4a574)]'
                        : 'border-[var(--aura-bg-surface,#0d1b2a)]',
                    )}
                    style={{
                      backgroundColor: phase.isActive ? 'var(--aura-tertiary, #d4a574)' : 'var(--aura-bg-surface, #0d1b2a)',
                      boxShadow: phase.isActive ? '0 0 15px rgba(212, 165, 116, 0.5)' : 'none',
                    }}
                    aria-hidden="true"
                  />
                  <div
                    className={clsx(
                      'w-full rounded-lg border border-[rgba(168,169,173,0.2)] bg-white/[0.05] p-4 backdrop-blur-[20px] md:p-6',
                      isLeft ? 'ml-8 md:ml-0' : 'ml-8 md:ml-0',
                      phase.isActive && 'border-[rgba(212,165,116,0.3)]',
                    )}
                  >
                    <img
                      className={clsx(
                        'h-28 w-full object-cover md:h-32',
                        !phase.isActive && 'opacity-50 grayscale',
                      )}
                      src={phase.imageUrl}
                      alt={phase.imageAlt}
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Values Section ─────────────────────────────────────────────────── */

const valueCards = [
  {
    icon: Verified,
    title: 'storyNew.value1Title',
    description: 'storyNew.value1Desc',
  },
  {
    icon: Coffee,
    title: 'storyNew.value2Title',
    description: 'storyNew.value2Desc',
  },
  {
    icon: Leaf,
    title: 'storyNew.value3Title',
    description: 'storyNew.value3Desc',
  },
];

function ValuesSection() {
  const { t } = useTranslation();

  return (
    <section
      className="overflow-hidden px-[var(--aura-container-padding,24px)] py-24 md:py-32"
      aria-label="Core values"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-1 gap-[var(--aura-card-gap,16px)] md:grid-cols-3">
          {valueCards.map((value) => {
            const Icon = value.icon;
            return (
              <div
                key={value.title}
                className="group flex flex-col items-center rounded-lg border border-[rgba(168,169,173,0.2)] bg-white/[0.05] p-8 text-center backdrop-blur-[20px] md:p-12"
              >
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full border transition-colors duration-500 group-hover:border-[var(--aura-tertiary,#d4a574)]"
                  style={{ borderColor: 'rgba(168, 169, 173, 0.3)' }}
                >
                  <Icon
                    className="h-7 w-7 transition-colors duration-500 group-hover:text-[var(--aura-tertiary,#d4a574)]"
                    style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mb-4 font-display uppercase tracking-widest text-white">
                  {t(value.title)}
                </h3>
                <p className="text-sm font-light text-[var(--aura-text-secondary,#a0a8b0)]">
                  {t(value.description)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Team Section ───────────────────────────────────────────────────── */

function TeamSection({ members }: { members: TeamMember[] }) {
  const { t } = useTranslation();

  return (
    <section
      className="px-[var(--aura-container-padding,24px)] py-24 md:py-32"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
      aria-label={t('storyNew.teamTitle')}
    >
      <div className="mx-auto max-w-[1280px]">
        {/* Header */}
        <div className="mb-16 flex flex-col items-end justify-between gap-8 md:flex-row md:mb-24">
          <div>
            <h2 className="mb-4 font-display text-4xl text-[var(--aura-text-primary,#e8e8e8)] md:text-5xl">
              {t('storyNew.teamTitle')}
            </h2>
            <p
              className="max-w-md text-[var(--aura-text-secondary,#a0a8b0)]"
            >
              {t('storyNew.teamDesc')}
            </p>
          </div>
          <div className="hidden h-px w-full md:block md:w-64" style={{ backgroundColor: 'rgba(168, 169, 173, 0.2)' }} />
        </div>

        {/* Team grid */}
        <div className="grid grid-cols-1 gap-[var(--aura-card-gap,16px)] sm:grid-cols-2 md:grid-cols-4">
          {members.map((member) => (
            <div
              key={member.name}
              className="group"
              role="article"
              aria-label={member.name}
            >
              <div className="relative mb-6 aspect-[4/5] overflow-hidden rounded-lg border border-[rgba(168,169,173,0.2)] bg-white/[0.05] backdrop-blur-[20px]">
                <img
                  className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                  src={member.imageUrl}
                  alt={member.imageAlt}
                  loading="lazy"
                />
              </div>
              <h4
                className="mb-1 text-lg font-bold tracking-tight text-white"
                style={{ fontFamily: "var(--aura-font-body)" }}
              >
                {member.name}
              </h4>
              <p className="font-body text-xs font-bold uppercase tracking-widest text-[var(--aura-tertiary,#d4a574)]">
                {t(member.role)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA Section ────────────────────────────────────────────────────── */

function CtaSection({ onCtaClick }: { onCtaClick?: () => void }) {
  const { t } = useTranslation();

  return (
    <section
      className="px-[var(--aura-container-padding,24px)] py-32 text-center md:py-40"
      aria-label="Call to action"
    >
      <div className="glass-card-story relative mx-auto max-w-4xl overflow-hidden rounded-lg border border-[rgba(168,169,173,0.2)] bg-white/[0.05] p-12 backdrop-blur-[20px] md:p-24">
        {/* Glow orbs */}
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full blur-[100px]" style={{ backgroundColor: 'rgba(212, 165, 116, 0.1)' }} />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full blur-[100px]" style={{ backgroundColor: 'rgba(184, 199, 226, 0.1)' }} />

        <h2 className="mb-8 font-display text-4xl leading-tight text-white md:text-6xl">
          {t('storyNew.ctaTitle')}
        </h2>
        <p className="mx-auto mb-12 max-w-xl font-light leading-relaxed text-[var(--aura-text-secondary,#a0a8b0)]">
          {t('storyNew.ctaDesc')}
        </p>

        <button
          type="button"
          onClick={onCtaClick}
          className="mx-auto flex items-center gap-3 px-12 py-4 font-body text-xs font-bold uppercase tracking-[0.2em] text-[var(--aura-bg-page, #0A1A2E)] shadow-xl shadow-[rgba(212,165,116,0.1)] transition-all duration-300 hover:bg-[var(--aura-tertiary,#d4a574)]"
          style={{ backgroundColor: 'var(--aura-tertiary, #d4a574)' }}
          aria-label={t('storyNew.ctaButton')}
        >
          {t('storyNew.ctaButton')}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────── */

function FooterSection() {
  const { t } = useTranslation();
  const footerLinks = [
    {
      heading: t('storyNew.footerLegalHeading'),
      links: [
        { label: t('storyNew.footerPrivacy'), key: 'privacy' },
        { label: t('storyNew.footerTerms'), key: 'terms' },
        { label: t('storyNew.footerSustainability'), key: 'sustainability' },
      ],
    },
    {
      heading: t('storyNew.footerCompanyHeading'),
      links: [
        { label: t('storyNew.footerCareers'), key: 'careers' },
        { label: t('storyNew.footerPressKit'), key: 'press' },
        { label: t('storyNew.footerContact'), key: 'contact' },
      ],
    },
  ];

  const socialIcons = [
    { icon: Megaphone, label: 'Brand awareness', key: 'brand' },
    { icon: Map, label: 'Location', key: 'location' },
    { icon: Mail, label: 'Email', key: 'email' },
  ];

  return (
    <footer
      className="border-t border-[rgba(68,71,77,0.2)] px-[var(--aura-container-padding,24px)] py-20"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
      aria-label="Site footer"
    >
      <div className="mx-auto max-w-[1280px]">
        {/* Upper grid */}
        <div className="mb-20 grid grid-cols-1 gap-6 md:grid-cols-4">
          {/* Brand column */}
          <div className="md:col-span-2">
            <p className="mb-6 font-display text-2xl uppercase text-[var(--aura-text-primary,#e8e8e8)]">
              AURA CAFE
            </p>
            <p className="mb-8 max-w-sm text-xs leading-relaxed text-[var(--aura-text-secondary,#a0a8b0)]">
              {t('storyNew.footerTagline')}
            </p>
            <div className="flex gap-6">
              {socialIcons.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.key}
                    href="#"
                    className="text-[var(--aura-text-secondary,#a0a8b0)] transition-colors hover:text-[var(--aura-tertiary,#d4a574)]"
                    aria-label={item.label}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {footerLinks.map((group) => (
            <div key={group.heading} className="flex flex-col gap-4">
              <h5 className="mb-2 text-xs font-bold uppercase tracking-widest text-white">
                {group.heading}
              </h5>
              {group.links.map((link) => (
                <a
                  key={link.key}
                  href="#"
                  className="text-xs text-[var(--aura-text-secondary,#a0a8b0)] transition-all hover:text-[var(--aura-tertiary,#d4a574)] active:translate-x-1"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
          <p className="text-xs text-[var(--aura-text-secondary,#a0a8b0)]">
            {t('storyNew.footerCopyright')}
          </p>
          <p className="text-[10px] tracking-widest text-[var(--aura-text-secondary,#a0a8b0)]">
            {t('storyNew.footerVersion')}
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export function StitchStoryNew({
  heroBgUrl = defaultHeroBgUrl,
  teamMembers = defaultTeamMembers,
  onCtaClick,
  onNavClick,
}: Readonly<StitchStoryNewProps>) {
  const { t } = useTranslation();

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--aura-bg-page, #0A1A2E)',
        color: 'var(--aura-text-primary, #e8e8e8)',
      }}
    >
      {/* Navigation */}
      <NavBar onNavClick={onNavClick} />

      {/* Hero */}
      <HeroSection bgImageUrl={heroBgUrl} />

      {/* Story bento grid */}
      <StorySection />

      {/* Timeline */}
      <TimelineSection />

      {/* Values */}
      <ValuesSection />

      {/* Team */}
      <TeamSection members={teamMembers} />

      {/* CTA */}
      <CtaSection onCtaClick={onCtaClick} />

      {/* Footer */}
      <FooterSection />
    </div>
  );
}

export default StitchStoryNew;
