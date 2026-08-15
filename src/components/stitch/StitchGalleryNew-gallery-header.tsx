/**
 * Top app bar for StitchGalleryNew
 */

import { Menu, ShoppingBag } from 'lucide-react';

export function GalleryTopBar() {
  return (
    <header className="fixed top-0 z-50 flex h-20 w-full items-center justify-between border-b border-[var(--aura-chrome-soft)]/30 bg-[var(--aura-surface-dim)]/90 px-6 backdrop-blur-xl md:px-20">
      <div className="flex items-center">
        <button type="button" className="text-[var(--aura-chrome-bright)]" aria-label="Menu">
          <Menu size={24} />
        </button>
      </div>
      <h1 className="font-[family-name:var(--aura-display-font)] text-3xl uppercase tracking-tighter text-[var(--aura-chrome-bright)] md:text-5xl">
        AURA CAFE
      </h1>
      <div className="flex items-center">
        <button type="button" className="text-[var(--aura-chrome-bright)]" aria-label="Shopping Bag">
          <ShoppingBag size={24} />
        </button>
      </div>
    </header>
  );
}

export function GallerySectionHeader() {
  return (
    <div className="mb-12">
      <h2
        className="border-l-4 pl-4 font-[family-name:var(--aura-display-font)] text-4xl uppercase tracking-widest text-[var(--aura-chrome-bright)] md:text-5xl"
        style={{ borderLeftColor: 'var(--aura-bronze-shimmer)' }}
      >
        Design Showcase
      </h2>
      <p className="mt-4 font-[family-name:var(--aura-body-font)] text-xl text-[var(--aura-chrome-soft)] opacity-70">
        Exploring the industrial luxury and visual language of AURA.
      </p>
    </div>
  );
}
