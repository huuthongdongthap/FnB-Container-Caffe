/**
 * StitchStoryNew — AURA CAFE Our Story (Stitch design export conversion)
 *
 * Pixel-perfect conversion from Stitch HTML export.
 * Dark navy glassmorphism story page with hero, bento story grid,
 * vertical timeline, values cards, team section, CTA banner, and footer.
 * Source: stitch-exports/stitch_aura_cafe/aura_cafe_our_story/code.html
 * Mobile-first responsive. Chrome/silver + bronze accents.
 */
'use client';

import { useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  ArrowRight,
  Building2,
  Settings2,
  Moon,
  Verified,
  Settings,
  Leaf,
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
    { key: 'menu', label: t('storyNew.navMenu', { defaultValue: 'Menu' }) },
    { key: 'story', label: t('storyNew.navStory', { defaultValue: 'Story' }), active: true },
    { key: 'locations', label: t('storyNew.navLocations', { defaultValue: 'Locations' }) },
    { key: 'gallery', label: t('storyNew.navGallery', { defaultValue: 'Gallery' }) },
    { key: 'reservation', label: t('storyNew.navReservation', { defaultValue: 'Reservation' }) },
  ];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-[rgba(68,71,77,0.3)] backdrop-blur-[20px]"
      style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-[var(--aura-container-padding,64px)]">
        <a
          href="#"
          className="font-display text-[var(--aura-primary,#b8c7e2)] uppercase tracking-tighter"
          style={{ fontSize: 'var(--aura-text-title-lg, 20px)', fontFamily: "'Libre Caslon Text', 'Cormorant Garamond', Georgia, serif" }}
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
                  ? 'border-b-2 border-[var(--aura-tertiary,#e7c090)] pb-1 text-[var(--aura-tertiary,#e7c090)]'
                  : 'text-[var(--aura-text-secondary,#c5c6cd)] hover:text-[var(--aura-tertiary,#e7c090)]',
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
          className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-[#050D17] transition-all"
          style={{
            backgroundColor: 'var(--aura-bronze, #96754B)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--aura-tertiary, #e7c090)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--aura-bronze, #96754B)'; }}
          aria-label={t('storyNew.orderNow', { defaultValue: 'Order Now' })}
        >
          {t('storyNew.orderNow', { defaultValue: 'Order Now' })}
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
          aria-label={t('storyNew.heroImageAlt', { defaultValue: 'A cinematic, high-resolution shot of a modern architectural cafe built from matte black industrial containers at night. Soft bronze lighting spills from floor-to-ceiling glass windows, illuminating a sleek chrome espresso machine. The atmosphere is nocturnal and sophisticated, with deep navy and charcoal tones dominating the palette, reflecting a high-end industrial luxury aesthetic.' })}
        />
      </div>

      {/* Content */}
      <div className="relative z-20 px-6 text-center">
        <p className="mb-6 block animate-pulse font-body text-sm uppercase tracking-[0.4em] text-[var(--aura-chrome,#A8A9AD)]">
          {t('storyNew.established', { defaultValue: 'Established 2024' })}
        </p>
        <h1 className="mx-auto mb-8 max-w-5xl font-display text-6xl font-medium leading-tight text-white md:text-8xl lg:text-9xl">
          {t('storyNew.heroTitle', { defaultValue: 'The Art of the' })}{' '}
          <span className="italic text-[var(--aura-tertiary,#e7c090)]">
            {t('storyNew.heroTitleItalic', { defaultValue: 'Nocturnal Pour' })}
          </span>
        </h1>
        <div className="mx-auto h-px w-24 opacity-50" style={{ backgroundColor: 'var(--aura-chrome, #A8A9AD)' }} />
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-4">
        <span className="font-body text-xs uppercase tracking-widest text-[var(--aura-chrome,#A8A9AD)] opacity-60">
          {t('storyNew.scrollToExplore', { defaultValue: 'Scroll to Explore' })}
        </span>
        {/* Vertical gradient line matching original HTML — pixel-perfect */}
        <div className="h-16 w-px" style={{ background: 'linear-gradient(to bottom, #A8A9AD, transparent)' }} />
      </div>
    </section>
  );
}

/* ─── Story Bento Grid Section ───────────────────────────────────────── */

function StorySection() {
  const { t } = useTranslation();

  return (
    <section
      className="px-[var(--aura-container-padding,64px)] py-32"
      aria-label={t('storyNew.storyTitle', { defaultValue: 'The Blueprint' })}
    >
      <div className="mx-auto max-w-[1280px]">
        {/* Header */}
        <div className="mb-16">
          <h2 className="mb-4 font-display text-4xl text-[var(--aura-primary,#b8c7e2)] md:text-5xl" style={{ fontFamily: "'Libre Caslon Text', 'Cormorant Garamond', Georgia, serif" }}>
            {t('storyNew.storyTitle', { defaultValue: 'The Blueprint' })}
          </h2>
          <p className="max-w-2xl font-light leading-relaxed text-[var(--aura-text-secondary,#c5c6cd)]">
            {t('storyNew.storyLead', { defaultValue: "Aura Cafe is more than a destination; it's a structural dialogue between raw industrial resilience and the ephemeral beauty of the perfect roast." })}
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 gap-[var(--aura-card-gap,24px)] md:grid-cols-12">
          {/* Architectural Salvage — featured card */}
          <div
            className="group flex flex-col justify-between rounded-lg border border-[rgba(168,169,173,0.2)] border-t border-t-[rgba(168,169,173,0.4)] bg-white/[0.05] p-12 backdrop-blur-[20px] md:col-span-7"
            data-reveal
          >
            <div>
              <div className="mb-8 flex items-center gap-4">
                <Building2
                  className="h-8 w-8"
                  style={{ color: 'var(--aura-tertiary, #e7c090)' }}
                  aria-hidden="true"
                />
                <span className="font-bold tracking-tighter text-[var(--aura-chrome,#A8A9AD)]">
                  REF: 001
                </span>
              </div>
              <h3 className="mb-6 font-display text-2xl text-white md:text-3xl">
                {t('storyNew.refArchitecture', { defaultValue: 'Architectural Salvage' })}
              </h3>
              <p className="leading-relaxed text-[var(--aura-text-secondary,#c5c6cd)]">
                {t('storyNew.descArchitecture', { defaultValue: 'Our foundation is built from decommissioned cargo containers, re-engineered as minimalist glass-walled sanctuaries. We embrace the industrial scars of the steel, celebrating its history while housing the future of hospitality.' })}
              </p>
            </div>
            <div className="mt-12 h-64 overflow-hidden rounded-lg border border-white/5">
              <img
                className="h-full w-full object-cover opacity-70 grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
                src={defaultArchImageUrl}
                alt={t('storyNew.imgArchitectureAlt', { defaultValue: 'Close up architectural detail of a weathered industrial container corner meeting a sharp, clean chrome glass frame. The lighting is moody and focused, highlighting the contrast between the rough matte texture of the navy steel and the reflective brilliance of the metallic accents. High-end nocturnal luxury cafe environment.' })}
                loading="lazy"
              />
            </div>
          </div>

          {/* Right column stack */}
          <div className="flex flex-col gap-[var(--aura-card-gap,24px)] md:col-span-5">
            {/* Precision Brewing */}
            <div
              className="group flex h-full flex-col rounded-lg border border-[rgba(168,169,173,0.2)] border-t border-t-[rgba(168,169,173,0.4)] bg-white/[0.05] p-10 backdrop-blur-[20px]"
              data-reveal
            >
              <Settings2
                className="mb-6 h-7 w-7"
                style={{ color: 'var(--aura-tertiary, #e7c090)' }}
                aria-hidden="true"
              />
              <h3 className="mb-4 font-display text-xl text-white">
                {t('storyNew.refBrewing', { defaultValue: 'Precision Brewing' })}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--aura-text-secondary,#c5c6cd)]">
                {t('storyNew.descBrewing', { defaultValue: 'We view extraction as an engineering challenge. Utilizing custom-modded pressure profiles and laboratory-grade filtration, every pour is a repeatable masterpiece of flavor chemistry.' })}
              </p>
            </div>

            {/* Nocturnal Sanctuary */}
            <div
              className="group flex h-full flex-col rounded-lg border border-[rgba(168,169,173,0.2)] border-t border-t-[rgba(168,169,173,0.4)] bg-white/[0.05] p-10 backdrop-blur-[20px]"
              data-reveal
            >
              <Moon
                className="mb-6 h-7 w-7"
                style={{ color: 'var(--aura-tertiary, #e7c090)' }}
                aria-hidden="true"
              />
              <h3 className="mb-4 font-display text-xl text-white">
                {t('storyNew.refSanctuary', { defaultValue: 'Nocturnal Sanctuary' })}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--aura-text-secondary,#c5c6cd)]">
                {t('storyNew.descSanctuary', { defaultValue: 'Designed for the night owls, the thinkers, and the quiet creators. Our lighting is calibrated to the golden hour, creating a focus-enhancing void in the heart of the city.' })}
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
      className="relative py-32"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0c0e10)' }}
      aria-label={t('storyNew.timelineTitle', { defaultValue: 'Evolutionary Cycle' })}
    >
      <div className="mx-auto max-w-[1280px] px-[var(--aura-container-padding,64px)]">
        {/* Header */}
        <div className="mb-24 text-center">
          <h2
            className="mb-4 font-display text-4xl text-[var(--aura-primary,#b8c7e2)] md:text-5xl"
            style={{ fontFamily: "'Libre Caslon Text', 'Cormorant Garamond', Georgia, serif" }}
          >
            {t('storyNew.timelineTitle', { defaultValue: 'Evolutionary Cycle' })}
          </h2>
          <p className="font-body text-xs uppercase tracking-[0.3em] text-[var(--aura-chrome,#A8A9AD)]">
            {t('storyNew.timelineSubtitle', { defaultValue: 'From Prototype to Perfection' })}
          </p>
        </div>

        {/* Timeline */}
        <div className="relative mx-auto max-w-4xl">
          {/* Vertical line with gradient — matches original chrome color */}
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
                  'relative mb-32 grid grid-cols-1 items-center gap-16 md:grid-cols-2',
                  idx === timelinePhases.length - 1 && 'mb-0',
                )}
                data-reveal
              >
                {/* Text side */}
                <div
                  className={clsx(
                    !isLeft && 'md:order-2',
                    isLeft ? 'md:text-right' : 'md:text-left',
                  )}
                >
                  <p className="mb-2 block font-body text-xs font-bold tracking-widest text-[var(--aura-tertiary,#e7c090)]">
                    {`${phase.phase}: ${phase.year}`}
                  </p>
                  <h4 className="mb-4 font-display text-2xl font-semibold text-white">
                    {t(phase.title, { defaultValue: phase.title === 'storyNew.phase01Title' ? 'The Concept Blueprint' : phase.title === 'storyNew.phase02Title' ? 'Structural Assembly' : 'Activation' })}
                  </h4>
                  <p className="text-sm text-[var(--aura-text-secondary,#c5c6cd)]">
                    {t(phase.description, { defaultValue: phase.description === 'storyNew.phase01Desc' ? 'Initial visioning of a cafe that exists at the intersection of container architecture and technical brewing precision.' : phase.description === 'storyNew.phase02Desc' ? 'Salvaging three high-cube containers and re-engineering them with reinforced frames and panoramic glass panels.' : 'Aura Cafe opens its doors, establishing a new standard for the nocturnal coffee experience in the city center.' })}
                  </p>
                </div>

                {/* Image side */}
                <div
                  className={clsx(
                    'relative flex items-center',
                    isLeft ? 'justify-start md:justify-center' : 'justify-end md:justify-center',
                  )}
                >
                  {/* Timeline dot — matches original: bronze for non-active, tertiary for active, border-background ring */}
                  <div
                    className={clsx(
                      'absolute z-10 h-4 w-4 rounded-full border-4',
                      isLeft ? '-left-[8.5px] md:left-auto' : '-left-[8.5px] md:right-auto',
                    )}
                    style={{
                      backgroundColor: phase.isActive ? 'var(--aura-tertiary, #e7c090)' : 'var(--aura-bronze, #96754B)',
                      borderColor: 'var(--aura-bg-page, #0A1A2E)',
                      boxShadow: phase.isActive ? '0 0 15px rgba(231,192,144,0.5)' : 'none',
                    }}
                    aria-hidden="true"
                  />
                  <div
                    className={clsx(
                      'w-full rounded-lg border border-[rgba(168,169,173,0.2)] bg-white/[0.05] p-6 backdrop-blur-[20px]',
                      isLeft ? 'ml-8 md:ml-0' : 'ml-8 md:ml-0',
                      phase.isActive && 'border-[rgba(231,192,144,0.3)]',
                    )}
                  >
                    <img
                      className={clsx(
                        'h-32 w-full object-cover',
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
    icon: Settings,
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
      className="overflow-hidden px-[var(--aura-container-padding,64px)] py-32"
      aria-label="Core values"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-1 gap-[var(--aura-card-gap,24px)] md:grid-cols-3">
          {valueCards.map((value) => {
            const Icon = value.icon;
            return (
              <div
                key={value.title}
                className="group flex flex-col items-center rounded-lg border border-[rgba(168,169,173,0.2)] bg-white/[0.05] p-12 text-center backdrop-blur-[20px]"
                data-reveal
              >
                <div
                  className="mb-8 flex h-16 w-16 items-center justify-center rounded-full border transition-colors duration-500 group-hover:border-[var(--aura-tertiary,#e7c090)]"
                  style={{ borderColor: 'rgba(168, 169, 173, 0.3)' }}
                >
                  <Icon
                    className="h-7 w-7 transition-colors duration-500 group-hover:text-[var(--aura-tertiary,#e7c090)]"
                    style={{ color: 'var(--aura-chrome, #A8A9AD)' }}
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mb-4 font-display uppercase tracking-widest text-white">
                  {t(value.title, { defaultValue: value.title === 'storyNew.value1Title' ? 'Purity' : value.title === 'storyNew.value2Title' ? 'Integrity' : 'Sustainability' })}
                </h3>
                <p className="text-sm font-light text-[var(--aura-text-secondary,#c5c6cd)]">
                  {t(value.description, { defaultValue: value.description === 'storyNew.value1Desc' ? 'Zero compromise on origin. We source only single-estate beans that meet our rigorous chemical profile standards.' : value.description === 'storyNew.value2Desc' ? 'Transparency in every gear. Our brewing process is fully visible, inviting curiosity and conversation.' : 'Engineered for longevity. From container re-use to zero-waste filtration, we respect the machine that is our planet.' })}
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

  const teamTitleText = t('storyNew.teamTitle', { defaultValue: 'The Minds Behind\nthe Machine' });

  return (
    <section
      className="px-[var(--aura-container-padding,64px)] py-32"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0c0e10)' }}
      aria-label="Team"
    >
      <div className="mx-auto max-w-[1280px]">
        {/* Header */}
        <div className="mb-24 flex flex-col items-end justify-between gap-8 md:flex-row">
          <div>
            <h2 className="mb-4 font-display text-4xl text-[var(--aura-primary,#b8c7e2)] md:text-5xl" style={{ fontFamily: "'Libre Caslon Text', 'Cormorant Garamond', Georgia, serif" }}>
              {teamTitleText.split('\n').map((line, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </h2>
            <p className="max-w-md text-[var(--aura-text-secondary,#c5c6cd)]">
              {t('storyNew.teamDesc', { defaultValue: 'Our team consists of industrial designers, chemical engineers, and master roasters united by a singular focus.' })}
            </p>
          </div>
          <div className="hidden h-px w-full md:block md:w-64" style={{ backgroundColor: 'rgba(168, 169, 173, 0.2)' }} />
        </div>

        {/* Team grid */}
        <div className="grid grid-cols-1 gap-[var(--aura-card-gap,24px)] sm:grid-cols-2 md:grid-cols-4">
          {members.map((member) => (
            <div
              key={member.name}
              className="group"
              role="article"
              aria-label={member.name}
              data-reveal
            >
              <div className="relative mb-6 aspect-[4/5] overflow-hidden rounded-lg border border-[rgba(168,169,173,0.2)] bg-white/[0.05] backdrop-blur-[20px]">
                <img
                  className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                  src={member.imageUrl}
                  alt={member.imageAlt}
                  loading="lazy"
                />
              </div>
              <h4 className="mb-1 text-lg font-bold tracking-tight text-white" style={{ fontFamily: 'var(--aura-font-body)' }}>
                {member.name}
              </h4>
              <p className="font-body text-xs font-bold uppercase tracking-widest text-[var(--aura-tertiary,#e7c090)]">
                {t(member.role, { defaultValue: member.role === 'storyNew.teamRole1' ? 'Principal Architect' : member.role === 'storyNew.teamRole2' ? 'Extraction Engineer' : member.role === 'storyNew.teamRole3' ? 'Head of Roast' : 'Operations Lead' })}
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
      className="px-[var(--aura-container-padding,64px)] py-40 text-center"
      aria-label="Call to action"
    >
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-lg border border-[rgba(168,169,173,0.2)] bg-white/[0.05] p-24 backdrop-blur-[20px]">
        {/* Glow orbs */}
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full blur-[100px]" style={{ backgroundColor: 'rgba(231, 192, 144, 0.1)' }} />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full blur-[100px]" style={{ backgroundColor: 'rgba(184, 199, 226, 0.1)' }} />

        <h2 className="mb-8 font-display text-5xl leading-tight text-white md:text-7xl">
          {t('storyNew.ctaTitle', { defaultValue: 'Join the Pulse.' })}
        </h2>
        <p className="mx-auto mb-12 max-w-xl font-light leading-relaxed text-[var(--aura-text-secondary,#c5c6cd)]">
          {t('storyNew.ctaDesc', { defaultValue: 'Experience the convergence of architectural design and the world\'s most precise caffeine delivery system.' })}
        </p>

        <button
          type="button"
          onClick={onCtaClick}
          className="mx-auto flex items-center gap-3 px-12 py-4 font-body text-xs font-bold uppercase tracking-[0.2em] text-[#050D17] shadow-xl transition-all duration-300"
          style={{
            backgroundColor: 'var(--aura-bronze, #96754B)',
            boxShadow: '0 10px 15px -3px rgba(150,117,75,0.1), 0 4px 6px -4px rgba(150,117,75,0.1)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--aura-tertiary, #e7c090)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--aura-bronze, #96754B)'; }}
          aria-label={t('storyNew.ctaButton', { defaultValue: 'Experience the Precision' })}
        >
          {t('storyNew.ctaButton', { defaultValue: 'Experience the Precision' })}
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
      heading: t('storyNew.footerLegalHeading', { defaultValue: 'Legal & Ethics' }),
      links: [
        { label: t('storyNew.footerPrivacy', { defaultValue: 'Privacy Policy' }), key: 'privacy' },
        { label: t('storyNew.footerTerms', { defaultValue: 'Terms of Service' }), key: 'terms' },
        { label: t('storyNew.footerSustainability', { defaultValue: 'Sustainability' }), key: 'sustainability' },
      ],
    },
    {
      heading: t('storyNew.footerCompanyHeading', { defaultValue: 'Company' }),
      links: [
        { label: t('storyNew.footerCareers', { defaultValue: 'Careers' }), key: 'careers' },
        { label: t('storyNew.footerPressKit', { defaultValue: 'Press Kit' }), key: 'press' },
        { label: t('storyNew.footerContact', { defaultValue: 'Contact' }), key: 'contact' },
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
      className="border-t border-[rgba(68,71,77,0.2)] px-[var(--aura-container-padding,64px)] py-20"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0c0e10)' }}
      aria-label="Site footer"
    >
      <div className="mx-auto max-w-[1280px]">
        {/* Upper grid */}
        <div className="mb-20 grid grid-cols-1 gap-6 md:grid-cols-4">
          {/* Brand column */}
          <div className="md:col-span-2">
            <p className="mb-6 font-display text-2xl uppercase text-[var(--aura-primary,#b8c7e2)]" style={{ fontFamily: "'Libre Caslon Text', 'Cormorant Garamond', Georgia, serif" }}>
              AURA CAFE
            </p>
            <p className="mb-8 max-w-sm text-xs leading-relaxed text-[var(--aura-text-secondary,#c5c6cd)]">
              {t('storyNew.footerTagline', { defaultValue: 'ENGINEERED ELEGANCE. NOCTURNAL SANCTUARY. RE-DEFINING THE ARCHITECTURE OF HOSPITALITY THROUGH PRECISION AND SALVAGE.' })}
            </p>
            <div className="flex gap-6">
              {socialIcons.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.key}
                    href="#"
                    className="text-[var(--aura-chrome,#A8A9AD)] transition-colors hover:text-[var(--aura-tertiary,#e7c090)]"
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
                  className="text-xs text-[var(--aura-text-secondary,#c5c6cd)] transition-all hover:text-[var(--aura-tertiary,#e7c090)] active:translate-x-1"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
          <p className="text-xs text-[var(--aura-text-secondary,#c5c6cd)]">
            {t('storyNew.footerCopyright', { defaultValue: '© 2024 AURA CAFE. ENGINEERED ELEGANCE.' })}
          </p>
          <p className="text-[10px] tracking-widest text-[var(--aura-chrome,#A8A9AD)]">
            {t('storyNew.footerVersion', { defaultValue: 'VERSION 2.0.4 // SYSTEM: ACTIVE' })}
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Scroll Reveal Effect ───────────────────────────────────────────── */

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-10');
          }
        });
      },
      { threshold: 0.1 },
    );

    const els = document.querySelectorAll('[data-reveal]');
    els.forEach((el) => {
      el.classList.add('transition-all', 'duration-1000', 'opacity-0', 'translate-y-10');
      observer.observe(el);
    });

    return () => {
      els.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, []);
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export function StitchStoryNew({
  heroBgUrl = defaultHeroBgUrl,
  teamMembers = defaultTeamMembers,
  onCtaClick,
  onNavClick,
}: Readonly<StitchStoryNewProps>) {
  useScrollReveal();

  return (
    <div
      className="min-h-screen"
      style={{
        /* Override global CSS variables within this component to match original Stitch design */
        '--aura-bg-page': '#0A1A2E',
        '--aura-bg-surface': '#0c0e10',
        '--aura-primary': '#b8c7e2',
        '--aura-tertiary': '#e7c090',
        '--aura-bronze': '#96754B',
        '--aura-chrome': '#A8A9AD',
        '--aura-text-primary': '#b8c7e2',
        '--aura-text-secondary': '#c5c6cd',
        '--aura-text-body': '#e2e2e5',
        '--aura-container-padding': '64px',
        '--aura-card-gap': '24px',
        backgroundColor: 'var(--aura-bg-page)',
        color: 'var(--aura-text-body)',
      } as React.CSSProperties}
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
