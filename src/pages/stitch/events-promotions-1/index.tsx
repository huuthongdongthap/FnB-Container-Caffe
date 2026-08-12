import { useState, useEffect, useRef } from 'react';
import { StitchShell } from '../StitchBase';

/* ── Data ─────────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { label: 'Vessels', href: '#vessels' },
  { label: 'Events', href: '#events' },
  { label: 'Journal', href: '#journal' },
  { label: 'Location', href: '#location' },
] as const;

const PROMOTIONS = [
  {
    id: 'golden-hour',
    label: 'Promotion',
    title: 'Golden Hour',
    description:
      'Half-price signature brews from 4:00 PM to 6:00 PM. A transition from day to dusk.',
    cta: 'Details',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAm3VcyJQVXnfbrL2pi1TM6GVGawTaENyJSeAN4enTNuUnfB2TmqN-2Wz3XWYNWRtMzFBgPxW1J5SkkbIuzltOxCkvrsEoisR4rqq7bUykFeCMprxT7E7_0ccP5-S56sTMKkvKitGo47vT_KgZEhSX-h_NE9s3cAVSM801J8vHO0_o7EVkZN3FvT7_YJBcR8xVBP5v3Ah-OxgQIVyraUnnIHiJ10sz38lwaojq6yTg16Db_Lw1RtX1kTi3lKTK5-96WtkEaSqMfnjI',
  },
  {
    id: 'bean-craft',
    label: 'Workshop',
    title: 'Bean Craft Workshop',
    description:
      'Monthly cupping sessions exploring single-origin profiles and technical brewing methods.',
    cta: 'Reserve Seat',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCEM9xvKBOCwsH1fGEEPUsrO2fXD6WzF3rs_Wel972P79cE5qUXKZ1sz7X7mLSYXF-vVdxF9KfCwGUH4G7SEMJDy9DRxhk2p7zGoWBz8Rj7jCeb3q9PVKIK_Jh1WUXJf4lIysyr6uMU2kgJkNG4J_FNCyZoNBIYhP5nt7dxTA8vgm0YCmijJ1DZNfBmkN9HZNjvMIysgfxwzGc6BD7zJ6CGm-gASrY02URP0KUVbDnU_MvRSbTsMpmbY6kSMj-2AFdYhszlfSMT2U8',
  },
  {
    id: 'midnight-jazz',
    label: 'Live Performance',
    title: 'Midnight Jazz',
    description:
      'Immersive live sets starting at 10:00 PM. Dark tones for the late-night observer.',
    cta: 'View Lineup',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDdl4TPNPqDmqsr7ahmEfsxFKyyXQSHuugMuxDecD9et__KiRCpFXjtxuwVglaUCo0P0BoqwQ2TOyHFinoND10WlG2_mAH18gMJGoM2J9GQ1BH9ed-0JKy4LMQVFDxo0x7Rk6fh6aNPOYCU31rJvVuxco8oBYXdlfeX60Udp4Aduw5myJW-nLqI3LdTzJNrbmdF8DDHVXamcIclCkjsuwTpyExpk1yyTvGO5kthwU4KQyL7ZWuXDdZp3MZqEPGeckhje0Svf_Ci2Ik',
  },
] as const;

const EVENTS = [
  {
    month: 'OCT',
    day: '14',
    title: 'Cold Brew Chemistry',
    time: '7:00 PM — 9:00 PM',
    status: 'Limited Capacity',
    action: 'add', disabled: false,
  },
  {
    month: 'OCT',
    day: '21',
    title: 'The Blue Note Collective',
    time: '10:00 PM — 1:00 AM',
    status: 'Sold Out',
    action: 'close',
    disabled: true,
  },
  {
    month: 'OCT',
    day: '28',
    title: 'Single Origin Symposium',
    time: '6:00 PM — 8:00 PM',
    status: '8 Spots Left',
    action: 'add', disabled: false,
  },
] as const;

const FOOTER_CONNECT = [
  'Instagram',
  'Spotify Playlist',
  'Contact',
] as const;

const FOOTER_LEGAL = [
  'Terms of Service',
  'Privacy Policy',
  'Sustainability',
] as const;

/* ── Component ────────────────────────────────────────────────────────── */

export default function EventsPromotions1() {
  const [hoveredReserve, setHoveredReserve] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  const heroRef = useRef<HTMLElement>(null);
  const promoRef = useRef<HTMLElement>(null);
  const scheduleRef = useRef<HTMLElement>(null);
  const newsletterRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sections = [
      { id: 'hero', ref: heroRef },
      { id: 'promo', ref: promoRef },
      { id: 'schedule', ref: scheduleRef },
      { id: 'newsletter', ref: newsletterRef },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.1 },
    );

    sections.forEach(({ ref }) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, []);

  const actionIcon = (action: string) => {
    if (action === 'add') return '+';
    if (action === 'close') return '✕';
    return '';
  };

  return (
    <StitchShell>
      {/* ── Navigation ──────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-5 md:px-16 py-4 bg-white/5 backdrop-blur-xl border-b border-[var(--aura-border-chrome)]/30"
        onMouseEnter={() => setHoveredReserve(true)}
        onMouseLeave={() => setHoveredReserve(false)}
      >
        <span className="font-display text-lg md:text-xl text-[var(--aura-chrome-bright)] tracking-widest uppercase">
          AURA CAFE
        </span>

        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        <button
          className={`px-6 py-2 font-body text-xs font-semibold uppercase tracking-widest transition-all ${
            hoveredReserve
              ? 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] shadow-[0_0_20px_rgba(212,165,116,0.3)]'
              : 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)]'
          }`}
        >
          Reserve
        </button>
      </nav>

      <main className="pt-20">
        {/* ── Hero Section ───────────────────────────────────────────── */}
        <section
          ref={heroRef}
          id="hero"
          className={`relative h-[870px] flex items-center justify-center overflow-hidden transition-all duration-700 ${
            visibleSections.has('hero')
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-10'
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

        {/* ── Promotions Grid ────────────────────────────────────────── */}
        <section
          ref={promoRef}
          id="promo"
          className={`py-20 max-w-[1200px] mx-auto px-8 transition-all duration-700 ${
            visibleSections.has('promo')
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
            <div>
              <h2 className="font-display text-2xl md:text-3xl mb-2">
                Curated Engagements
              </h2>
              <div className="h-1 w-20" style={{ backgroundColor: 'var(--aura-neon-bronze)' }} />
            </div>
            <p className="font-body text-base text-[var(--aura-chrome-mid)] max-w-md">
              Exclusive promotions and workshops designed for the discerning
              coffee connoisseur.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PROMOTIONS.map((promo) => (
              <div
                key={promo.id}
                className="group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] overflow-hidden transition-all duration-500 hover:-translate-y-2"
              >
                <div className="h-64 overflow-hidden">
                  <img
                    src={promo.image}
                    alt={promo.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                <div className="p-8">
                  <span
                    className="font-body text-xs font-medium uppercase tracking-widest"
                    style={{ color: 'var(--aura-neon-bronze)' }}
                  >
                    {promo.label}
                  </span>
                  <h3 className="font-display text-xl md:text-2xl italic mt-2 mb-4">
                    {promo.title}
                  </h3>
                  <p className="font-body text-sm text-[var(--aura-chrome-mid)] mb-6">
                    {promo.description}
                  </p>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 text-sm hover:gap-4 transition-all"
                    style={{ color: 'var(--aura-tertiary)' }}
                  >
                    {promo.cta}
                    <span className="text-[16px]">→</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Event Details / Schedule ───────────────────────────────── */}
        <section
          ref={scheduleRef}
          id="schedule"
          className={`py-20 transition-all duration-700 ${
            visibleSections.has('schedule')
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-10'
          }`}
          style={{ backgroundColor: 'var(--aura-noir-deep)' }}
        >
          <div className="max-w-[1200px] mx-auto px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
              {/* Left Column */}
              <div className="lg:col-span-4">
                <h2 className="font-display text-2xl md:text-3xl mb-6 italic">
                  The Social
                  <br />
                  Manifesto
                </h2>
                <p className="font-body text-base text-[var(--aura-chrome-mid)] mb-8">
                  AURA CAFE is more than a destination; it is a ritual. Our
                  events are engineered to provide a sanctuary from the digital
                  noise.
                </p>
                <div className="flex items-center gap-4 py-4 border-y" style={{ borderColor: 'var(--aura-border-chrome)' }}>
                  <span style={{ color: 'var(--aura-neon-bronze)' }}>📍</span>
                  <span className="font-body text-sm tracking-wider">
                    Industrial District, Pier 14
                  </span>
                </div>
              </div>

              {/* Right Column — Event Rows */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                {EVENTS.map((event) => (
                  <div
                    key={event.day}
                    className="group flex flex-col md:flex-row md:items-center justify-between p-6 border-b transition-colors hover:bg-white/5"
                    style={{ borderColor: 'var(--aura-border-chrome)' }}
                  >
                    <div className="flex gap-8 items-center">
                      <div className="text-center min-w-[60px]">
                        <p className="font-body text-xs text-[var(--aura-chrome-mid)] tracking-wider">
                          {event.month}
                        </p>
                        <p
                          className="font-display text-2xl"
                          style={{ color: 'var(--aura-neon-bronze)' }}
                        >
                          {event.day}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-display text-lg mb-1">{event.title}</h4>
                        <p className="font-body text-sm text-[var(--aura-chrome-mid)]">
                          {event.time}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 md:mt-0 flex items-center gap-4">
                      <span
                        className={`font-body text-xs px-3 py-1 border rounded-full uppercase tracking-wider ${
                          event.status === 'Sold Out'
                            ? 'cursor-not-allowed opacity-50'
                            : ''
                        }`}
                        style={{ borderColor: 'var(--aura-border-chrome)' }}
                      >
                        {event.status}
                      </span>
                      <button
                        className={`p-2 border rounded-full transition-all ${
                          event.disabled
                            ? 'border-[var(--aura-border-chrome)] text-[var(--aura-chrome-mid)] cursor-not-allowed opacity-50'
                            : 'border-[var(--aura-tertiary)] text-[var(--aura-tertiary)] hover:bg-[var(--aura-tertiary)] hover:text-[var(--aura-noir-deep)]'
                        }`}
                        disabled={event.disabled}
                      >
                        <span>{actionIcon(event.action)}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Newsletter ─────────────────────────────────────────────── */}
        <section
          ref={newsletterRef}
          id="newsletter"
          className={`py-20 transition-all duration-700 ${
            visibleSections.has('newsletter')
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="max-w-[800px] mx-auto px-8 text-center">
            <h2 className="font-display text-4xl md:text-5xl italic mb-6">
              Join the Circle
            </h2>
            <p className="font-body text-base text-[var(--aura-chrome-mid)] mb-10 max-w-lg mx-auto">
              Subscribe to receive early access to event bookings and exclusive
              monthly promotions curated for our inner circle.
            </p>
            <form
              className="flex flex-col md:flex-row gap-3 items-center justify-center p-3 rounded-full border border-white/10 max-w-xl mx-auto shadow-xl"
              style={{ backgroundColor: 'var(--aura-noir-deep)' }}
            >
              <input
                type="email"
                placeholder="Email Address"
                required
                className="w-full md:flex-1 bg-transparent border-none focus:ring-0 px-6 py-3 font-body text-sm text-[var(--aura-chrome-bright)] placeholder:text-[var(--aura-chrome-dark)]"
              />
              <button
                type="submit"
                className="w-full md:w-auto px-10 py-3 font-body text-xs font-semibold uppercase tracking-widest rounded-full bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-void)] hover:bg-[var(--aura-neon-bronze)] hover:text-[var(--aura-noir-deep)] transition-all duration-300"
              >
                Subscribe
              </button>
            </form>
            <p
              className="mt-6 font-body text-xs tracking-widest uppercase opacity-60"
              style={{ color: 'var(--aura-chrome-dark)' }}
            >
              Frequency: Bi-weekly
            </p>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t py-20 mt-20" style={{ borderColor: 'var(--aura-border-chrome)', backgroundColor: 'var(--aura-noir-deep)' }}>
        <div className="max-w-[1200px] mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <span className="font-display text-xl italic text-[var(--aura-chrome-mid)]">
              AURA CAFE
            </span>
            <p className="font-body text-sm text-[var(--aura-chrome-dark)]">
              Precision engineering meets atmospheric tranquility. The sanctum
              of the modern connoisseur.
            </p>
          </div>

          {/* Connect */}
          <div className="flex flex-col gap-3">
            <h5
              className="font-body text-sm font-medium uppercase tracking-widest"
              style={{ color: 'var(--aura-tertiary)' }}
            >
              Connect
            </h5>
            <div className="flex flex-col gap-2">
              {FOOTER_CONNECT.map((link) => (
                <a
                  key={link}
                  href="#"
                  className="font-body text-sm text-[var(--aura-chrome-dark)] hover:text-[var(--aura-chrome-bright)] transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            <h5
              className="font-body text-sm font-medium uppercase tracking-widest"
              style={{ color: 'var(--aura-tertiary)' }}
            >
              Legal
            </h5>
            <div className="flex flex-col gap-2">
              {FOOTER_LEGAL.map((link) => (
                <a
                  key={link}
                  href="#"
                  className="font-body text-sm text-[var(--aura-chrome-dark)] hover:text-[var(--aura-chrome-bright)] transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div
          className="max-w-[1200px] mx-auto px-8 mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4"
          style={{ borderColor: 'rgba(142,144,151,0.2)' }}
        >
          <p
            className="font-body text-xs text-[var(--aura-chrome-dark)]"
          >
            © 2024 AURA CAFE. ENGINEERED FOR CALM.
          </p>
          <div className="flex gap-4 items-center">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--aura-neon-bronze)' }} />
            <span className="font-body text-xs uppercase tracking-wider text-[var(--aura-chrome-bright)]">
              Live at Pier 14
            </span>
          </div>
        </div>
      </footer>
    </StitchShell>
  );
}
