/**
 * Fixed top header for the AURA CAFE promotions page.
 */
export function PromotionsHeader() {
  return (
    <header
      data-promo-header
      className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-[var(--aura-chrome-soft)]/30 bg-[var(--aura-surface-dim)]/80 px-4 py-2 backdrop-blur-xl"
    >
      <div className="flex items-center">
        <button
          className="flex items-center text-[var(--aura-chrome-bright)]"
          type="button"
          aria-label="Menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>
      <h1 className="font-[family-name:var(--aura-display-font)] text-2xl tracking-tighter text-[var(--aura-chrome-bright)]">
        AURA CAFE
      </h1>
      <div className="h-6 w-6" />
    </header>
  );
}
