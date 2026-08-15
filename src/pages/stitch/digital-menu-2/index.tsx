import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { FILTERS, MENU_ITEMS } from './digital-menu-2-constants';
import { Nav } from './digital-menu-2-nav';
import { MenuCard } from './digital-menu-2-menu-card';
import { CraftSection } from './digital-menu-2-craft-section';
import { Footer } from './digital-menu-2-footer';

export type { MenuItem, FilterBtn } from './digital-menu-2-types';
export { FILTERS, MENU_ITEMS, NAV_LINKS } from './digital-menu-2-constants';

/* ── Styles (CSS-variable-driven, matching StitchBase palette) ─────────── */

const S = {
  glassPanel:
    'bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px]',
};

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function DigitalMenu2() {
  const [activeFilter, setActiveFilter] = useState(0);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null
  );

  const handleMouseMove = (
    e: React.MouseEvent<HTMLElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    if (px > 0 && px < 1 && py > 0 && py < 1) {
      setMousePos({ x: px, y: py });
    }
  };

  const handleMouseLeave = () => setMousePos(null);

  const panelShadow = mousePos
    ? `inset ${((mousePos.x - 0.5) * 10).toFixed(2)}px ${((mousePos.y - 0.5) * 10).toFixed(2)}px 30px rgba(205,127,50,0.05)`
    : 'none';

  return (
    <StitchShell>
      <Nav />

      <main className="pt-32 pb-24 px-4 md:px-16 max-w-7xl mx-auto min-h-screen">
        {/* Hero / Filters */}
        <section id="menu">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
            <div>
              <span className="font-body text-xs text-[var(--aura-tertiary)] uppercase tracking-[0.4em] block mb-4">
                Atmospheric Brewing
              </span>
              <h1 className="font-display text-4xl md:text-6xl leading-tight">
                The Digital Reserve
              </h1>
            </div>

            {/* Filter pills — 4-column on md, wrapping */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {FILTERS.map((f, i) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setActiveFilter(i)}
                  className={`px-5 py-2.5 font-body text-xs uppercase tracking-widest transition-all rounded-sm ${
                    i === activeFilter
                      ? 'bg-[rgba(205,127,50,0.2)] border border-[var(--aura-tertiary)]/60 text-[var(--aura-tertiary)]'
                      : 'border border-white/10 text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] hover:border-white/20'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="w-full h-px mb-16"
            style={{ background: 'rgba(229,228,226,0.2)' }}
          />
        </section>

        {/* Menu Grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {MENU_ITEMS.map((item) => (
            <MenuCard key={item.title} item={item} />
          ))}
        </div>

        {/* Craft Section */}
        <CraftSection />
      </main>

      <Footer />
    </StitchShell>
  );
}
