'use client';

import { useRef, useEffect } from 'react';

// ─── Placeholder image generators (inline SVG data URIs) ───────────────────
// Replace with real assets in public/ later.

const HERO_IMG =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 574">
    <defs>
      <radialGradient id="g1" cx="70%" cy="30%" r="60%"><stop offset="0%" stop-color="#1a1a3e"/><stop offset="100%" stop-color="#050510"/></radialGradient>
      <radialGradient id="g2" cx="30%" cy="70%" r="40%"><stop offset="0%" stop-color="#3a5f8a" stop-opacity="0.4"/><stop offset="100%" stop-color="transparent"/></radialGradient>
    </defs>
    <rect width="390" height="574" fill="url(#g1)"/>
    <rect width="390" height="574" fill="url(#g2)"/>
    <path d="M160 160 Q155 130 165 100" stroke="rgba(255,255,255,0.12)" fill="none" stroke-width="1.5"/>
    <path d="M175 155 Q170 120 180 90" stroke="rgba(255,255,255,0.08)" fill="none" stroke-width="1.2"/>
    <ellipse cx="170" cy="320" rx="80" ry="20" fill="rgba(255,255,255,0.04)"/>
    <rect x="90" y="260" width="160" height="80" rx="8" fill="rgba(30,30,50,0.6)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <path d="M155 285 Q155 275 165 278 Q175 275 175 285 Q175 298 165 305 Q155 298 155 285Z" fill="rgba(180,170,155,0.2)"/>
    <circle cx="120" cy="200" r="1.2" fill="rgba(210,210,215,0.35)"/>
    <circle cx="200" cy="180" r="0.8" fill="rgba(210,210,215,0.3)"/>
    <circle cx="250" cy="220" r="1" fill="rgba(210,210,215,0.25)"/>
    <circle cx="140" cy="350" r="0.9" fill="rgba(210,210,215,0.3)"/>
    <circle cx="300" cy="160" r="1.1" fill="rgba(210,210,215,0.2)"/>
    <circle cx="100" cy="420" r="0.7" fill="rgba(210,210,215,0.25)"/>
    <circle cx="320" cy="380" r="1.3" fill="rgba(210,210,215,0.2)"/>
    <circle cx="300" cy="120" r="120" fill="rgba(40,60,120,0.15)"/>
  </svg>`);

const MOCHA_IMG =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 192">
    <rect width="256" height="192" fill="#131316"/>
    <rect x="20" y="20" width="216" height="152" rx="16" fill="rgba(60,45,30,0.3)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <path d="M80 60 L80 140 Q80 160 100 160 L140 160 Q160 160 160 140 L160 60Z" fill="rgba(80,55,35,0.4)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <ellipse cx="120" cy="80" rx="30" ry="6" fill="rgba(50,30,15,0.6)"/>
    <ellipse cx="115" cy="90" rx="25" ry="5" fill="rgba(60,35,20,0.5)"/>
    <rect x="100" y="65" width="6" height="2" rx="1" fill="rgba(210,210,215,0.5)" transform="rotate(-20 103 66)"/>
    <rect x="130" y="70" width="5" height="2" rx="1" fill="rgba(210,210,215,0.4)" transform="rotate(15 132 71)"/>
    <rect x="110" y="78" width="4" height="1.5" rx="0.75" fill="rgba(210,210,215,0.35)" transform="rotate(-30 112 79)"/>
    <circle cx="125" cy="72" r="0.8" fill="rgba(220,220,225,0.4)"/>
    <circle cx="200" cx="200" cy="80" r="30" fill="rgba(255,220,150,0.06)"/>
  </svg>`);

const ESPRESSO_IMG =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 192">
    <rect width="256" height="192" fill="#0e0e12"/>
    <rect x="30" y="20" width="196" height="152" rx="16" fill="rgba(20,20,30,0.8)" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    <path d="M100 50 L95 140 Q95 150 105 150 L145 150 Q155 150 155 140 L150 50Z" fill="rgba(10,10,15,0.9)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <ellipse cx="125" cy="58" rx="25" ry="5" fill="rgba(180,130,60,0.25)"/>
    <ellipse cx="125" cy="60" rx="20" ry="3" fill="rgba(200,150,70,0.2)"/>
    <ellipse cx="70" cy="120" rx="8" ry="5" fill="rgba(35,20,10,0.6)" transform="rotate(-25 70 120)"/>
    <line x1="67" y1="117" x2="73" y2="123" stroke="rgba(80,50,30,0.4)" stroke-width="0.8"/>
    <ellipse cx="180" cy="130" rx="7" ry="4.5" fill="rgba(35,20,10,0.5)" transform="rotate(30 180 130)"/>
    <line x1="177" y1="128" x2="183" y2="133" stroke="rgba(80,50,30,0.35)" stroke-width="0.8"/>
    <ellipse cx="85" cy="145" rx="6" ry="4" fill="rgba(30,18,8,0.45)" transform="rotate(-10 85 145)"/>
    <circle cx="200" cy="50" r="20" fill="rgba(200,210,220,0.03)"/>
  </svg>`);

const COLD_BREW_IMG =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 192">
    <rect width="256" height="192" fill="#0c0c14"/>
    <rect x="20" y="20" width="216" height="152" rx="16" fill="rgba(40,42,50,0.3)" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
    <rect x="95" y="40" width="50" height="110" rx="6" fill="rgba(180,140,80,0.08)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <defs><linearGradient id="amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(200,160,80,0.15)"/><stop offset="100%" stop-color="rgba(160,110,40,0.25)"/></linearGradient></defs>
    <rect x="96" y="50" width="48" height="95" rx="4" fill="url(#amber)"/>
    <circle cx="110" cy="70" r="1.5" fill="rgba(255,255,255,0.08)"/>
    <circle cx="125" cy="85" r="1" fill="rgba(255,255,255,0.06)"/>
    <circle cx="115" cy="100" r="1.8" fill="rgba(255,255,255,0.07)"/>
    <circle cx="130" cy="110" r="1.2" fill="rgba(255,255,255,0.05)"/>
    <circle cx="108" cy="120" r="1" fill="rgba(255,255,255,0.06)"/>
    <rect x="93" y="36" width="54" height="6" rx="3" fill="rgba(180,180,190,0.12)" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
    <rect x="95" y="90" width="50" height="8" rx="2" fill="rgba(200,210,220,0.06)"/>
    <rect x="108" y="55" width="12" height="12" rx="2" fill="rgba(200,210,220,0.04)" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
    <line x1="200" y1="60" x2="220" y2="80" stroke="rgba(255,255,255,0.02)" stroke-width="0.5"/>
    <line x1="210" y1="100" x2="230" y2="120" stroke="rgba(255,255,255,0.015)" stroke-width="0.5"/>
  </svg>`);

const MEMBERSHIP_IMG =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" rx="16" fill="#0e0e1a"/>
    <circle cx="100" cy="60" r="60" fill="rgba(180,150,100,0.06)"/>
    <circle cx="80" cy="140" r="40" fill="rgba(100,80,60,0.05)"/>
    <ellipse cx="90" cy="140" rx="35" ry="12" fill="rgba(255,255,255,0.02)"/>
    <path d="M60 110 Q60 80 90 70 Q120 80 120 110 L115 145 Q115 150 90 150 Q65 150 65 145Z" fill="rgba(40,40,55,0.4)"/>
    <rect x="82" y="115" width="16" height="20" rx="3" fill="rgba(25,25,35,0.6)" stroke="rgba(255,255,255,0.06)"/>
    <circle cx="90" cy="85" r="16" fill="rgba(50,50,65,0.35)"/>
    <circle cx="50" cy="50" r="4" fill="rgba(200,170,120,0.08)"/>
    <circle cx="150" cy="80" r="6" fill="rgba(200,170,120,0.05)"/>
    <circle cx="130" cy="160" r="8" fill="rgba(180,150,100,0.04)"/>
    <text x="100" y="180" text-anchor="middle" font-family="sans-serif" font-size="9" fill="rgba(200,210,220,0.15)" letter-spacing="2">EXCLUSIVE</text>
  </svg>`);

// ─── Types ──────────────────────────────────────────────────────────────────
interface MenuItem {
  id: string;
  nameVi: string;
  nameEn: string;
  price: number;
  image: string;
}

const FEATURED_ITEMS: MenuItem[] = [
  { id: 'silver-mocha', nameVi: 'Silver Mocha', nameEn: 'Silver Mocha', price: 8.5, image: MOCHA_IMG },
  { id: 'midnight-espresso', nameVi: 'Midnight Espresso', nameEn: 'Midnight Espresso', price: 6.0, image: ESPRESSO_IMG },
  { id: 'aura-cold-brew', nameVi: 'Aura Cold Brew', nameEn: 'Aura Cold Brew', price: 7.25, image: COLD_BREW_IMG },
];

interface NavItem {
  icon: string;
  label: string;
  labelEn: string;
  active: boolean;
  center?: boolean;
}

const BOTTOM_NAV: NavItem[] = [
  { icon: '\u{1F37C}', label: 'Home', labelEn: 'Home', active: true },
  { icon: '☕', label: 'Coffee', labelEn: 'Coffee', active: false },
  { icon: '\u{1F50D}', label: 'Scanner', labelEn: 'Scanner', active: false, center: true },
  { icon: '\u{1F6D2}', label: 'Cart', labelEn: 'Cart', active: false },
  { icon: '\u{1F464}', label: 'Profile', labelEn: 'Profile', active: false },
];

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE ORDERING 2 — AURA CAFE
// ═══════════════════════════════════════════════════════════════════════════
export default function MobileOrdering2() {
  const featuredRef = useRef<HTMLElement>(null);
  const membershipRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── IntersectionObserver for glass-card scroll reveal ─────────────────
  useEffect(() => {
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.15 });

    const observeSection = (el: HTMLElement | null) => {
      if (!el) return;
      el.querySelectorAll<HTMLElement>('.glass-card-reveal').forEach((card) => {
        observer.observe(card);
      });
    };

    observeSection(featuredRef.current);
    observeSection(membershipRef.current);

    return () => observer.disconnect();
  }, []);

  // ─── Carousel scroll helper ────────────────────────────────────────────
  const scrollCarousel = (dir: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--aura-noir-void)] text-[var(--aura-chrome-bright)] font-body overflow-x-hidden pb-28">

      {/*
        KEYFRAMES & MICRO-STYLES
        - Glass-card scroll reveal: opacity 0→1, translateY 20px→0, 0.6s cubic-bezier
        - Bottom nav active dot indicator
        - Carousel scrollbar hide
      */}
      <style>{`
        .glass-card-reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
                      transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .glass-card-reveal.revealed {
          opacity: 1;
          transform: translateY(0);
        }
        .glass-card-reveal.revealed:nth-child(2) { transition-delay: 100ms; }
        .glass-card-reveal.revealed:nth-child(3) { transition-delay: 200ms; }

        .nav-item--active { position: relative; }
        .nav-item--active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--aura-chrome-bright);
        }

        .carousel-scroll::-webkit-scrollbar { display: none; }
        .carousel-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/*
        ═══════════════════════════════════════════════
        SECTION 1 — Fixed Top Header
        ═══════════════════════════════════════════════
      */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/5 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-4">
        <button
          type="button"
          aria-label="Menu / Menu"
          className="flex items-center justify-center w-10 h-10 text-[var(--aura-chrome-bright)] hover:opacity-70 transition-opacity"
        >
          <span className="text-xl leading-none">{'\u{1F37C}'}</span>
        </button>

        <span className="font-body text-xs md:text-sm font-semibold tracking-[0.2em] uppercase text-[var(--aura-chrome-bright)] select-none">
          AURA CAFE
        </span>

        <button
          type="button"
          aria-label="Cart / Giỏ hàng"
          className="flex items-center justify-center w-10 h-10 text-[var(--aura-chrome-bright)] hover:opacity-70 transition-opacity relative"
        >
          <span className="text-xl leading-none">{'\u{1F6D2}'}</span>
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--aura-chrome-mid)]" />
        </button>
      </header>

      {/* Offset for fixed header */}
      <div className="h-16" />

      {/*
        ═══════════════════════════════════════════════
        SECTION 2 — Hero Banner
        ═══════════════════════════════════════════════
      */}
      <section className="relative h-[574px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMG})` }}
          aria-hidden="true"
        />

        <div className="absolute inset-0 bg-gradient-to-b from-[var(--aura-noir-void)] via-transparent to-transparent z-[1]" />

        {/* Carousel indicator tabs */}
        <div className="absolute top-6 left-0 right-0 z-10 flex gap-2 px-4 justify-center">
          {['Latte Art', 'Brewing Art', 'Cold Brew'].map((label, i) => (
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

      {/*
        ═══════════════════════════════════════════════
        SECTION 3 — Welcome
        ═══════════════════════════════════════════════
      */}
      <section className="px-6 pt-10 pb-4">
        <p className="font-display text-2xl md:text-3xl italic text-[var(--aura-chrome-bright)]">
          Good morning, <span className="text-[var(--aura-chrome-light)]">Julian</span>
        </p>
        <p className="font-body text-sm text-[var(--aura-text-body)] mt-2">
          Your ritual is waiting. / Nghi thức của bạn đã sẵn sàng.
        </p>
      </section>

      <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/*
        ═══════════════════════════════════════════════
        SECTION 4 — Featured Items Carousel
        ═══════════════════════════════════════════════
      */}
      <section ref={featuredRef} className="mt-8">
        <div className="flex items-center justify-between px-6 mb-4">
          <h2 className="font-body text-base font-semibold tracking-wide text-[var(--aura-chrome-bright)]">
            Featured Items
          </h2>
          <button
            type="button"
            className="font-body text-xs text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-light)] transition-colors tracking-wider uppercase"
          >
            See Menu &rarr;
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto carousel-scroll snap-x snap-mandatory px-6 pb-6 scroll-smooth"
          role="list"
          aria-label="Featured menu items"
        >
          {FEATURED_ITEMS.map((item) => (
            <article
              key={item.id}
              className="glass-card-reveal flex-shrink-0 w-64 glass-card rounded-xl snap-center overflow-hidden group"
              role="listitem"
            >
              <div className="relative h-48 overflow-hidden">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                  style={{ backgroundImage: `url(${item.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-deep)]/60 to-transparent" />
              </div>

              <div className="p-4">
                <h3 className="font-display text-lg italic text-[var(--aura-chrome-bright)] leading-snug">
                  {item.nameEn}
                </h3>
                <p className="font-body text-sm text-[var(--aura-chrome-mid)] mt-0.5">
                  {item.nameVi}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <span className="font-body text-sm font-semibold text-[var(--aura-chrome-light)]">
                    ${item.price.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Add ${item.nameEn} to cart`}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--aura-noir-deep)] text-sm font-bold hover:scale-110 active:scale-95 transition-transform"
                    style={{ background: 'linear-gradient(135deg, #E5E4E2, #C0C0C0)' }}
                  >
                    +
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="flex gap-2 px-6 -mt-2">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollCarousel(-1)}
            className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
          >
            &larr;
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollCarousel(1)}
            className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
          >
            &rarr;
          </button>
        </div>
      </section>

      {/*
        ═══════════════════════════════════════════════
        SECTION 5 — Aura Membership Bento Card
        ═══════════════════════════════════════════════
      */}
      <section ref={membershipRef} className="px-6 mt-6 mb-24">
        <div className="glass-card-reveal glass-card rounded-2xl p-6 relative overflow-hidden">
          <div
            className="absolute -top-16 -right-16 w-32 h-32 bg-[var(--aura-chrome-light)]/10 rounded-full blur-3xl -mr-16 -mt-16"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col sm:flex-row items-start gap-6">
            <div className="flex-1">
              <span className="font-body text-[10px] font-semibold tracking-[0.3em] uppercase text-[var(--aura-chrome-mid)]">
                AURA MEMBERSHIP / THÀNH VIÊN
              </span>

              <h3 className="font-display text-2xl md:text-3xl italic text-[var(--aura-chrome-bright)] mt-3 leading-snug">
                Elevate your<br />daily ritual.
              </h3>

              <p className="font-body text-sm text-[var(--aura-text-body)] mt-3 leading-relaxed max-w-xs">
                Unlock exclusive perks, early access, and rewards crafted for the discerning
                connoisseur. / Mở khóa đặc quyền, truy cập sớm, và phần thưởng dành cho người sành điệu.
              </p>

              <button
                type="button"
                className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-body font-semibold uppercase tracking-widest text-[var(--aura-noir-deep)] hover:scale-[1.03] active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #E5E4E2, #C0C0C0)' }}
              >
                Discover More / Khám Phá
              </button>
            </div>

            <div className="w-full sm:w-1/2 aspect-square sm:aspect-auto sm:h-40 rounded-xl overflow-hidden flex-shrink-0">
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${MEMBERSHIP_IMG})` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/*
        ═══════════════════════════════════════════════
        SECTION 6 — Fixed Bottom Navigation
        ═══════════════════════════════════════════════
      */}
      <nav
        className="fixed bottom-6 left-6 right-6 z-50 h-20 rounded-full bg-white/5 backdrop-blur-2xl border border-white/15 flex items-center justify-around px-2"
        aria-label="Main navigation"
      >
        {BOTTOM_NAV.map((item) => {
          if (item.center) {
            return (
              <button
                key={item.label}
                type="button"
                aria-label={item.label}
                className="relative -mt-8 w-12 h-12 rounded-full flex items-center justify-center text-[var(--aura-noir-deep)] text-lg shadow-lg hover:scale-110 active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #E5E4E2, #C0C0C0)' }}
              >
                {item.icon}
              </button>
            );
          }

          return (
            <button
              key={item.label}
              type="button"
              aria-label={`${item.label} / ${item.labelEn}`}
              aria-current={item.active ? 'page' : undefined}
              className={`nav-item--active flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium tracking-wider uppercase transition-colors ${
                item.active
                  ? 'text-[var(--aura-chrome-bright)]'
                  : 'text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-light)]'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
