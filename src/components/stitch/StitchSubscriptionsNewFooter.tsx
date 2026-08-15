export function StitchSubscriptionsNewFooter() {
  return (
    <footer className="w-full border-t border-[var(--aura-chrome-bright)]/10 bg-[var(--aura-surface-dim)] py-12">
      <div className="flex w-full flex-col items-center gap-6 px-5 text-center">
        <h2 className="font-[family-name:var(--aura-display-font)] text-3xl tracking-tighter text-[var(--aura-bronze-shimmer)]">
          AURA CAFE
        </h2>
        <nav className="flex flex-wrap justify-center gap-6">
          <button
            type="button"
            className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)] transition-colors hover:text-[var(--aura-bronze-shimmer)]/80"
          >
            PRIVACY POLICY
          </button>
          <button
            type="button"
            className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)] transition-colors hover:text-[var(--aura-bronze-shimmer)]/80"
          >
            TERMS OF SERVICE
          </button>
          <button
            type="button"
            className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)] transition-colors hover:text-[var(--aura-bronze-shimmer)]/80"
          >
            RECORDS
          </button>
        </nav>
        <p className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]/60">
          &copy; 2024 AURA CAFE. ALL RIGHTS RESERVED.
        </p>
      </div>
    </footer>
  );
}
