import { useState, type ReactNode } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

/* ── Types ────────────────────────────────────────────────────────────── */

interface MenuItem {
  id: number;
  image: string;
  imageAlt: string;
  badge?: string;
  name: string;
  desc: string;
  price: string;
}

interface FilterBtn {
  label: string;
  active: boolean;
}

/* ── Data ────────────────────────────────────────────────────────────── */

const FILTERS: readonly FilterBtn[] = [
  { label: 'Coffee', active: true },
  { label: 'Tea', active: false },
  { label: 'Signature', active: false },
  { label: 'Cold Brew', active: false },
] as const;

const MENU_ITEMS: readonly MenuItem[] = [
  {
    id: 1,
    image: '/photos/IMG_6581.webp',
    imageAlt: 'A high-end, cinematic close-up of a Midnight Espresso in a minimalist glass cup, set against a dark industrial cafe background with subtle blue neon accents. The lighting is moody and dramatic, highlighting the rich crema and floating coffee beans. The overall aesthetic is luxurious and modern, fitting an urban professional lounge.',
    badge: 'Signature',
    name: 'Midnight Espresso',
    desc: 'Double shot of reserve beans, notes of dark cocoa and star anise.',
    price: '$6.50',
  },
  {
    id: 2,
    image: '/photos/IMG_6554-frame.webp',
    imageAlt: 'A premium aesthetic photo of a Chrome Velvet Latte featuring intricate latte art in a textured ceramic mug. The setting is a dimly lit, high-end cafe with metallic silver and navy blue accents. Soft, atmospheric lighting catches the steam and the smooth texture of the micro-foam. The mood is serene, exclusive, and sophisticated.',
    badge: undefined,
    name: 'Chrome Velvet Latte',
    desc: 'Silky texture with a hint of vanilla and silver-dusted topping.',
    price: '$7.25',
  },
  {
    id: 3,
    image: '/photos/IMG_6555-frame.webp',
    imageAlt: 'A sophisticated presentation of a Smoky Amber Cold Brew in a tall crystal glass, featuring large clear ice spheres. The beverage is layered with rich amber tones. The background is a blurred high-end lounge with dark navy walls and polished chrome fixtures. Minimalist and luxurious vibe with focused spotlighting on the drink.',
    badge: 'Signature',
    name: 'Smoky Amber Cold Brew',
    desc: '18-hour cold steeped with smoked cedar infusion.',
    price: '$8.00',
  },
] as const;

/* ── Icon constants (emoji — no Material Symbols dependency) ─────────── */

const ICON_BACK = '←';
const ICON_SEARCH = '🔍';
const ICON_ADD = '+';

/* ═══════════════════════════════════════════════════════════════════════
MobileOrdering — table ordering screen
═══════════════════════════════════════════════════════════════════════ */

export default function MobileOrdering() {
  const [cartCount, setCartCount] = useState(0);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const handleAdd = (id: number) => {
    setCartCount((c) => c + 1);
    setAddedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 400);
  };

  return (
    <StitchShell>
      {/* ── Top Header ────────────────────────────────────── */}
<PageHeader brand="AURA CAFE" scrollEffect />

      {/* ── Main Content ─────────────────────────────────── */}
      <main className="pt-20 pb-36 px-5 flex flex-col gap-8">
        {/* Category Horizontal Scroll */}
        <section className="flex overflow-x-auto gap-3 -mx-5 px-5 no-scrollbar items-center">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              className={[
                'glass-panel px-6 py-2 rounded-full whitespace-nowrap font-label-lg text-label-lg active:scale-95 transition-all',
                f.active
                  ? 'bg-[var(--aura-tertiary)]/80 text-[var(--aura-noir-deep)]'
                  : 'text-[var(--aura-chrome-mid)]',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </section>

        {/* Menu Section */}
        <section className="flex flex-col gap-5">
          <h2 className="font-display text-headline-md text-[var(--aura-tertiary)] mb-2">
            Our Curations
          </h2>

          {MENU_ITEMS.map((item) => (
            <article
              key={item.id}
              className="glass-panel rounded-xl overflow-hidden flex flex-col active:scale-[0.98] transition-transform"
            >
              {/* Product image */}
              <div className="h-48 w-full relative">
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url('${item.image}')` }}
                  role="img"
                  aria-label={item.imageAlt}
                />
                {item.badge != null && (
                  <span className="absolute top-4 left-4 bg-[#CD7F32] text-[var(--aura-noir-deep)] px-3 py-1 rounded-sm font-label-lg text-label-lg shadow-xl">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Info + Add button */}
              <div className="p-4 flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-headline-md text-[var(--aura-chrome-bright)] leading-tight">
                    {item.name}
                  </h3>
                  <p className="font-body text-body-md text-[var(--aura-chrome-mid)] mt-1 text-sm">
                    {item.desc}
                  </p>
                  <p className="font-price-display text-price-display text-[var(--aura-tertiary)] mt-3">
                    {item.price}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdd(item.id)}
                  className={[
                    'w-12 h-12 rounded-full flex items-center justify-center font-body text-lg font-bold transition-all active:scale-90 shadow-lg',
                    addedIds.has(item.id)
                      ? 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] shadow-[var(--aura-tertiary)]/20'
                      : 'bg-[var(--aura-tertiary)]/20 text-[var(--aura-tertiary)]',
                  ].join(' ')}
                  aria-label={`Add ${item.name}`}
                >
                  {ICON_ADD}
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>

      {/* ── Floating Cart Bar ─────────────────────────────── */}
<PageFooter
  brand="AURA CAFE"
  socialSize="sm"
  />
    </StitchShell>
  );
}
