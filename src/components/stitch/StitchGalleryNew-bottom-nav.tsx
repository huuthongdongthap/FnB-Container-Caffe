/**
 * Bottom navigation bar for StitchGalleryNew
 */

import { Home, Grid3x3, UtensilsCrossed, ArmchairIcon as Seat } from 'lucide-react';

export function GalleryBottomNav() {
  return (
    <nav className="fixed bottom-0 z-50 flex w-full items-center justify-around border-t border-[var(--aura-chrome-bright)]/20 bg-[var(--aura-surface-dim)]/95 backdrop-blur-lg">
      <button
        type="button"
        className="flex flex-col items-center justify-center pb-4 pt-2 text-[var(--aura-chrome-soft)]/60 transition-all hover:text-[var(--aura-chrome-bright)]"
      >
        <Home size={20} className="mb-1" />
        <span className="font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-widest">
          HOME
        </span>
      </button>
      <button
        type="button"
        className="flex scale-95 flex-col items-center justify-center border-t-2 pb-4 pt-2 text-[var(--aura-chrome-bright)] transition-all"
        style={{
          borderTopColor: 'var(--aura-chrome-bright)',
        }}
      >
        <Grid3x3 size={20} className="mb-1" style={{ fontVariationSettings: "'FILL' 1" }} />
        <span className="font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-widest">
          GALLERY
        </span>
      </button>
      <button
        type="button"
        className="flex flex-col items-center justify-center pb-4 pt-2 text-[var(--aura-chrome-soft)]/60 transition-all hover:text-[var(--aura-chrome-bright)]"
      >
        <UtensilsCrossed size={20} className="mb-1" />
        <span className="font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-widest">
          MENU
        </span>
      </button>
      <button
        type="button"
        className="flex flex-col items-center justify-center pb-4 pt-2 text-[var(--aura-chrome-soft)]/60 transition-all hover:text-[var(--aura-chrome-bright)]"
      >
        <Seat size={20} className="mb-1" />
        <span className="font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-widest">
          RESERVE
        </span>
      </button>
    </nav>
  );
}
