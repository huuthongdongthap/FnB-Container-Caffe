export function ValuesSection() {
  return (
    <section className="py-32 px-5 md:px-16 max-w-[1280px] mx-auto overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Value 1: Purity */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 md:p-12 flex flex-col items-center text-center group">
          <div className="w-16 h-16 rounded-full border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center mb-8 group-hover:border-[var(--aura-chrome-bright)] transition-colors duration-500">
            <span className="text-[var(--aura-chrome-mid)] group-hover:text-[var(--aura-chrome-bright)] text-3xl transition-colors duration-500">
              ✅
            </span>
          </div>
          <h3 className="font-display text-lg md:text-xl text-white mb-4 uppercase tracking-widest">
            Purity
          </h3>
          <p className="text-[var(--aura-chrome-mid)] text-sm font-body font-light">
            Zero compromise on origin. We source only single-estate beans that meet our rigorous
            chemical profile standards.
          </p>
        </div>

        {/* Value 2: Integrity */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 md:p-12 flex flex-col items-center text-center group relative overflow-hidden">
          <div className="absolute inset-0 bg-[var(--aura-chrome-bright)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-16 h-16 rounded-full border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center mb-8 group-hover:border-[var(--aura-chrome-bright)] transition-colors duration-500">
            <span className="text-[var(--aura-chrome-mid)] group-hover:text-[var(--aura-chrome-bright)] text-3xl transition-colors duration-500">
              🔧
            </span>
          </div>
          <h3 className="font-display text-lg md:text-xl text-white mb-4 uppercase tracking-widest">
            Integrity
          </h3>
          <p className="text-[var(--aura-chrome-mid)] text-sm font-body font-light">
            Transparency in every gear. Our brewing process is fully visible, inviting curiosity
            and conversation.
          </p>
        </div>

        {/* Value 3: Sustainability */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 md:p-12 flex flex-col items-center text-center group">
          <div className="w-16 h-16 rounded-full border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center mb-8 group-hover:border-[var(--aura-chrome-bright)] transition-colors duration-500">
            <span className="text-[var(--aura-chrome-mid)] group-hover:text-[var(--aura-chrome-bright)] text-3xl transition-colors duration-500">
              🌿
            </span>
          </div>
          <h3 className="font-display text-lg md:text-xl text-white mb-4 uppercase tracking-widest">
            Sustainability
          </h3>
          <p className="text-[var(--aura-chrome-mid)] text-sm font-body font-light">
            Engineered for longevity. From container re-use to zero-waste filtration, we respect
            the machine that is our planet.
          </p>
        </div>
      </div>
    </section>
  );
}
