import { HERO_IMG } from './mobile-data';

/**
 * Hero banner with carousel indicator tabs and "Brewing Elegance" tagline.
 */
export function MobileHero() {
  const tabs = ['Latte Art', 'Brewing Art', 'Cold Brew'];

  return (
    <section className="relative h-[574px] overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_IMG})` }}
        aria-hidden="true"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-[var(--aura-noir-void)] via-transparent to-transparent z-[1]" />

      {/* Carousel indicator tabs */}
      <div className="absolute top-6 left-0 right-0 z-10 flex gap-2 px-4 justify-center">
        {tabs.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-selected={i === 0}
            className={`px-3 py-1 rounded-full text-[10px] font-body font-medium tracking-widest uppercase transition-all ${
              i === 0
                ? 'bg-white/15 text-white border border-white/20'
                : 'bg-white/5 text-white/50 border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bottom hero content */}
      <div className="absolute bottom-0 left-0 right-0 z-[3] p-4 pb-8">
        <p className="font-body text-xs font-medium tracking-[0.3em] uppercase text-[var(--aura-chrome-light)] mb-3">
          Exclusive Series / Bộ Sưu Tập Độc Quyền
        </p>
        <h1 className="font-display text-4xl md:text-5xl italic text-white max-w-xs leading-tight">
          Brewing<br />Elegance
        </h1>
        <p className="font-display text-lg italic text-[var(--aura-chrome-mid)] mt-1 max-w-[260px]">
          Nơi pha chế đã nghệ thuật
        </p>
      </div>
    </section>
  );
}
