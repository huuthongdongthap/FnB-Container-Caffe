export function AccountHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 h-16 bg-[#040B14]/80 backdrop-blur-2xl border-b border-white/10">
      <button
        aria-label="Open menu"
        className="flex flex-col gap-[5px] p-1 text-[var(--aura-chrome-bright)] hover:opacity-80 active:scale-95 transition-all"
      >
        <span className="block h-[2px] w-5 bg-current rounded-full" />
        <span className="block h-[2px] w-5 bg-current rounded-full" />
        <span className="block h-[2px] w-5 bg-current rounded-full" />
      </button>

      <h1 className="font-display text-base tracking-[0.3em] text-[var(--aura-chrome-mid)] uppercase">
        AURA CAFE
      </h1>

      <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center">
        <span className="text-lg">👤</span>
      </div>
    </header>
  );
}
