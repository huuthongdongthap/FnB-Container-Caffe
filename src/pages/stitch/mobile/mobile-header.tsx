/**
 * Fixed top header with menu button, brand name, and cart button.
 */
export function MobileHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/5 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-4">
      <button
        type="button"
        aria-label="Menu / Menu"
        className="flex items-center justify-center w-10 h-10 text-[var(--aura-chrome-bright)] hover:opacity-70 transition-opacity"
      >
        <span className="text-xl leading-none">{'\u{1F37C}'}</span>
      </button>

      <span className="font-body text-xs md:text-sm font-semibold tracking-[0.2em] uppercase text-[var(--aura-chrome-bright)] select-none">
        AURA CAFE
      </span>

      <button
        type="button"
        aria-label="Cart / Giỏ hàng"
        className="flex items-center justify-center w-10 h-10 text-[var(--aura-chrome-bright)] hover:opacity-70 transition-opacity relative"
      >
        <span className="text-xl leading-none">{'\u{1F6D2}'}</span>
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--aura-chrome-mid)]" />
      </button>
    </header>
  );
}
