const glassPanel =
  'bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px]';

export function CraftSection() {
  return (
    <section className="mt-32 max-w-7xl mx-auto">
      <div className={`${glassPanel} p-8 md:p-16 lg:p-24 relative overflow-hidden`}>
        <div className="relative z-10 max-w-2xl">
          <span className="font-body text-xs text-[var(--aura-tertiary)] uppercase tracking-[0.5em] block mb-6">
            The Craft
          </span>
          <h2 className="font-display text-3xl md:text-5xl leading-tight mb-8 italic">
            Precision is our primary ingredient.
          </h2>
          <p className="font-body text-lg text-[var(--aura-chrome-dark)] leading-relaxed mb-12">
            Every bean in our Reserve collection is sourced from high-altitude
            micro-lots and roasted in small batches to preserve the volatile
            aromatics of the origin. Our filtration system uses medical-grade
            stainless steel to ensure absolute purity in every drop.
          </p>

          {/* Stats */}
          <div className="flex gap-8 md:gap-16">
            <div className="flex flex-col">
              <span className="font-display text-3xl md:text-5xl text-[var(--aura-tertiary)]">
                0.5
              </span>
              <span className="font-body text-sm text-[var(--aura-chrome-dark)] uppercase tracking-widest mt-1">
                Micron Filter
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-3xl md:text-5xl text-[var(--aura-tertiary)]">
                94°
              </span>
              <span className="font-body text-sm text-[var(--aura-chrome-dark)] uppercase tracking-widest mt-1">
                Brew Temp
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
