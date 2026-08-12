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
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCwdsFH89n5qOne2pC5RLJOugzRVNz_2K7TiYtIwSBFa_o2fTRtUdH0v3HZuxfIH4qSRynBF5k98BQek1PnbvU5bfnCA3RNz8TP9OgytrC9t9rR0N2uOFIa_yVN95yxowo_xspC10KiuymqoVK1VsU6RE4awCLAlWQqf5lN4etscE_1bWpMy6pKhg6wyxQe9u07flyVAWUvGx_LMd3ndty3GfG1XJZsqAJMrUFEq3erkUiT9v7YN9s_jMhKA_iuVfhd1739-cl_LHY',
    imageAlt: 'A high-end, cinematic close-up of a Midnight Espresso in a minimalist glass cup, set against a dark industrial cafe background with subtle blue neon accents. The lighting is moody and dramatic, highlighting the rich crema and floating coffee beans. The overall aesthetic is luxurious and modern, fitting an urban professional lounge.',
    badge: 'Signature',
    name: 'Midnight Espresso',
    desc: 'Double shot of reserve beans, notes of dark cocoa and star anise.',
    price: '$6.50',
  },
  {
    id: 2,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDW4_mtBXw9yFcpHcU0qYN7ITB4vUmRIfuNsNaGMxab_GB2MLIMgw2NCiGyE2yio81jNy2hRNByMHlI-AqOdCPR1A93RA4EM5uZp_BYVw8SChv6NpvdTOG4xEYQwpwPGxNrDk8aY8wSIelzJLltcTSyCH7_XQwtud2XV03XmfWQwilm5jPN2_98oEb56nAhoxMfbz3c39hZxhqbpaRG3cueTQKmZFVDBQkunCL6AL68YpaoQb-IfivMl_NJrQZJvMSAZ7dhuhsUS0o',
    imageAlt: 'A premium aesthetic photo of a Chrome Velvet Latte featuring intricate latte art in a textured ceramic mug. The setting is a dimly lit, high-end cafe with metallic silver and navy blue accents. Soft, atmospheric lighting catches the steam and the smooth texture of the micro-foam. The mood is serene, exclusive, and sophisticated.',
    badge: undefined,
    name: 'Chrome Velvet Latte',
    desc: 'Silky texture with a hint of vanilla and silver-dusted topping.',
    price: '$7.25',
  },
  {
    id: 3,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDCjEHWXhk-wZ78ADsOLT2qxDEb7cEFtonZe8IBVBaA8dSYj2XfRa55YmkQC_91xBwEn8TxfQ14l-u0PtB80LNcraAoxMjH-EmQfMrHe6z_uUXLH7Tu7LOF7Nj3vcNUzWNoz51aXJbwa2ZyvRDwRsyuh81QWET7tvv5nc-RHd9UsOgCCblDMLh5ASp0ZnPlhoQgPRDqvSiQje115mX2lH7LrjRkw-IRjybvD8aBzfdsv_s0ignn1QZ7rZYQoQH0PsxUuaex9BIAsmc',
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
