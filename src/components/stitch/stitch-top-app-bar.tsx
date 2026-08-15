import { ArrowLeft, X } from 'lucide-react';

interface TopAppBarProps {
  onBack?: () => void;
  onClose?: () => void;
}

export function TopAppBar({ onBack, onClose }: TopAppBarProps) {
  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--aura-chrome-soft)]/20 bg-[var(--aura-surface-dim)] px-5">
      <button
        type="button"
        className="flex items-center text-[var(--aura-bronze-shimmer)] transition-opacity hover:opacity-80 active:scale-95"
        onClick={onBack}
      >
        <ArrowLeft className="text-[var(--aura-bronze-shimmer)]" />
      </button>
      <h1 className="font-[family-name:var(--aura-display-font)] text-xl uppercase tracking-widest text-[var(--aura-bronze-shimmer)]">
        AURA CAFE
      </h1>
      <button
        type="button"
        className="flex items-center text-[var(--aura-bronze-shimmer)] transition-opacity hover:opacity-80 active:scale-95"
        onClick={onClose}
      >
        <X className="text-[var(--aura-bronze-shimmer)]" />
      </button>
    </header>
  );
}
