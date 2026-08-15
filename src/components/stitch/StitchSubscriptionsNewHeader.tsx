export function StitchSubscriptionsNewHeader() {
  return (
    <header className="fixed top-0 z-50 mx-auto flex h-16 w-full max-w-5xl items-center justify-between border-b border-[var(--aura-chrome-bright)]/20 bg-[var(--aura-surface-dim)] px-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="text-[var(--aura-bronze-shimmer)] transition-transform active:scale-95"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-[family-name:var(--aura-display-font)] text-2xl font-bold tracking-tighter text-[var(--aura-bronze-shimmer)]">
          AURA CAFE
        </h1>
      </div>
      <button
        type="button"
        className="text-[var(--aura-bronze-shimmer)] transition-opacity hover:opacity-80"
      >
        <span className="material-symbols-outlined">more_vert</span>
      </button>
    </header>
  );
}
