import { useState, type ReactNode } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

/* ── Types ────────────────────────────────────────────────────────────── */

interface MenuItem {
  title: string;
  subtitle: string;
  price: string;
  image: string;
  imageAlt: string;
  tag?: string;
  metric: { label: string; value: string; pct: number };
}

interface FilterBtn {
  label: string;
  active?: boolean;
}

/* ── Data ────────────────────────────────────────────────────────────── */

const FILTERS: readonly FilterBtn[] = [
  { label: 'All', active: true },
  { label: 'Coffee' },
  { label: 'Tea' },
  { label: 'Signature' },
  { label: 'Cold Brew' },
] as const;

const MENU_ITEMS: readonly MenuItem[] = [
  {
    title: 'Midnight Espresso',
    subtitle: 'Double-shot ristretto, obsidian blend with notes of dark chocolate and smoke.',
    price: '$6.50',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAH_VFxx9-rRwx9wKNjbdcE9OuRiR9kDf1V2bTaWpz-_0fy20-jgs3SmIdl91KadKd7TElUeHnrtds6pHlCuoKWxTJ1qCY6KYsPQZewSIp5je_f7fQg4pSAjkq575Jd6KBZg5X0aapGoKI23yGGWVu1SsGSL_oKw50RhfstBdM5TUfjx964Bv1-3eZXzTE31Es9HTQJxg2t97iwic_fTRs3ymuAuLx_gOoznl0JPLigyw_JDQN-DrbTkDOsxMOpwr4DEE_kyUJwkTk',
    imageAlt: 'Moody high-contrast photograph of a dark espresso shot poured into an obsidian ceramic cup. Golden crema bubbles on top. Dark industrial coffee bar with chrome accents and dim warm lighting. Deep navy and bronze tones.',
    tag: 'Featured',
    metric: { label: 'Intensity', value: '9/10', pct: 90 },
  },
  {
    title: 'Chrome Velvet Latte',
    subtitle: 'Charcoal-infused micro-foam, Madagascar vanilla, and velvet-texture espresso.',
    price: '$8.00',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBjmO2eXJjE_CpfiM0km0Psm-VRxYA53RVBLdx9qk4OUDkxbIb3VRdTkbf7NJlOTPWVSjp_rTYy8DzHDY__I-8XpoM-Q-6xVaWsxfkbYVPwKXc_qPrf7qWRg3ioNZhSDwVG-yFf3SsP_9O9qaFlLxf1GWxDaK7Lyr9MwE4v4znAvIEFya7LRoW9J38OL0rrRuJTQG_4cY57eiSpOn4VMIW-kPa-KgJv4c55tETRE4VtHTxmyJnyjdH7fbAfGjFcPWpHX9bUClOou8A',
    imageAlt: 'Sophisticated latte in a clear glass cup showing distinct layers of charcoal-infused grey milk and rich espresso. Foam decorated with geometric patterns. Polished stainless steel surface reflecting soft blue and silver light.',
    metric: { label: 'Sweetness', value: '4/10', pct: 40 },
  },
  {
    title: 'Industrial Cold Brew',
    subtitle: '24-hour slow drip through stainless steel filtration. Served over a single crystal sphere.',
    price: '$7.50',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcW7CnosOOxUDF7437ZlimM-6RQJM-nD_RTJIikhjtT_roMitVCtmIYLSG4TGUsr-MiKrV7rje1xtFlBXt3EFKn6PE9iUnUMntjpewI7-MncuEa7UhqT-iYYc5tekYIHbbz_D1gwPoRXj_N8tCEW25FAHRMjErhqLnjunRe4eyq1Px0t-ZFdweX7kCOjA4TYuAEbGTaq4uKwJ-FYqO-KD5PHxR_T8uSWfcZdGrxqR_hHH6n1ZKzjCkCxTvBZ93GAqNfexmt9-MGV0',
    imageAlt: 'Minimalist glass carafe filled with deep amber cold brew next to a glass with a large clear ice sphere. Laboratory-like environment with brushed aluminum textures. Cool navy and silver palette.',
    metric: { label: 'Caffeine', value: '10/10', pct: 100 },
  },
  {
    title: 'Bronze Chai',
    subtitle: 'Hand-ground spices, local wild honey, and premium black tea steeped for 8 minutes.',
    price: '$7.00',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbcnOjmzq8ALq92TrWmO1IpO4-oztDnTnOizeMvgeS0U5O4Pr4NkLSMrzlTv-E-dAgD3JshDmPr3msUZeD6AttX_XHeP3Vjv6_Bk1FBEbVRZggvNEyHKrs3iTidEUa4LMYIzqIvQmTCd-ISxr-IUSrGE6D66VNINa9tQztBLhJ2RwT3xN_YAKcR9_rUzYUH9QyHexApzLN7NcGlUfHctM20sDs5q1h93P35z7i9NPD82Rvo85yjHuJ6BVrdG2S_v7feu6SqlNzxQc',
    imageAlt: 'Warm atmospheric shot of a creamy chai latte in a rustic refined bronze-colored mug. Steam rises in elegant curls. Hand-ground spices scattered on a dark slate surface. Rich brown, gold, deep navy tones.',
    metric: { label: 'Spice Level', value: '7/10', pct: 70 },
  },
] as const;

const NAV_LINKS = [
  { label: 'Menu', href: '#menu' },
  { label: 'Reservation', href: '#reservation' },
  { label: 'Location', href: '#location' },
  { label: 'About', href: '#about' },
] as const;

/* ── Styles (CSS-variable-driven, matching StitchBase palette) ─────────── */

const S = {
  gaugeBg: { height: 2, background: 'rgba(229,228,226,0.1)' } as const,
  gaugeFill: (pct: number) => ({
    height: 2,
    width: `${pct}%`,
    background: '#CD7F32' as const,
    boxShadow: '0 0 8px #CD7F32' as const,
  }),
  chromeBtn: {
    background: 'linear-gradient(135deg, #E5E4E2 0%, #BCC6CC 100%)',
  },
  glassPanel:
    'bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px]',
};

/* ── Components ───────────────────────────────────────────────────────── */

function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-[var(--aura-noir-deep)]/80 backdrop-blur-xl border-b border-white/10">
      <div className="flex justify-between items-center w-full px-4 md:px-16 py-4 max-w-7xl mx-auto">
        {/* Brand */}
        <span className="font-display text-lg md:text-xl text-[var(--aura-chrome-bright)] tracking-widest uppercase">
          AURA CAFE
        </span>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Mobile burger */}
          <button
            className="md:hidden text-[var(--aura-chrome-mid)]"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
          <button
            className="bg-[var(--aura-noir-deep)] text-[var(--aura-tertiary)] border border-[var(--aura-border-chrome)]/40 px-6 py-2 font-body text-xs font-semibold uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all"
          >
            Reservation
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden flex flex-col gap-4 px-5 pb-6 bg-[var(--aura-noir-deep)]/95 backdrop-blur-xl border-t border-white/10">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="font-body text-sm text-[var(--aura-chrome-mid)] uppercase tracking-wider"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}

function MenuCard({ item }: { item: (typeof MENU_ITEMS)[number] }) {
  return (
    <div
      className={`${S.glassPanel} group flex flex-col h-full relative overflow-hidden`}
    >
      {/* Featured tag */}
      {item.tag && (
        <div className="absolute top-4 left-4 z-10">
          <span className="px-3 py-1 bg-[var(--aura-tertiary)] text-[var(--aura-noir-void)] font-body text-[10px] tracking-widest uppercase font-semibold">
            {item.tag}
          </span>
        </div>
      )}

      {/* Image */}
      <div className="aspect-[4/5] overflow-hidden">
        <img
          className="w-full h-full object-cover grayscale-[0.3] group-hover:scale-105 transition-transform duration-700"
          alt={item.imageAlt}
          src={item.image}
          loading="lazy"
        />
      </div>

      {/* Body */}
      <div className="p-8 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2 gap-2">
          <h3 className="font-display text-xl leading-snug">{item.title}</h3>
          <span className="font-body text-sm text-[var(--aura-chrome-mid)] whitespace-nowrap">
            {item.price}
          </span>
        </div>

        <p className="font-body text-base text-[var(--aura-chrome-dark)] mb-6 flex-grow leading-relaxed">
          {item.subtitle}
        </p>

        {/* Gauge */}
        <div className="mb-6">
          <div className="flex justify-between text-[10px] font-body uppercase tracking-widest text-[var(--aura-chrome-dark)] mb-2">
            <span>{item.metric.label}</span>
            <span>{item.metric.value}</span>
          </div>
          <div style={S.gaugeBg}>
            <div style={S.gaugeFill(item.metric.pct)} />
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          className="w-full py-3 text-[var(--aura-noir-deep)] font-body text-xs font-semibold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all rounded-sm"
          style={S.chromeBtn}
        >
          Add to Order
        </button>
      </div>
    </div>
  );
}

function CraftSection() {
  return (
    <section className="mt-32 max-w-7xl mx-auto">
      <div className={`${S.glassPanel} p-8 md:p-16 lg:p-24 relative overflow-hidden`}>
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

function Footer() {
  return (
<PageFooter
  brand="AURA CAFE"
  socialSize="sm"
  />
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function DigitalMenu2() {
  const [activeFilter, setActiveFilter] = useState(0);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null
  );

  const handleMouseMove = (
    e: React.MouseEvent<HTMLElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    if (px > 0 && px < 1 && py > 0 && py < 1) {
      setMousePos({ x: px, y: py });
    }
  };

  const handleMouseLeave = () => setMousePos(null);

  const panelShadow = mousePos
    ? `inset ${((mousePos.x - 0.5) * 10).toFixed(2)}px ${((mousePos.y - 0.5) * 10).toFixed(2)}px 30px rgba(205,127,50,0.05)`
    : 'none';

  return (
    <StitchShell>
      <Nav />

      <main className="pt-32 pb-24 px-4 md:px-16 max-w-7xl mx-auto min-h-screen">
        {/* Hero / Filters */}
        <section id="menu">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
            <div>
              <span className="font-body text-xs text-[var(--aura-tertiary)] uppercase tracking-[0.4em] block mb-4">
                Atmospheric Brewing
              </span>
              <h1 className="font-display text-4xl md:text-6xl leading-tight">
                The Digital Reserve
              </h1>
            </div>

            {/* Filter pills — 4-column on md, wrapping */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {FILTERS.map((f, i) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setActiveFilter(i)}
                  className={`px-5 py-2.5 font-body text-xs uppercase tracking-widest transition-all rounded-sm ${
                    i === activeFilter
                      ? 'bg-[rgba(205,127,50,0.2)] border border-[var(--aura-tertiary)]/60 text-[var(--aura-tertiary)]'
                      : 'border border-white/10 text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] hover:border-white/20'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="w-full h-px mb-16"
            style={{ background: 'rgba(229,228,226,0.2)' }}
          />
        </section>

        {/* Menu Grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {MENU_ITEMS.map((item) => (
            <MenuCard key={item.title} item={item} />
          ))}
        </div>

        {/* Craft Section */}
        <CraftSection />
      </main>

      <Footer />
    </StitchShell>
  );
}
