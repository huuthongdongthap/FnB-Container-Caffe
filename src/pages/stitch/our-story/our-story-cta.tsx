export function CtaSection() {
  return (
    <section className="py-32 md:py-40 px-5 md:px-16 text-center bg-[var(--aura-noir-void)]">
      <div className="max-w-4xl mx-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-12 md:p-24 relative overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-[var(--aura-chrome-bright)]/10 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[var(--aura-chrome-mid)]/10 blur-[100px] rounded-full" />

        <h2 className="font-display text-4xl md:text-6xl lg:text-7xl text-white mb-8">
          Join the Pulse.
        </h2>
        <p className="text-[var(--aura-chrome-mid)] mb-12 max-w-xl mx-auto font-body font-light leading-relaxed">
          Experience the convergence of architectural design and the world{'\''}s most precise
          caffeine delivery system.
        </p>
        <button
          className="bg-[var(--aura-chrome-mid)] hover:bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] px-10 md:px-12 py-4 font-body text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 shadow-xl flex items-center gap-3 mx-auto rounded-lg"
        >
          Experience the Precision →
        </button>
      </div>
    </section>
  );
}
