import { HERO_BG } from './our-story-data';

export function HeroSection() {
  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[var(--aura-noir-void)]/80 z-10" />
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `url('${HERO_BG}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </div>

      <div className="relative z-20 text-center px-6">
        <span className="block text-[var(--aura-chrome-mid)] tracking-[0.4em] uppercase mb-6 font-body text-xs font-semibold animate-pulse">
          Established 2024
        </span>
        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-white font-medium mb-8 leading-tight max-w-5xl mx-auto">
          The Art of the{' '}
          <span className="italic text-[var(--aura-chrome-mid)]">Nocturnal Pour</span>
        </h1>
        <div className="w-24 h-px bg-[var(--aura-chrome-mid)] mx-auto opacity-50" />
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
        <span className="font-body text-xs uppercase tracking-widest text-[var(--aura-chrome-mid)] opacity-60">
          Scroll to Explore
        </span>
        <div className="w-px h-16 bg-gradient-to-b from-[var(--aura-chrome-mid)] to-transparent" />
      </div>
    </section>
  );
}
