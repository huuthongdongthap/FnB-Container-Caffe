export function StorySection() {
  return (
    <section className="py-32 px-5 md:px-16 max-w-[1280px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Header */}
        <div className="md:col-span-12 mb-16">
          <h2 className="font-display text-3xl md:text-4xl text-[var(--aura-chrome-bright)] mb-4">
            The Blueprint
          </h2>
          <p className="text-[var(--aura-chrome-mid)] max-w-2xl font-body font-light leading-relaxed">
            Aura Cafe is more than a destination; it{'\''}s a structural dialogue between raw
            industrial resilience and the ephemeral beauty of the perfect roast.
          </p>
        </div>

        {/* Architectural Salvage (md:col-span-7) */}
        <div className="md:col-span-7 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 md:p-12 border-t border-[var(--aura-chrome-mid)]/40 flex flex-col justify-between group">
          <div>
            <div className="flex items-center gap-4 mb-8">
              <span className="text-[var(--aura-chrome-mid)] text-4xl">🏗️</span>
              <span className="text-[var(--aura-chrome-bright)] font-bold tracking-tighter font-body">
                REF: 001
              </span>
            </div>
            <h3 className="font-display text-xl md:text-2xl text-white mb-6">
              Architectural Salvage
            </h3>
            <p className="text-[var(--aura-chrome-mid)] leading-relaxed font-body">
              Our foundation is built from decommissioned cargo containers, re-engineered as
              minimalist glass-walled sanctuaries. We embrace the industrial scars of the steel,
              celebrating its history while housing the future of hospitality.
            </p>
          </div>
          <div className="mt-12 h-64 overflow-hidden rounded-lg border border-white/5">
            <img
              className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
              alt="Close up of a weathered industrial container corner meeting a clean chrome glass frame."
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCPfD_Jmk4XFRuVxW23V1fnlA6_1Qu-BNqDWJ2dpYOrn8KE3OveBmrH_EZjrTYFUye1O7Z7Gj2F4NBEqEUsDLx1urd5bqF8rfNfm__g3buZH-uLov62E2-ARnhpxV7zv_x_p4WMOBdCM_TGrZxa3MiOWyeKRL_W2uZj1KDk010YbY7YToBkm21ofLeEpe8RYO1cr4GNwf5WRzOjmdu22tBl8Js-tyfMD_Dri79MVsa3HrV0_T72l6Fzl0P1IKoO4OU5b6MB5KPfGas"
            />
          </div>
        </div>

        {/* Right Column (md:col-span-5) — Precision Brewing + Nocturnal Sanctuary */}
        <div className="md:col-span-5 flex flex-col gap-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 md:p-10 border-t border-[var(--aura-chrome-mid)]/40 h-full group">
            <span className="text-[var(--aura-chrome-mid)] text-3xl mb-6 block">⚙️</span>
            <h3 className="font-display text-lg md:text-xl text-white mb-4">Precision Brewing</h3>
            <p className="text-[var(--aura-chrome-mid)] text-sm leading-relaxed font-body">
              We view extraction as an engineering challenge. Utilizing custom-modded pressure
              profiles and laboratory-grade filtration, every pour is a repeatable masterpiece of
              flavor chemistry.
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 md:p-10 border-t border-[var(--aura-chrome-mid)]/40 h-full group">
            <span className="text-[var(--aura-chrome-mid)] text-3xl mb-6 block">🌙</span>
            <h3 className="font-display text-lg md:text-xl text-white mb-4">
              Nocturnal Sanctuary
            </h3>
            <p className="text-[var(--aura-chrome-mid)] text-sm leading-relaxed font-body">
              Designed for the night owls, the thinkers, and the quiet creators. Our lighting is
              calibrated to the golden hour, creating a focus-enhancing void in the heart of the
              city.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
