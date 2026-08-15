import type { RefObject } from 'react';

interface HeroProps {
  heroRef: RefObject<HTMLElement | null>;
  isVisible: boolean;
}

export function EventsHero({ heroRef, isVisible }: HeroProps) {
  return (
    <section
      ref={heroRef}
      id="hero"
      className={`relative h-[870px] flex items-center justify-center overflow-hidden transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="absolute inset-0 z-0">
        <div
          className="w-full h-full bg-cover bg-center transition-transform duration-[10s] hover:scale-110"
          style={{
            backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDQZ_jh2cIn9DWPwzgWJbTKAzTnzDiEHu49EL7QjkzfibflFz0BLLXTxmKU2mYqJniE_iY_j2AACcyrpZLcp6HQo9t3TOR7umfr_OSBpYb8uUT_snx-lxqCD_MbMHWAMGBOLQwL4wI53UetcO_olEg80yPPTmTZ2NW6_mS3hbTxxVt55FEK-LK0vFMS-qS06-dly3VgnzXoHgXQMRrJQnb0ckjnZPRr1K6p7fPW6ZbECMzGmHLwgAdNlASwyN3YhunNi4ANA7KefDY')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-void)] via-[var(--aura-noir-void)]/40 to-transparent" />
      </div>

      <div className="relative z-10 max-w-[1200px] mx-auto px-8 text-center">
        <span
          className="font-body text-xs font-medium tracking-[0.3em] uppercase mb-4 block"
          style={{ color: 'var(--aura-neon-bronze)' }}
        >
          Nocturnal Sessions
        </span>
        <h1 className="font-display text-5xl md:text-7xl italic mb-8 max-w-4xl mx-auto leading-tight">
          Live Jazz &{' '}
          <span style={{ color: 'var(--aura-tertiary)' }}>Espresso</span>
        </h1>
        <p className="font-body text-lg text-[var(--aura-chrome-mid)] max-w-xl mx-auto mb-10">
          A curated sensory experience where the rhythmic soul of live jazz
          meets the precision of engineered caffeine. Join us every Friday
          evening.
        </p>
        <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
          <button className="w-full md:w-auto px-10 py-4 font-body text-xs font-semibold uppercase tracking-widest bg-[var(--aura-neon-bronze)] text-[var(--aura-noir-void)] rounded-full transition-all">
            Book Now
          </button>
          <button className="w-full md:w-auto px-10 py-4 font-body text-xs font-semibold uppercase tracking-widest border border-[var(--aura-chrome-mid)] text-[var(--aura-chrome-mid)] rounded-full hover:bg-white/5 transition-all">
            View Schedule
          </button>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-24"
        style={{
          background: 'linear-gradient(to bottom, transparent, var(--aura-border-chrome))',
        }}
      />
    </section>
  );
}
