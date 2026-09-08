import { User } from 'lucide-react';

export function TopAppBar() {
  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--aura-surface-container)] bg-[var(--aura-surface-dim)] px-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="text-[var(--aura-chrome-bright)] active:scale-95"
          aria-label="Menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="AURA CAFE Logo"
          className="h-8 w-auto object-contain"
          src="/images/logo.svg"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="font-[family-name:var(--aura-display-font)] text-2xl uppercase tracking-widest text-[var(--aura-chrome-bright)]">
          AURA CAFE
        </span>
      </div>
      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[var(--aura-surface-container)] bg-[var(--aura-surface-container)] active:scale-95">
        <User className="text-sm text-[var(--aura-bronze-shimmer)]" />
      </div>
    </header>
  );
}
