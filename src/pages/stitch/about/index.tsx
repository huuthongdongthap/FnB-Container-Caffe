import { useEffect, useRef } from 'react';
import { StitchShell } from '../StitchBase';

/* ── Interfaces ─────────────────────────────────────────────────────── */

interface TimelineStep {
  icon: string;
  titleEn: string;
  titleVi: string;
  description: string;
}

interface StatItem {
  value: string;
  labelEn: string;
  labelVi: string;
}

interface SocialLink {
  icon: string;
  label: string;
  href: string;
}

/* ── Data ───────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { label: 'Menu', href: '#menu' },
  { label: 'Story', href: '#story' },
  { label: 'Reservation', href: '#reservation' },
  { label: 'Location', href: '#location' },
] as const;

const TIMELINE_STEPS: TimelineStep[] = [
  {
    icon: '\u{1F3ED}',
    titleEn: 'Structural Origins',
    titleVi: 'Gốc Công Trình',
    description:
      'Three high-cube shipping containers re-engineered into a minimalist sanctuary. Raw steel meets precision glass — every scar tells a story of rebirth.',
  },
  {
    icon: '\u{1F3A8}',
    titleEn: 'Brewing Artistry',
    titleVi: 'Nghệ Thuật Pha Chế',
    description:
      'Custom pressure profiles, single-estate beans, and laboratory-grade filtration. Each cup is a repeatable masterpiece of flavor chemistry.',
  },
  {
    icon: '\u{1F525}',
    titleEn: 'The Roast',
    titleVi: 'Nướng Hạt',
    description:
      'Small-batch roasting calibrated to the nocturnal rhythm. Beans sourced from 50+ origins, roasted to unlock depth, clarity, and soul.',
  },
];

const STATS: StatItem[] = [
  { value: '2024', labelEn: 'Established', labelVi: 'Thành Lập' },
  { value: '12K+', labelEn: 'Cups Served', labelVi: 'Ly Đã Phục Vụ' },
  { value: '50+', labelEn: 'Bean Origins', labelVi: 'Nguồn Gốc Hạt' },
];

const SOCIAL_LINKS: SocialLink[] = [
  { icon: '\u{1F4F7}', label: 'Instagram', href: '#' },
  { icon: '\u{1F4D8}', label: 'Facebook', href: '#' },
  { icon: '\u{1F3B5}', label: 'TikTok', href: '#' },
];

/* ── Grain Canvas ───────────────────────────────────────────────────── */

function GrainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let frameId: number;
    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const v = Math.random() * 255;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 18;
      }

      ctx.putImageData(imageData, 0, 0);
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 opacity-30 pointer-events-none"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    />
  );
}

/* ── Component: OurStory ─────────────────────────────────────────────── */

export default function OurStory() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const cards = document.querySelectorAll('.story-reveal');
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-10');
          }
        });
      },
      { threshold: 0.15 },
    );

    cards.forEach((card) => observerRef.current?.observe(card));

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <StitchShell>
      <GrainCanvas />

      {/* ── Fixed Header ──────────────────────────────────────── */}
      <header className="fixed top-0 w-full z-50">
        <div className="flex justify-between items-center px-5 md:px-16 py-4 bg-[var(--aura-noir-deep)]/80 backdrop-blur-xl border-b border-[var(--aura-border-chrome)]/20">
          {/* Brand */}
          <span className="font-display text-lg md:text-xl text-[var(--aura-tertiary)] tracking-widest uppercase">
            AURA CAFE
          </span>

          {/* Menu icon (desktop links) */}
          <nav className="hidden md:flex items-center gap-10">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors duration-300 uppercase tracking-wider"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Reservation badge */}
          <a
            href="#reservation"
            className="flex items-center gap-2 bg-[var(--aura-tertiary)]/15 border border-[var(--aura-tertiary)]/40 text-[var(--aura-tertiary)] px-5 py-2 font-body text-xs font-semibold uppercase tracking-widest hover:bg-[var(--aura-tertiary)]/25 transition-all"
          >
            <span aria-hidden="true">{'\u{1F4CB}'}</span>
            Reservation
          </a>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6">
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[var(--aura-noir-deep)]/85 z-10" />

        {/* Architectural background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuACV1Udt-Hrc1M1LgOPzS7v8AzKj9LY37FvF84qcsl1xnhN5UpzbjAL7YECy1F2462ZGEk_OP-7A8hik2pOP99Nojnf51y7Mb9IXjGQlTQSBeym9fR_cxzw_ny6yQEcG98L50URyngya9UOMRkc7u4sVMPyLbRdY_AX2IBE_yf7BLinia4L9wIYd3OwmyUkxasutf0d7CdGedJ3TmOVNoAzkuqjCqp37ucfYgkbSivwlE_Pm9uErwenNM_ZOMrcNHe0Ix1egPArFyo')",
          }}
          role="img"
          aria-label="Industrial luxury cafe built from shipping containers with bronze accent lighting"
        />

        <div className="relative z-20 text-center max-w-4xl mx-auto pt-24">
          <span className="block font-label-caps text-[var(--aura-chrome-dark)] tracking-[0.4em] uppercase mb-8 text-xs md:text-sm">
            AURA CAFE — Est. 2024
          </span>

          <h1 className="font-display text-display-lg md:text-display-lg text-white leading-tight mb-6" style={{ fontStyle: 'italic' }}>
            Our Story&nbsp;
            <span className="text-[var(--aura-tertiary)]" style={{ fontStyle: 'normal' }}>
              /
            </span>
            <br className="sm:hidden" />
            &nbsp;Câu chuyện
          </h1>

          <p className="font-body text-body-lg md:text-body-lg text-[var(--aura-chrome-mid)] max-w-2xl mx-auto font-light leading-relaxed">
            Từ khung thép công nghiệp đến không gian cà phê đương đại —{' '}
            <span className="text-[var(--aura-tertiary)]">
              nơi kiến trúc container gặp nghệ thuật rang xay
            </span>
          </p>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 animate-bounce-slow"
          aria-hidden="true"
        >
          <span className="text-[var(--aura-chrome-mid)] text-2xl">{'\u{2193}'}</span>
        </div>
      </section>

      {/* ── Philosophy: The Craft / Nghệ thuật ──────────────────── */}
      <section id="philosophy" className="py-24 md:py-32 px-6 md:px-16">
        <div className="max-w-3xl mx-auto story-reveal opacity-0 translate-y-10 transition-all duration-700">
          <div className="glass-panel p-10 md:p-16 text-center">
            <span className="font-label-caps text-[var(--aura-chrome-dark)] tracking-[0.3em] uppercase block mb-6 text-xs">
              Philosophy — Triết Lý
            </span>

            <h2 className="font-display text-headline-md md:text-headline-md text-[var(--aura-tertiary)] mb-8" style={{ fontStyle: 'italic' }}>
              The Craft&nbsp;
              <span className="text-[var(--aura-chrome-mid)] text-headline-sm">
                / Nghệ thuật
              </span>
            </h2>

            <p className="font-body text-body-md md:text-body-lg text-[var(--aura-chrome-bright)] leading-relaxed font-light">
              Aura Cafe was born from a singular obsession: to build a space where industrial
              architecture and the art of coffee converge. We salvaged three decommissioned
              shipping containers and reimagined them as a nocturnal sanctuary — a place where
              raw steel, panoramic glass, and the alchemy of precision brewing create something
              neither cafe nor gallery, but both.
            </p>

            <p className="font-body text-body-md text-[var(--aura-chrome-mid)] leading-relaxed font-light mt-6">
              Mỗi chi tiết đều được chế tác — từ khung thép đến hạt cà phê đơn nguồn.
              Không phải quán cà phê, không phải phòng trưng bày. Mà cả hai.
            </p>
          </div>
        </div>
      </section>

      {/* ── Stats Row ──────────────────────────────────────────── */}
      <section className="py-16 md:py-20 px-6 md:px-16 border-y border-[var(--aura-border-chrome)]/15">
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-8 md:gap-16">
          {STATS.map((stat) => (
            <div key={stat.value} className="text-center story-reveal opacity-0 translate-y-10 transition-all duration-700">
              <p className="font-display text-headline-md md:text-headline-lg text-[var(--aura-tertiary)]" style={{ fontStyle: 'italic' }}>
                {stat.value}
              </p>
              <p className="font-body text-body-sm text-[var(--aura-chrome-mid)] mt-2 uppercase tracking-wider">
                {stat.labelEn}
              </p>
              <p className="font-body text-body-sm text-[var(--aura-chrome-dark)] mt-1">
                {stat.labelVi}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Craftsmanship Timeline ──────────────────────────────── */}
      <section id="story" className="py-24 md:py-32 px-6 md:px-16 bg-[var(--aura-noir-deep)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <span className="font-label-caps text-[var(--aura-chrome-dark)] tracking-[0.3em] uppercase block mb-4 text-xs">
              Process — Quy Trình
            </span>
            <h2 className="font-display text-display-lg text-[var(--aura-tertiary)]" style={{ fontStyle: 'italic' }}>
              Craftsmanship
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TIMELINE_STEPS.map((step, index) => (
              <div
                key={step.titleEn}
                className="story-reveal opacity-0 translate-y-10 transition-all duration-700"
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <div className="glass-panel p-8 md:p-10 text-center h-full flex flex-col items-center">
                  {/* Icon */}
                  <span className="text-4xl md:text-5xl mb-6 block" aria-hidden="true">
                    {step.icon}
                  </span>

                  {/* Step number */}
                  <span className="font-label-caps text-[var(--aura-chrome-dark)] tracking-[0.2em] text-[10px] uppercase block mb-4">
                    Step {String(index + 1).padStart(2, '0')}
                  </span>

                  {/* Titles */}
                  <h3 className="font-display text-title-lg text-[var(--aura-chrome-bright)] mb-2">
                    {step.titleEn}
                  </h3>
                  <p className="font-body text-body-sm text-[var(--aura-tertiary)] uppercase tracking-wider mb-6">
                    {step.titleVi}
                  </p>

                  {/* Divider */}
                  <div className="w-12 h-px bg-[var(--aura-tertiary)]/30 mb-6" aria-hidden="true" />

                  {/* Description */}
                  <p className="font-body text-body-sm text-[var(--aura-chrome-mid)] leading-relaxed font-light flex-1">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-[var(--aura-noir-void)] border-t border-[var(--aura-border-chrome)]/10 py-14 px-6 md:px-16">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-8">
          {/* Brand */}
          <span className="font-display text-headline-md text-[var(--aura-tertiary)] tracking-widest uppercase">
            AURA CAFE
          </span>

          {/* Social links */}
          <nav className="flex items-center gap-8" aria-label="Social links">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                aria-label={link.label}
                className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors duration-300 text-xl"
              >
                {link.icon}
              </a>
            ))}
          </nav>

          {/* Copyright */}
          <div className="text-center">
            <p className="font-body text-body-sm text-[var(--aura-chrome-dark)]">
              {'©'} 2024 AURA CAFE. ENGINEERED ELEGANCE.
            </p>
            <p className="font-body text-body-sm text-[var(--aura-chrome-dark)]/50 mt-1 text-xs">
              INDUSTRIAL LUXURY CAFE &mdash; SA DEC, VIETNAM
            </p>
          </div>
        </div>
      </footer>

      {/* ── Animations ─────────────────────────────────────────── */}
      <style>{`
        .story-reveal {
          transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </StitchShell>
  );
}
