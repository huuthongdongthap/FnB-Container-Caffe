export function Nav() {
  return (
    <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-5 md:px-16 py-4 bg-white/5 backdrop-blur-xl border-b border-[var(--aura-border-chrome)]/30">
      <span className="font-display text-lg md:text-xl text-[var(--aura-chrome-bright)] tracking-widest uppercase">
        AURA CAFE
      </span>
      <div className="hidden md:flex items-center gap-10">
        <a className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors" href="#aesthetic">
          Container
        </a>
        <a className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors" href="#lounge">
          Experience
        </a>
        <a className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors" href="#menu">
          Menu
        </a>
      </div>
      <button className="bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-6 py-2 font-body text-xs font-semibold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
        Reservation
      </button>
    </nav>
  );
}

export function HeroSection() {
  return (
    <section className="relative h-screen flex items-center justify-center pt-20 overflow-hidden">
      <div className="relative z-10 text-center px-5 md:px-16 max-w-4xl">
        <span className="font-body text-sm text-[var(--aura-tertiary)] tracking-[0.3em] uppercase mb-6 block">
          Industrial Luxury
        </span>
        <h1 className="font-display text-5xl md:text-7xl leading-tight text-[var(--aura-chrome-bright)] mb-6">
          AURA CAFE —
          <br />
          <span className="italic font-normal">Container Caffe &amp; Space</span>
        </h1>
        <p className="font-body text-lg text-[var(--aura-chrome-variant)] max-w-2xl mx-auto mb-10 leading-relaxed">
          Experience the intersection of raw industrial aesthetics and premium nocturnal comfort.
          Our shipping container architecture creates an exclusive haven for the sophisticated coffee connoisseur.
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
          <button className="bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-10 py-3 font-body text-xs font-semibold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
            Explore the Menu
          </button>
          <button className="border border-[var(--aura-chrome-mid)]/30 text-[var(--aura-chrome-mid)] px-10 py-3 font-body text-xs uppercase tracking-widest hover:bg-[var(--aura-chrome-mid)]/10 transition-all">
            View Space
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-60">
        <span className="font-body text-xs text-[var(--aura-chrome-mid)] uppercase tracking-widest">Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-[var(--aura-chrome-mid)] to-transparent" />
      </div>
    </section>
  );
}
