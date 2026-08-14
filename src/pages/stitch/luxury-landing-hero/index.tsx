/* ── Stitch: aura_cafe_luxury_landing_hero ─────────────────────────── */
/* Source: stitch_aura_cafe/aura_cafe_luxury_landing_hero/code.html */
/* Hero landing with animated glass panels, feature bento grid, teaser */

import { StitchShell, StitchNav } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

const FEATURES = [
  { icon: '🏭', label: 'Architectural Concept', title: 'Industrial Roots', desc: 'Housed in repurposed steel vessels, our space celebrates raw materials—polished concrete, exposed beams, and matte metal finishes.', featured: false },
  { icon: '☕', label: 'The Craft', title: 'Artisan Roasts', desc: 'Small-batch beans sourced from volcanic highlands, roasted specifically to enhance the depth of night-time caffeine rituals.', featured: true },
  { icon: '🌙', label: 'Experience', title: 'Lounge Atmosphere', desc: 'Transitioning as the sun sets, our lighting shifts to a warm bronze glow, complemented by a curated lo-fi industrial soundscape.', featured: false },
] as const;

export default function LuxuryLandingHero() {
  return (
    <StitchShell>
      {/* ── Nav ── */}
      <StitchNav ctaLabel="Book Now" />

      {/* ── Hero ── */}
      <main className="relative min-h-screen flex items-center justify-center pt-24 pb-8 px-5 md:px-16 overflow-hidden">
        <div className="relative z-10 w-full max-w-[1200px] mx-auto text-center">
          <div className="inline-block mb-4">
            <span className="font-body text-xs font-semibold text-[var(--aura-chrome-mid)]/60 tracking-[0.3em] uppercase">
              Est. 2024 • Industrial Luxury
            </span>
            <div className="h-px bg-gradient-to-r from-transparent via-[var(--aura-chrome-mid)]/20 to-transparent mt-1" />
          </div>

          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl text-[var(--aura-chrome-bright)] mb-4 leading-tight">
            The Art of the <span className="text-[var(--aura-chrome-mid)]">Nocturnal</span> Pour
          </h1>

          <div className="border border-white/10 p-6 md:p-8 max-w-2xl mx-auto mb-8">
            <p className="font-body text-base md:text-lg text-[var(--aura-chrome-mid)] leading-relaxed">
              A redefined coffee experience set within architecturally salvaged shipping containers.
              AURA CAFE merges raw industrial textures with the warmth of boutique artisan roasts
              and the ambient glow of a premium night lounge.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <button className="w-full md:w-auto bg-[var(--aura-chrome-mid)] text-[var(--aura-noir-deep)] font-body text-xs font-bold px-10 py-3 rounded-lg uppercase tracking-widest hover:opacity-90 transition-all">
              Book Your Table
            </button>
            <button className="w-full md:w-auto border border-[var(--aura-chrome-mid)]/30 text-[var(--aura-chrome-mid)] font-body text-xs px-10 py-3 rounded-lg uppercase tracking-widest hover:bg-white/5 transition-all">
              Explore Menu
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[var(--aura-chrome-mid)]/20 to-transparent" />
      </main>

      {/* ── Feature Bento Grid ── */}
      <section className="py-24 px-5 md:px-16 bg-[var(--aura-noir-void)]/50">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {FEATURES.map((f, i) => (
            <div key={i} className="border border-white/5 p-6 flex flex-col items-start gap-3 hover:-translate-y-2 transition-transform duration-500">
              {f.featured && (
                <span className="absolute top-2 right-2 font-body text-[10px] px-2 py-1 bg-[var(--aura-chrome-mid)]/10 text-[var(--aura-chrome-mid)] border border-[var(--aura-chrome-mid)]/20">
                  Signature
                </span>
              )}
              <div className="w-12 h-12 flex items-center justify-center rounded-full border border-[var(--aura-chrome-mid)]/30 text-[var(--aura-chrome-mid)]">
                <span className="text-lg">{f.icon}</span>
              </div>
              <h3 className="font-display text-xl text-[var(--aura-chrome-bright)]">{f.title}</h3>
              <p className="font-body text-sm text-[var(--aura-chrome-mid)] leading-relaxed">{f.desc}</p>
              <div className="mt-auto pt-4 w-full">
                <div className="h-px bg-gradient-to-r from-transparent via-[var(--aura-chrome-mid)]/20 to-transparent mb-2" />
                <span className="font-body text-[10px] text-[var(--aura-chrome-mid)]/40 uppercase tracking-widest">{f.label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Visual Teaser ── */}
      <section className="relative h-[614px] w-full overflow-hidden flex items-center">
        <div className="absolute inset-0 bg-[var(--aura-noir-mid)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-deep)] via-[var(--aura-noir-deep)]/40 to-transparent" />
        <div className="relative z-10 px-5 md:px-16 w-full max-w-[1200px] mx-auto">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl text-[var(--aura-chrome-bright)] mb-2">The Night is Your Canvas</h2>
            <p className="font-body text-lg text-[var(--aura-chrome-mid)] italic">Find clarity in the shadows.</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
<PageFooter
  brand="AURA CAFE"
  socialSize="sm"
  copyLine="© 2024 AURA CAFE. All rights reserved."
/>
    </StitchShell>
  );
}
