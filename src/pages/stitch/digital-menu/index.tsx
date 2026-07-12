/* ── Stitch: aura_cafe_digital_menu_1 + _2 ─────────────────────────── */
/* Source: stitch_aura_cafe/aura_cafe_digital_menu_1/code.html */

import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

interface MenuItem {
  id: number;
  name: string;
  desc: string;
  price: string;
  badge?: string;
  image: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 1, name: 'Midnight Espresso', desc: 'Triple-shot ristretto using our obsidian blend, served in a pre-chilled chrome-rimmed glass.', price: '$6.50', badge: 'FEATURED', image: 'espresso' },
  { id: 2, name: 'Chrome Velvet Latte', desc: 'Infused with active charcoal and Madagascar vanilla, finished with a precise velvet microfoam.', price: '$8.00', image: 'latte' },
  { id: 3, name: 'Industrial Cold Brew', desc: '24-hour slow drip extraction through stainless steel filtration. Intense, clean, and energizing.', price: '$7.25', badge: 'VEGETARIAN', image: 'coldbrew' },
  { id: 4, name: 'Bronze Chai', desc: 'Hand-ground spices bloomed in local honey, paired with a selection of premium black teas.', price: '$6.75', image: 'chai' },
  { id: 5, name: 'Ceremonial Matcha', desc: 'Stone-ground ceremonial grade tea from Uji, whisked to perfection with oat milk.', price: '$7.50', image: 'matcha' },
  { id: 6, name: 'Nitro Tonic', desc: 'Nitro-infused espresso charged with premium tonic and a hint of botanical citrus.', price: '$9.00', image: 'nitro' },
];

const CATEGORIES = ['All', 'Coffee', 'Tea', 'Cold Brew', 'Signature'];

const IMAGE_PALETTES: Record<string, string> = {
  espresso: 'linear-gradient(135deg, #1a0a00 0%, #0A1A2E 100%)',
  latte: 'linear-gradient(135deg, #2a1a10 0%, #0A1A2E 100%)',
  coldbrew: 'linear-gradient(135deg, #050e1a 0%, #0A1A2E 100%)',
  chai: 'linear-gradient(135deg, #1a1005 0%, #0A1A2E 100%)',
  matcha: 'linear-gradient(135deg, #0a1a0a 0%, #0A1A2E 100%)',
  nitro: 'linear-gradient(135deg, #0a0a1a 0%, #0A1A2E 100%)',
};

export default function DigitalMenu() {
  const [active, setActive] = useState(0);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const handleAdd = (id: number) => {
    setAddedIds(prev => new Set(prev).add(id));
    setTimeout(() => setAddedIds(prev => { const n = new Set(prev); n.delete(id); return n; }), 2000);
  };

  return (
    <StitchShell>
      {/* Nav */}
<PageHeader brand="AURA CAFE" scrollEffect />

      <main className="pt-24 pb-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-6">
          {/* Page Header */}
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-display text-4xl text-[var(--aura-chrome-bright)] mb-2">The Digital Reserve</h1>
              <p className="font-body text-sm text-[var(--aura-chrome-mid)] max-w-lg">
                Industrial precision meets high-end hospitality. Explore our curated selection of signature roasts and artisanal blends.
              </p>
            </div>
            {/* Search */}
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="Search our craft..."
                className="w-full bg-[var(--aura-noir-void)] border border-[var(--aura-border-chrome)]/50 rounded-full py-3 pl-12 pr-4 focus:outline-none focus:border-[var(--aura-chrome-mid)] font-body text-sm text-[var(--aura-chrome-light)] placeholder:text-[var(--aura-chrome-dark)]"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--aura-chrome-dark)]">⌕</span>
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex gap-3 overflow-x-auto pb-4 mb-10">
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat}
                onClick={() => setActive(i)}
                className={`flex-shrink-0 px-6 py-2 font-body text-xs font-semibold rounded-full border transition-all ${
                  i === 0
                    ? 'border-[var(--aura-chrome-mid)] text-[var(--aura-chrome-mid)]'
                    : 'border-[var(--aura-border-chrome)]/30 text-[var(--aura-chrome-mid)] hover:border-[var(--aura-chrome-light)] hover:text-[var(--aura-chrome-light)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Menu Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {MENU_ITEMS.map((item) => (
              <div key={item.id} className="border border-white/5 rounded-xl overflow-hidden flex flex-col h-full hover:-translate-y-1 transition-transform duration-300">
                {/* Image */}
                <div className="relative h-64 overflow-hidden">
                  <div
                    className="w-full h-full transition-transform duration-700 group-hover:scale-105"
                    style={{ background: IMAGE_PALETTES[item.image] || IMAGE_PALETTES.espresso }}
                  />
                  {item.badge && (
                    <span className="absolute top-4 left-4 bg-[var(--aura-chrome-mid)] text-[var(--aura-noir-deep)] px-3 py-1 font-body text-[10px] font-bold uppercase">
                      {item.badge}
                    </span>
                  )}
                  <span className="absolute top-4 right-4 font-body text-sm font-medium text-[var(--aura-chrome-mid)] bg-[var(--aura-noir-deep)]/80 backdrop-blur-md px-2 py-1">
                    {item.price}
                  </span>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="font-display text-xl text-[var(--aura-chrome-bright)] mb-2">{item.name}</h3>
                  <p className="font-body text-sm text-[var(--aura-chrome-mid)] mb-6 flex-grow leading-relaxed">{item.desc}</p>
                  <button
                    onClick={() => handleAdd(item.id)}
                    className={`w-full py-3 font-body text-xs font-bold uppercase rounded-sm transition-all ${
                      addedIds.has(item.id)
                        ? 'bg-[var(--aura-chrome-mid)] text-[var(--aura-noir-deep)]'
                        : 'bg-gradient-to-r from-[#C6C6C7] to-[#8E9097] text-[var(--aura-noir-deep)] hover:brightness-110'
                    }`}
                  >
                    {addedIds.has(item.id) ? '✓ Added' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Cart FAB ── */}
      <div className="fixed bottom-8 right-8 z-40">
        <button className="w-16 h-16 rounded-full bg-[var(--aura-chrome-mid)] text-[var(--aura-noir-deep)] shadow-xl flex items-center justify-center hover:shadow-2xl transition-all active:scale-95">
          <span className="text-2xl">🛒</span>
          <span className="absolute -top-1 -right-1 bg-white text-[var(--aura-noir-deep)] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">2</span>
        </button>
      </div>

      {/* Footer */}
<PageFooter
  brand="AURA CAFE"
  socialSize="sm"
  copyLine="© 2024 AURA CAFE. Industrial Luxury Dining."
/>
    </StitchShell>
  );
}
