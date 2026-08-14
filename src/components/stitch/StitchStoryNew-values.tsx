/**
 * StitchStoryNew-values — Values section.
 *
 * Three-card grid showcasing Purity, Integrity, and Sustainability.
 * Each card has an icon, title, and description with glassmorphism styling
 * and hover effects.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { Verified, Settings, Leaf } from 'lucide-react';
import { valueCards } from './stitch-story-default';

/* ─── Icon lookup by key ────────────────────────────────────────────── */

const iconMap = { Verified, Settings, Leaf } as const;

/* ─── Value Defaults ────────────────────────────────────────────────── */

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

/* ─── Values Section ────────────────────────────────────────────────── */

export function ValuesSection() {
  const { t } = useTranslation();

  return (
    <section className="py-32 px-[64px] max-w-[1280px] mx-auto overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
        {valueCards.map((value, idx) => {
          const Icon = iconMap[value.iconKey];
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
