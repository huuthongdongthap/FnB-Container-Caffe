/**
 * StitchStoryNew-story — Bento glass grid story section.
 *
 * Three-card layout: featured Architectural Salvage card (7-col) with
 * image, and two stacked cards (Precision Brewing, Nocturnal Sanctuary)
 * in a 5-col column. Glassmorphism styling with hover grayscale reveal.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { Building2, Settings2, Moon } from 'lucide-react';
import { defaultArchImageUrl } from './stitch-story-default';

/* ─── Glass Card Style ──────────────────────────────────────────────── */

const glassStyle = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(20px)',
  border: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)',
  borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 60%)',
} as const;

/* ─── Story Section: Bento Glass Grid ──────────────────────────────── */

export function StorySection() {
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
        <div className="md:col-span-7 p-12 flex flex-col justify-between group" style={glassStyle} data-reveal>
          <div>
            <div className="flex items-center gap-4 mb-8">
              <Building2 size={36} className="text-[var(--aura-chrome-bright)]" aria-hidden="true" />
              <span className="text-[var(--aura-chrome-soft)] font-bold tracking-tighter" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                REF: 001
              </span>
            </div>
            <h3 className="text-white mb-6" style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '24px' }}>
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
          <div className="p-10 flex flex-col h-full group" style={glassStyle} data-reveal>
            <Settings2 size={30} className="text-[var(--aura-chrome-bright)] mb-6" aria-hidden="true" />
            <h3 className="text-white mb-4" style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '20px' }}>
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
          <div className="p-10 flex flex-col h-full group" style={glassStyle} data-reveal>
            <Moon size={30} className="text-[var(--aura-chrome-bright)] mb-6" aria-hidden="true" />
            <h3 className="text-white mb-4" style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '20px' }}>
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
