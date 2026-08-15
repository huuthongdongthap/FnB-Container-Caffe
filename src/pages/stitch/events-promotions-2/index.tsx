import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageFooter } from '@/components/stitch/StitchLayout';
import { EventCard } from './events-promotions-2-card';
import { ArchiveItem } from './events-promotions-2-archive';
import { MONTHS, EVENTS, ARCHIVES } from './events-promotions-2-constants';

/* ── Re-exports for backward compatibility ─────────────────────────────── */
export type { EventItem, ArchiveItem } from './events-promotions-2-types';
export { EventCard } from './events-promotions-2-card';
export { ArchiveItem } from './events-promotions-2-archive';
export { MONTHS, EVENTS, ARCHIVES } from './events-promotions-2-constants';

/* ── Main Component ──────────────────────────────────────────────────── */

export default function EventsPromotions2() {
  const [activeMonth, setActiveMonth] = useState(0);

  return (
    <StitchShell>
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-5 md:px-16 py-4 bg-white/5 backdrop-blur-xl border-b border-[var(--aura-border-chrome)]/30">
        <span className="font-display text-lg md:text-xl text-[var(--aura-chrome-bright)] tracking-widest uppercase">
          AURA CAFE
        </span>
        <div className="hidden md:flex items-center gap-10">
          <a href="#" className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors">
            Menu
          </a>
          <a href="#" className="font-body text-base text-[var(--aura-tertiary)] border-b border-[var(--aura-tertiary)] pb-1">
            Events
          </a>
          <a href="#" className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors">
            Reservations
          </a>
          <a href="#" className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors">
            Location
          </a>
        </div>
        <button className="bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-6 py-2 font-body text-xs font-semibold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
          Book Table
        </button>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative min-h-[870px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div
            className="w-full h-full bg-cover bg-center transition-transform duration-[10s] scale-110 hover:scale-100"
            style={{
              backgroundImage:
                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDlmjmyOnjgZOt4V18ClaqGfhQ_r0HMirAh8VM5O_hIQ1sTpZ6oosG3oDxnhFsFugi2q5EerPpl5lfFhl1NSUJJTiW1Q-XbjjbyMy0AUccp-uZBZO0pRf9purCQ7jAci8IPzR-Wkh2N9pmD-AGIgTt2T3O3d5qel--M4Myq4EIDioeuEHRxz6mOhiyiJzIppQlKa7MoXQzCTZVkZznyFTcalEDKgDLqr0rZnZzzDfu8t1vXTQVpYBenN1RVPicJCT3rFq9QShz7W_U')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-void)] via-[var(--aura-noir-void)]/40 to-transparent" />
        </div>
        <div className="relative z-10 w-full max-w-[1280px] px-5 md:px-16">
          <div className="md:w-7/12 glass-panel p-12 rounded-[32px] border-l-2 border-[var(--aura-tertiary)]/50">
            <span className="font-body text-xs uppercase tracking-[0.3em] text-[var(--aura-tertiary)] mb-3 block">
              Featured Event
            </span>
            <h1 className="font-display text-5xl md:text-7xl leading-tight text-white italic mb-6">
              Midnight Saxophone Sessions
            </h1>
            <p className="font-body text-lg text-[var(--aura-chrome-mid)] mb-8 max-w-xl">
              Experience an evocative evening of smooth jazz and experimental rhythms. Featuring
              world-renowned soloists in our intimate industrial-chic gallery space. Limited
              reservations available for the velvet lounge.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-8 py-4 rounded-lg font-body text-xs font-semibold uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
                Reserve a Spot <span className="text-base">📅</span>
              </button>
              <button className="btn-chrome px-8 py-4 rounded-lg font-body text-xs uppercase tracking-widest">
                View Details
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Filter Tabs ─────────────────────────────────────────────── */}
      <section className="py-12 bg-[var(--aura-noir-deep)]">
        <div className="max-w-[1280px] mx-auto px-5 md:px-16">
          <div className="flex items-center justify-between border-b border-[var(--aura-chrome-dark)]/20 pb-4 overflow-x-auto">
            <div className="flex space-x-8 min-w-max">
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  onClick={() => setActiveMonth(i)}
                  className={`font-body text-xs uppercase tracking-widest relative pb-4 transition-all ${
                    i === activeMonth
                      ? 'text-[var(--aura-tertiary)]'
                      : 'text-[var(--aura-chrome-mid)] hover:text-white'
                  }`}
                >
                  {m}
                  {i === activeMonth && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--aura-tertiary)]" />
                  )}
                </button>
              ))}
            </div>
            <div className="hidden md:flex items-center gap-2 font-body text-[10px] uppercase tracking-widest text-[var(--aura-chrome-mid)]">
              <span className="text-base">⚙️</span>
              Filter by Type
            </div>
          </div>
        </div>
      </section>

      {/* ── Events Grid ─────────────────────────────────────────────── */}
      <section className="py-12">
        <div className="max-w-[1280px] mx-auto px-5 md:px-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EVENTS.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Past Archives ───────────────────────────────────────────── */}
      <section className="py-20 border-t border-[var(--aura-chrome-dark)]/10">
        <div className="max-w-[1280px] mx-auto px-5 md:px-16">
          <div className="flex items-center gap-6 mb-8">
            <h2 className="font-display text-2xl text-[var(--aura-chrome-dark)]">Past Archives</h2>
            <div className="h-px bg-[var(--aura-chrome-dark)]/30 flex-grow" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
            {ARCHIVES.map((item) => (
              <ArchiveItem key={item.title} item={item} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <button className="font-body text-xs uppercase tracking-widest text-[var(--aura-tertiary)] hover:underline transition-all">
              View Full Archive
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <PageFooter
        brand="AURA CAFE"
        socialLinks={['IG', 'FB', 'TT'].map((s) => ({ label: s }))}
        socialSize="sm"
        copyLine="© 2024 AURA CAFE. ALL RIGHTS RESERVED."
      />
    </StitchShell>
  );
}
