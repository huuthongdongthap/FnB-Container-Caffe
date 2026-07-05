/**
 * StitchStoryNew — AURA CAFE Our Story (pixel-perfect Stitch HTML conversion)
 *
 * IDENTICAL match to: stitch-exports/stitch_aura_cafe/aura_cafe_our_story/code.html
 * Dark navy glassmorphism story page with hero, bento story grid,
 * vertical timeline, values cards, team section, CTA banner, and footer.
 *
 * RULES followed:
 * - Mapped to --st-* design tokens for theming consistency
 * - EXACT Tailwind classes from HTML (converted to arbitrary values for custom theme tokens)
 * - EXACT font stacks from HTML
 * - EXACT layout structure, spacing, and nesting
 * - i18n wrapping via t("key", {defaultValue})
 * - lucide-react icons instead of material-symbols-outlined
 */
'use client';

import { useEffect, Fragment } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
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
] as const;

const defaultTeamMembers: TeamMember[] = [
  {
    name: 'Elias Thorne',
    role: 'storyNew.teamRole1',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD0hTVOW-2T_HSEmq53Pb7AEZBFR8ae8eJMY3PL54yKWKRtc9WanD14EXEJmov3uC1btKTebvh8xQr1BkheLr9GnPYtaEBtln5SEecxLVz75JiU8Vf8wo3BAP4bFUXL1UXQ0_6CQvlvck3-HkAQYzX8mY-oOAV22qfADhgusqex-eb2bG3SQn2AJy-XJd76e8LG4atTMmuXQT6JPgVHZgbR7j4Ubp6es3ijUYIvxBCCuJQAtEFlMdccyJJvlYFvABHqRhDKBmx3OMM',
    imageAlt:
      'Portrait of a male architectural designer in his late 30s with short hair and glasses, wearing a minimalist black turtleneck. He is standing in front of a blurred industrial structure. The lighting is moody, high-contrast, and cold with a focus on sharp professional features. Dark navy aesthetic.',
  },
  {
    name: 'Sarah Chen',
    role: 'storyNew.teamRole2',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDgfqivZ4J9F9ALO0GTgB_Z0rbCTmUEawwAR3hXr_VRk1h6IR3BcDC7KAMutiNOeRpxmwZlgVDY9V8_iYr-v8hJTfrkRWNkfvJyXcgKUWI8yIFHdLiIvcMo4yHk2tdaNRNoSaAzwEdjqWEjTb-i7e3RHKgN-kPRcwmfCV8kTbD-TrKGj_D2r2ogO-xEtstKWc1OOuYtLFJvj1HHJnyixp68v0NvphBEmertvS1t0AVjjT7VhuWtaE1O4KS0Bq0vOqpCySKxJhslSZQ',
    imageAlt:
      'Portrait of a female coffee scientist in her late 20s with her hair pulled back, wearing a minimalist dark grey uniform. She is holding a glass beaker in a high-tech lab setting. The lighting is crisp and cool, emphasizing precision and scientific expertise. Dark navy and chrome atmosphere.',
  },
  {
    name: 'Marcus Vane',
    role: 'storyNew.teamRole3',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAYaFzAQnHsBcweMI-ofjrDs7pX4coYiiouhaKBmGvhfibi7v8L2wPAZeTwkZXBTP4cY_eXb8wzqxzepG385zAsb1cEEzk-McHQF4m6D9Yr8YD1MTNJYKUoXxSuIc3hyozLHE0Ck2TDPqBtEWrtdsJUm8rLq2l231MGOHD9F1_xaK2lOX5tjqYa3Jq7m8_IcWvwCUq8CrzObjAiWVByuImnMtQET04w32DqQM8o7HvfEqzJoOo2RI_SOsfCvgxcx_7QpleGgYWcpvE',
    imageAlt:
      'Portrait of a master roaster, a man with a well-groomed beard wearing an apron, standing in a warehouse filled with burlap coffee sacks. The environment is dark and industrial with a warm spotlight on him. Serious and dedicated expression. Deep navy and bronze color tones.',
  },
  {
    name: 'Lena Rossi',
    role: 'storyNew.teamRole4',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAvoHrNnq13Jbj-7p-DBqbVcqXI9vg6xDFaroJ0sK8Zvc0Li1IF7NgFOyRLz2rnimLmKipejw4MNY5SZgXDYR03xCNQGAqpPH7Ttw8pJSmuKZnrCLOYc0_EBUFmoh8r-I-FUbFQMw92vfpXcDpNQEJslu9GtwTeSmGcdfwLpB2211lwtVhxf70G8lbF2zyApMwot3LtykT5pEsDMSo-eqJ3N7Tuddj-_LhtDWgEfK14MidFI2_NBcTDU3c6YoQSoQtResKGGhdknV8',
    imageAlt:
      'Portrait of a professional operations manager, a woman in a sleek navy suit, standing in a modern cafe with blurred chrome surfaces behind her. She looks confident and organized. The lighting is soft but directed, highlighting luxury hospitality. Professional dark mode aesthetic.',
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
      className="fixed top-0 w-full z-50 bg-white/5 backdrop-blur-[20px] border-b border-[color-mix(in_srgb,var(--aura-chrome-dim)_30%,transparent)]"
      aria-label="Main navigation"
    >
      <div className="flex justify-between items-center px-[64px] py-2 max-w-[1280px] mx-auto h-20">
        <div
          className="uppercase tracking-tighter text-[var(--aura-noir-void)]"
          style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '20px' }}
        >
          AURA CAFE
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center space-x-10">
          {navItems.map((item) => (
            <a
              key={item.key}
              href={item.key === 'menu' ? '/menu' : item.key === 'story' ? '/about' : item.key === 'locations' ? '/locations' : item.key === 'gallery' ? '/gallery' : item.key === 'reservation' ? '/reservation' : '#'}
              onClick={(e) => { e.preventDefault(); onNavClick?.(item.key); }}
              className={
                item.active
                  ? 'text-xs uppercase tracking-wider text-[var(--aura-chrome-bright)] border-b-2 border-[var(--aura-chrome-bright)] pb-1'
                  : 'text-xs uppercase tracking-wider text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors duration-300'
              }
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onNavClick?.('order')}
          className="bg-[var(--aura-surface-dim)] text-[var(--aura-noir-deep)] px-6 py-2 font-bold text-xs uppercase tracking-widest hover:bg-[var(--aura-chrome-bright)] transition-all"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
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
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[var(--aura-surface-container)]/80 z-10" />
        <div
          className="w-full h-full"
          style={{ backgroundImage: `url('${bgImageUrl}')` }}
          role="img"
          aria-label={t('storyNew.heroImageAlt', {
            defaultValue:
              'A cinematic, high-resolution shot of a modern architectural cafe built from matte black industrial containers at night. Soft bronze lighting spills from floor-to-ceiling glass windows, illuminating a sleek chrome espresso machine. The atmosphere is nocturnal and sophisticated, with deep navy and charcoal tones dominating the palette, reflecting a high-end industrial luxury aesthetic.',
          })}
        />
      </div>

      {/* Content */}
      <div className="relative z-20 text-center px-6">
        <span className="block text-[var(--aura-chrome-soft)] tracking-[0.4em] uppercase mb-6 text-xs animate-pulse" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('storyNew.established', { defaultValue: 'Established 2024' })}
        </span>
        <h1
          className="text-6xl md:text-8xl lg:text-9xl text-white font-medium mb-8 leading-tight max-w-5xl mx-auto"
          style={{ fontFamily: "var(--aura-font-display, 'EB Garamond', serif)" }}
        >
          {t('storyNew.heroTitle', { defaultValue: 'The Art of the' })}{' '}
          <span className="italic text-[var(--aura-chrome-bright)]">
            {t('storyNew.heroTitleItalic', { defaultValue: 'Nocturnal Pour' })}
          </span>
        </h1>
        <div className="w-24 h-px bg-[var(--aura-chrome-soft)] mx-auto opacity-50" />
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
        <span className="text-xs uppercase tracking-widest text-[var(--aura-chrome-soft)] opacity-60" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('storyNew.scrollToExplore', { defaultValue: 'Scroll to Explore' })}
        </span>
        <div className="w-px h-16 bg-gradient-to-b from-[var(--aura-chrome-soft)] to-transparent" />
      </div>
    </section>
  );
}

/* ─── Story Section: Bento Glass Grid ────────────────────────────────── */

function StorySection() {
  const { t } = useTranslation();

  return (
    <section className="py-32 px-[64px] max-w-[1280px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-[24px]">
        <div className="md:col-span-12 mb-16">
          <h2
            className="text-[var(--aura-noir-void)] mb-4"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '45px' }}
          >
            {t('storyNew.storyTitle', { defaultValue: 'The Blueprint' })}
          </h2>
          <p className="text-[var(--aura-chrome-soft)] max-w-2xl font-light leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t('storyNew.storyLead', {
              defaultValue:
                "Aura Cafe is more than a destination; it's a structural dialogue between raw industrial resilience and the ephemeral beauty of the perfect roast.",
            })}
          </p>
        </div>

        {/* Architectural Salvage — featured card */}
        <div
          className="md:col-span-7 p-12 flex flex-col justify-between group"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)',
            borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 60%)',
          }}
          data-reveal
        >
          <div>
            <div className="flex items-center gap-4 mb-8">
              <Building2 size={36} className="text-[var(--aura-chrome-bright)]" aria-hidden="true" />
              <span className="text-[var(--aura-chrome-soft)] font-bold tracking-tighter" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                REF: 001
              </span>
            </div>
            <h3
              className="text-white mb-6"
              style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '24px' }}
            >
              {t('storyNew.refArchitecture', { defaultValue: 'Architectural Salvage' })}
            </h3>
            <p className="text-[var(--aura-chrome-soft)] leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {t('storyNew.descArchitecture', {
                defaultValue:
                  'Our foundation is built from decommissioned cargo containers, re-engineered as minimalist glass-walled sanctuaries. We embrace the industrial scars of the steel, celebrating its history while housing the future of hospitality.',
              })}
            </p>
          </div>
          <div className="mt-12 h-64 overflow-hidden rounded-[4px] border border-white/5">
            <img
              className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
              src={defaultArchImageUrl}
              alt={t('storyNew.imgArchitectureAlt', {
                defaultValue:
                  'Close up architectural detail of a weathered industrial container corner meeting a sharp, clean chrome glass frame. The lighting is moody and focused, highlighting the contrast between the rough matte texture of the navy steel and the reflective brilliance of the metallic accents. High-end nocturnal luxury cafe environment.',
              })}
              loading="lazy"
            />
          </div>
        </div>

        {/* Right column stack */}
        <div className="flex flex-col gap-[24px] md:col-span-5">
          {/* Precision Brewing */}
          <div
            className="p-10 flex flex-col h-full group"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)',
              borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 60%)',
            }}
            data-reveal
          >
            <Settings2 size={30} className="text-[var(--aura-chrome-bright)] mb-6" aria-hidden="true" />
            <h3
              className="text-white mb-4"
              style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '20px' }}
            >
              {t('storyNew.refBrewing', { defaultValue: 'Precision Brewing' })}
            </h3>
            <p className="text-[var(--aura-chrome-soft)] text-sm leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {t('storyNew.descBrewing', {
                defaultValue:
                  'We view extraction as an engineering challenge. Utilizing custom-modded pressure profiles and laboratory-grade filtration, every pour is a repeatable masterpiece of flavor chemistry.',
              })}
            </p>
          </div>

          {/* Nocturnal Sanctuary */}
          <div
            className="p-10 flex flex-col h-full group"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)',
              borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 60%)',
            }}
            data-reveal
          >
            <Moon size={30} className="text-[var(--aura-chrome-bright)] mb-6" aria-hidden="true" />
            <h3
              className="text-white mb-4"
              style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '20px' }}
            >
              {t('storyNew.refSanctuary', { defaultValue: 'Nocturnal Sanctuary' })}
            </h3>
            <p className="text-[var(--aura-chrome-soft)] text-sm leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {t('storyNew.descSanctuary', {
                defaultValue:
                  'Designed for the night owls, the thinkers, and the quiet creators. Our lighting is calibrated to the golden hour, creating a focus-enhancing void in the heart of the city.',
              })}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Timeline Section: Vertical Machine Flow ─────────────────────────- */

const timelinePhases = [
  {
    phase: 'PHASE 01',
    year: '2022',
    title: 'storyNew.phase01Title',
    description: 'storyNew.phase01Desc',
    imageUrl: defaultTimelineImages[0],
    imageAlt:
      'Technical architectural drawings and blue-prints of a shipping container cafe layout spread across a dark metal desk. Fine-lined chrome pens and a matte black coffee cup sit on the plans. Dramatic low-key lighting with a subtle blue tint, reflecting an industrial design office.',
  },
  {
    phase: 'PHASE 02',
    year: '2023',
    title: 'storyNew.phase02Title',
    description: 'storyNew.phase02Desc',
    imageUrl: defaultTimelineImages[1],
    imageAlt:
      'Macro photo of a welding spark flying from a steel container frame. Dark industrial workshop setting with deep shadows and brilliant, sharp points of light. The metal is being joined to form the structure of a modern cafe. Cool blue and warm orange color palette.',
  },
  {
    phase: 'PHASE 03',
    year: '2024',
    title: 'storyNew.phase03Title',
    description: 'storyNew.phase03Desc',
    imageUrl: defaultTimelineImages[2],
    imageAlt:
      'The finished Aura Cafe at night, a glowing glass and steel structure standing boldly against a dark urban background. The interior light is a warm bronze, casting a long inviting glow on the sidewalk. Reflections of city lights shimmer on the polished chrome surfaces.',
    isActive: true,
  },
];

function TimelineSection() {
  const { t } = useTranslation();

  const phaseTitleDefaults: Record<string, string> = {
    'storyNew.phase01Title': 'The Concept Blueprint',
    'storyNew.phase02Title': 'Structural Assembly',
    'storyNew.phase03Title': 'Activation',
  };

  const phaseDescDefaults: Record<string, string> = {
    'storyNew.phase01Desc':
      'Initial visioning of a cafe that exists at the intersection of container architecture and technical brewing precision.',
    'storyNew.phase02Desc':
      'Salvaging three high-cube containers and re-engineering them with reinforced frames and panoramic glass panels.',
    'storyNew.phase03Desc':
      'Aura Cafe opens its doors, establishing a new standard for the nocturnal coffee experience in the city center.',
  };

  return (
    <section className="py-32 bg-[var(--aura-surface-dim)] relative">
      <div className="max-w-[1280px] mx-auto px-[64px]">
        <div className="text-center mb-24">
          <h2
            className="text-[var(--aura-noir-void)] mb-4"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '45px' }}
          >
            {t('storyNew.timelineTitle', { defaultValue: 'Evolutionary Cycle' })}
          </h2>
          <p className="text-[var(--aura-chrome-soft)] text-xs tracking-[0.3em] uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t('storyNew.timelineSubtitle', { defaultValue: 'From Prototype to Perfection' })}
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Vertical Line */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px"
            style={{
              background:
                'linear-gradient(to bottom, transparent, var(--aura-chrome-soft) 15%, var(--aura-chrome-soft) 85%, transparent)',
            }}
          />

          {timelinePhases.map((phase, idx) => {
            const isLeft = idx % 2 === 0;
            return (
              <div
                key={phase.phase}
                className={`relative grid grid-cols-1 md:grid-cols-2 gap-16 mb-32 items-center ${idx === timelinePhases.length - 1 ? 'mb-0' : ''}`}
                data-reveal
              >
                {/* Text side */}
                <div className={isLeft ? 'md:text-right' : 'order-2 md:order-1 md:text-left'}>
                  <span
                    className="text-[var(--aura-chrome-bright)] font-bold text-xs tracking-widest block mb-2"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {`${phase.phase}: ${phase.year}`}
                  </span>
                  <h4 className="text-white text-2xl font-semibold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t(phase.title, { defaultValue: phaseTitleDefaults[phase.title] })}
                  </h4>
                  <p className="text-[var(--aura-chrome-soft)] text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t(phase.description, { defaultValue: phaseDescDefaults[phase.description] })}
                  </p>
                </div>

                {/* Image side with dot */}
                <div
                  className={`flex items-center relative ${isLeft ? 'md:order-2 justify-start md:justify-center' : 'order-1 justify-start md:justify-center'}`}
                >
                  {/* Timeline dot */}
                  <div
                    className={`w-4 h-4 absolute z-10 rounded-full border-4 border-[var(--aura-surface-container)] ${isLeft ? '-left-[8.5px] md:left-auto md:right-auto' : '-left-[8.5px] md:left-auto md:right-auto'}`}
                    style={{
                      backgroundColor: phase.isActive ? 'var(--aura-chrome-bright)' : 'var(--aura-surface-dim)',
                      boxShadow: phase.isActive ? '0 0 15px color-mix(in srgb, var(--aura-chrome-bright), transparent 50%)' : 'none',
                    }}
                    aria-hidden="true"
                  />
                  <div
                    className="p-6 w-full ml-8 md:ml-0"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(20px)',
                      border: phase.isActive
                        ? '1px solid color-mix(in srgb, var(--aura-chrome-bright), transparent 70%)'
                        : '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)',
                    }}
                  >
                    <img
                      className={`w-full h-32 object-cover ${!phase.isActive ? 'opacity-50 grayscale' : ''}`}
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

/* ─── Values Section ──────────────────────────────────────────────────── */

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

  const valueDefaults: Record<string, string> = {
    'storyNew.value1Title': 'Purity',
    'storyNew.value2Title': 'Integrity',
    'storyNew.value3Title': 'Sustainability',
    'storyNew.value1Desc':
      'Zero compromise on origin. We source only single-estate beans that meet our rigorous chemical profile standards.',
    'storyNew.value2Desc':
      'Transparency in every gear. Our brewing process is fully visible, inviting curiosity and conversation.',
    'storyNew.value3Desc':
      'Engineered for longevity. From container re-use to zero-waste filtration, we respect the machine that is our planet.',
  };

  return (
    <section className="py-32 px-[64px] max-w-[1280px] mx-auto overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
        {valueCards.map((value, idx) => {
          const Icon = value.icon;
          return (
            <div
              key={value.title}
              className={`p-12 flex flex-col items-center text-center group ${idx === 1 ? 'relative overflow-hidden' : ''}`}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)',
              }}
              data-reveal
            >
              {/* Hover overlay for second card */}
              {idx === 1 && (
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--aura-chrome-bright), transparent 95%)' }}
                />
              )}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-8 group-hover:border-[var(--aura-chrome-bright)] transition-colors duration-500"
                style={{ border: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 70%)' }}
              >
                <Icon
                  size={30}
                  className="transition-colors duration-500 group-hover:text-[var(--aura-chrome-bright)]"
                  style={{ color: 'var(--aura-chrome-soft)' }}
                  aria-hidden="true"
                />
              </div>
              <h3
                className="text-white mb-4 uppercase tracking-widest"
                style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '20px', fontWeight: 600 }}
              >
                {t(value.title, { defaultValue: valueDefaults[value.title] })}
              </h3>
              <p className="text-[var(--aura-chrome-soft)] text-sm font-light" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {t(value.description, { defaultValue: valueDefaults[value.description] })}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Team Section ───────────────────────────────────────────────────── */

function TeamSection({ members }: { members: TeamMember[] }) {
  const { t } = useTranslation();

  const teamTitleText = t('storyNew.teamTitle', {
    defaultValue: 'The Minds Behind\nthe Machine',
  });

  const roleDefaults: Record<string, string> = {
    'storyNew.teamRole1': 'Principal Architect',
    'storyNew.teamRole2': 'Extraction Engineer',
    'storyNew.teamRole3': 'Head of Roast',
    'storyNew.teamRole4': 'Operations Lead',
  };

  return (
    <section className="py-32 px-[64px] bg-[var(--aura-surface-dim)]">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
          <div>
            <h2
              className="text-[var(--aura-noir-void)] mb-4"
              style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '45px' }}
            >
              {teamTitleText.split('\n').map((line, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </h2>
            <p className="text-[var(--aura-chrome-soft)] max-w-md" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {t('storyNew.teamDesc', {
                defaultValue:
                  'Our team consists of industrial designers, chemical engineers, and master roasters united by a singular focus.',
              })}
            </p>
          </div>
          <div className="h-px w-full md:w-64 bg-[color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)] hidden md:block" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-[24px]">
          {members.map((member) => (
            <div key={member.name} className="group" role="article" data-reveal>
              <div
                className="relative mb-6 aspect-[4/5] overflow-hidden"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)',
                }}
              >
                <img
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                  src={member.imageUrl}
                  alt={member.imageAlt}
                  loading="lazy"
                />
              </div>
              <h4 className="text-white text-lg font-bold tracking-tight mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {member.name}
              </h4>
              <p
                className="text-[var(--aura-chrome-bright)] text-xs uppercase tracking-widest font-bold"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t(member.role, { defaultValue: roleDefaults[member.role] })}
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
    <section className="py-40 px-[64px] text-center bg-[var(--aura-surface-container)]">
      <div
        className="max-w-4xl mx-auto p-24 relative overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)',
        }}
      >
        {/* Glow orbs */}
        <div
          className="absolute -top-24 -left-24 w-64 h-64 rounded-full"
          style={{ backgroundColor: 'color-mix(in srgb, var(--aura-chrome-bright), transparent 90%)', filter: 'blur(100px)' }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full"
          style={{ backgroundColor: 'color-mix(in srgb, var(--aura-noir-void), transparent 90%)', filter: 'blur(100px)' }}
        />

        <h2
          className="text-5xl md:text-7xl text-white mb-8"
          style={{ fontFamily: "var(--aura-font-display, 'EB Garamond', serif)" }}
        >
          {t('storyNew.ctaTitle', { defaultValue: 'Join the Pulse.' })}
        </h2>
        <p className="text-[var(--aura-chrome-soft)] mb-12 max-w-xl mx-auto font-light leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('storyNew.ctaDesc', {
            defaultValue:
              "Experience the convergence of architectural design and the world's most precise caffeine delivery system.",
          })}
        </p>
        <button
          type="button"
          onClick={onCtaClick}
          className="bg-[var(--aura-surface-dim)] hover:bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] px-12 py-4 font-bold text-xs uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-3 mx-auto"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--aura-surface-dim), transparent 90%), 0 4px 6px -4px color-mix(in srgb, var(--aura-surface-dim), transparent 90%)',
          }}
        >
          {t('storyNew.ctaButton', { defaultValue: 'Experience the Precision' })}
          <ArrowRight size={24} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────── */

function FooterSection() {
  const { t } = useTranslation();

  const footerLinkGroups = [
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
    { icon: Megaphone, label: t('storyNew.footerSocialMegaphone', { defaultValue: 'Brand Awareness' }), key: 'brand' },
    { icon: Map, label: t('storyNew.footerSocialLocation', { defaultValue: 'Location' }), key: 'location' },
    { icon: Mail, label: t('storyNew.footerSocialEmail', { defaultValue: 'Email' }), key: 'email' },
  ];

  return (
    <footer
      className="border-t border-[color-mix(in_srgb,var(--aura-chrome-dim)_20%,transparent)] py-20 px-[64px]"
      style={{ backgroundColor: 'var(--aura-surface-dim)' }}
      aria-label="Site footer"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-[24px] max-w-[1280px] mx-auto">
        {/* Brand column */}
        <div className="md:col-span-2">
          <div
            className="text-[var(--aura-noir-void)] uppercase mb-6"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '24px' }}
          >
            AURA CAFE
          </div>
          <p className="text-[var(--aura-chrome-soft)] max-w-sm text-xs leading-relaxed mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t('storyNew.footerTagline', {
              defaultValue:
                'ENGINEERED ELEGANCE. NOCTURNAL SANCTUARY. RE-DEFINING THE ARCHITECTURE OF HOSPITALITY THROUGH PRECISION AND SALVAGE.',
            })}
          </p>
          <div className="flex gap-6">
            {socialIcons.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.key}
                  href="#"
                  className="text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors"
                  aria-label={item.label}
                >
                  <Icon size={20} aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </div>

        {/* Link columns */}
        {footerLinkGroups.map((group) => (
          <div key={group.heading} className="flex flex-col gap-4">
            <h5 className="text-white font-bold uppercase tracking-widest text-xs mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {group.heading}
            </h5>
            {group.links.map((link) => (
              <a
                key={link.key}
                href="#"
                className="text-xs text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-transform active:translate-x-1"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {link.label}
              </a>
            ))}
          </div>
        ))}
      </div>

      <div className="max-w-[1280px] mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs text-[var(--aura-chrome-soft)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('storyNew.footerCopyright', { defaultValue: '© 2024 AURA CAFE. ENGINEERED ELEGANCE.' })}
        </p>
        <p className="text-[10px] tracking-widest text-[var(--aura-chrome-soft)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('storyNew.footerVersion', { defaultValue: 'VERSION 2.0.4 // SYSTEM: ACTIVE' })}
        </p>
      </div>
    </footer>
  );
}

/* ─── Scroll Reveal Effect ───────────────────────────────────────────── */

function useScrollReveal() {
  useEffect(() => {
    const observerOptions: IntersectionObserverInit = { threshold: 0.1 };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-10');
        }
      });
    }, observerOptions);

    const els = document.querySelectorAll('[data-reveal]');
    els.forEach((el) => {
      (el as HTMLElement).classList.add('transition-all', 'duration-1000', 'opacity-0', 'translate-y-10');
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
    <>
      <Helmet>
        <title>Không Gian Container — AURA CAFE Sa Đéc | AURA CAFE</title>
      </Helmet>
      <div
        className="min-h-screen overflow-x-hidden selection:bg-[var(--aura-chrome-bright)] selection:text-black dark"
      style={{
        backgroundColor: 'var(--aura-surface-container)',
        color: 'var(--aura-text-primary)',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* TopNavBar */}
      <NavBar onNavClick={onNavClick} />

      <main>
        {/* Hero Section */}
        <HeroSection bgImageUrl={heroBgUrl} />

        {/* Story Section: Bento Glass Grid */}
        <StorySection />

        {/* Timeline Section: Vertical Machine Flow */}
        <TimelineSection />

        {/* Values Section */}
        <ValuesSection />

        {/* Team Section */}
        <TeamSection members={teamMembers} />

        {/* CTA Section */}
        <CtaSection onCtaClick={onCtaClick} />
      </main>

      {/* Footer */}
      <FooterSection />
    </div>
    </>
  );
}

export default StitchStoryNew;
