import { useState, useEffect, type ReactNode } from 'react';
import { StitchShell, StitchNav } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

/* ── Menu items ─────────────────────────────────────────────────── */
const MENU_ITEMS = [
  {
    name: 'Aura Black',
    desc: 'Double Ristretto + Dark Truffle',
    price: '$12',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDp4XjinRclf8CqNnLmIYewjeHbcjniV5nJGvxoD2IjrlUbmkrMcDC_ONgYpcefGbGkMdlu2L4_UqAXjPyez25KFnXUE9J_IY16PganHo5aQ-fIN4adFW5hg3qRq3olg3BCvt8e2JMw55xa1TRDKCVHel6KyODuNzsV9-0uYYZR-c21TyiUrtRkzSSfzWNQBPuHgpQeAibKB0Yy4pCJdLqIExztWIOq3ZSKhKWsJ4bfw3yeK_5l934xHQ9J0JUwEorAHNNnESrw_Go',
    alt: 'A top-down artistic photograph of a premium espresso served in a handcrafted ceramic matte black cup. Beside it sits a single dark chocolate truffle with a dust of edible gold leaf. The composition is set on a brushed metal surface with subtle reflections of blue neon light, embodying the industrial luxury brand aesthetic.',
  },
  {
    name: 'Midnight Cold',
    desc: 'Nitrogen Infused + Botanical Hint',
    price: '$14',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUzS7x7cFXOR5vzWdE_sSz2STpDN5tNUhDp9WBaIkJ7OpLNpl_ScnMKMmUcvpYc_0LdudBNyGyAJ7r3fVFjVdLjfLDDq4Cg9EO8tgbuZxfMAVCUAXFykHWzPL68JAXnbdCg2tm9rdW7iVavzyYdxEILW-5QfgQ_M2uOOuTd2ZteQHCJI_iAQK8HZ_hQsd7oK_WoWIY5I1yzWiOIyXm1QLIr8E_OKMzNasmpOsiL-oO4exyXNvFrRVPlYKye2ZkGOnom5ONrV2VQx4',
    alt: 'A sophisticated cold brew coffee cocktail served in a tall glass with a single oversized clear ice cube. A sprig of dried lavender and a thin strip of orange zest garnish the drink. The background shows the blurred industrial textures of a container cafe with subtle bronze lighting, highlighting the premium nocturnal vibe.',
  },
  {
    name: 'Chrome Velvet',
    desc: 'Smoked Vanilla + Oat Silk',
    price: '$11',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAlc7BYI9NI0PGTmim_5GHC-P_uKaVfNMXUPfsNaXXLQYoqqeRPHA-fMzA32yhTH41h_sMNFkL0gTjPJewjllQw3Inyy3HEZMxPVxMLw2AP0S1Vd-140Tsr8vG6bKu6XREidhYfDlgWetla_Au3nEXBWaSw40-Pci30e-gGXtBMO7VzD4Z-fOy6U0OyN03XE1hYacQT3bmVGS-vjyPFzmEO2eqClIWqLmffgOHNAzW-q_qTv9qz5ORsM7vLFHnbFDOEHAAPLQySrwo',
    alt: 'A minimalist presentation of a smoked vanilla latte in a clear heat-resistant glass. A faint swirl of steam rises from the cup, and a small cinnamon stick rests on a chrome saucer. The scene is lit by a warm bronze glow from the side, creating long elegant shadows against a navy blue backdrop.',
  },
] as const;

const LOUNGE_FEATURES = [
  { num: '01', title: 'Curated Soundscapes', desc: 'Deep ambient and minimalist electronic beats.' },
  { num: '02', title: 'Artisanal Brews', desc: 'Single-origin beans roasted specifically for evening consumption.' },
] as const;

/* ── Scroll-reveal hook ─────────────────────────────────────────── */
function useReveal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      const panels = document.querySelectorAll('[data-reveal]');
      panels.forEach((panel) => {
        const rect = panel.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.8) {
          (panel as HTMLElement).style.opacity = '1';
          (panel as HTMLElement).style.transform = 'translateY(0)';
        }
      });
    };

    // Initial hidden state
    document.querySelectorAll('[data-reveal]').forEach((panel) => {
      (panel as HTMLElement).style.opacity = '0';
      (panel as HTMLElement).style.transform = 'translateY(20px)';
      (panel as HTMLElement).style.transition = 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)';
    });

    window.addEventListener('scroll', handler, { passive: true });
    window.dispatchEvent(new Event('scroll'));

    return () => window.removeEventListener('scroll', handler);
  }, []);

  return visible;
}

/* ── Sub-components ──────────────────────────────────────────────── */
function Nav() {
  return (
    <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-5 md:px-16 py-4 bg-white/5 backdrop-blur-xl border-b border-[var(--aura-border-chrome)]/30">
      <span className="font-display text-lg md:text-xl text-[var(--aura-chrome-bright)] tracking-widest uppercase">
        AURA CAFE
      </span>
      <div className="hidden md:flex items-center gap-10">
        <a className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors" href="#aesthetic">
          Container
        </a>
        <a className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors" href="#lounge">
          Experience
        </a>
        <a className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors" href="#menu">
          Menu
        </a>
      </div>
      <button className="bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-6 py-2 font-body text-xs font-semibold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
        Reservation
      </button>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative h-screen flex items-center justify-center pt-20 overflow-hidden">
      <div className="relative z-10 text-center px-5 md:px-16 max-w-4xl">
        <span className="font-body text-sm text-[var(--aura-tertiary)] tracking-[0.3em] uppercase mb-6 block">
          Industrial Luxury
        </span>
        <h1 className="font-display text-5xl md:text-7xl leading-tight text-[var(--aura-chrome-bright)] mb-6">
          AURA CAFE —
          <br />
          <span className="italic font-normal">Container Caffe &amp; Space</span>
        </h1>
        <p className="font-body text-lg text-[var(--aura-chrome-variant)] max-w-2xl mx-auto mb-10 leading-relaxed">
          Experience the intersection of raw industrial aesthetics and premium nocturnal comfort.
          Our shipping container architecture creates an exclusive haven for the sophisticated coffee connoisseur.
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
          <button className="bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-10 py-3 font-body text-xs font-semibold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
            Explore the Menu
          </button>
          <button className="border border-[var(--aura-chrome-mid)]/30 text-[var(--aura-chrome-mid)] px-10 py-3 font-body text-xs uppercase tracking-widest hover:bg-[var(--aura-chrome-mid)]/10 transition-all">
            View Space
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-60">
        <span className="font-body text-xs text-[var(--aura-chrome-mid)] uppercase tracking-widest">Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-[var(--aura-chrome-mid)] to-transparent" />
      </div>
    </section>
  );
}

function AestheticSection() {
  return (
    <section className="space-y-6" id="aesthetic">
      <div data-reveal>
        <h2 className="font-display text-4xl md:text-5xl text-[var(--aura-chrome-bright)]">The Container Aesthetic</h2>
        <div className="w-24 h-px bg-[var(--aura-tertiary)] mt-4" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* Main feature card */}
        <div
          data-reveal
          className="md:col-span-7 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 flex flex-col justify-between group"
        >
          <div>
            <h3 className="font-display text-2xl md:text-3xl text-[var(--aura-tertiary)] mb-4 italic">
              Industrial Luxury Redefined
            </h3>
            <p className="font-body text-base text-[var(--aura-chrome-variant)] leading-relaxed">
              Constructed from repurposed high-cube shipping containers, our architecture celebrates
              the raw beauty of structural steel, softened by curated textures and ambient lighting.
              Each seam tells a story of global travel, now anchored in a premium urban setting.
            </p>
          </div>
          <div className="mt-8 relative overflow-hidden rounded-2xl aspect-video">
            <div className="absolute inset-0 bg-white/5 z-10 opacity-20 pointer-events-none backdrop-blur-xl" />
            <img
              className="w-full h-full object-cover grayscale-[0.5] group-hover:scale-110 transition-transform duration-700"
              data-alt="A cinematic architectural shot of a sleek black shipping container cafe at night. The structure features floor-to-ceiling frosted glass panels that emit a soft blue glow. Polished bronze accents and industrial chrome beams are visible under dramatic spotlighting. The surrounding environment is a minimalist dark navy urban plaza, creating a high-end industrial luxury atmosphere."
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBsJ-aUIE708Rnn2voLZkj1EFSTKYm9uFUUsl4N8kkRvw0mUK2olfYxBo-dx3uuGmzr9Xbj65PpNiXX0qfIpjNj1pq6PMnY2wxKt3DZfqSENNPEwFwR51It_t46VXSlUL-LrfH-Mbui8y4QoLjmgREQQyp_1fwSZy8F-Wubv5T1C51YF_V2edIcW_VmwQOuqLsY_d5b5VsbqhzXau3kfE46n7Wgn4SAY-1dov0z-6Fa3Tvm5f_YVukHL82ZefgiIPbEDjZxYbCkmdk"
            />
          </div>
        </div>

        {/* Detail cards */}
        <div className="md:col-span-5 flex flex-col gap-6">
          <div data-reveal className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-6 flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[var(--aura-tertiary)]" role="img" aria-label="layers">📐</span>
              <h4 className="font-body text-sm uppercase text-[var(--aura-chrome-mid)] tracking-widest">
                Frosted Glass Modules
              </h4>
            </div>
            <p className="font-body text-base text-[var(--aura-chrome-variant)]">
              Translucent panels provide privacy while diffusing the nocturnal urban glow,
              creating an ethereal inner sanctum.
            </p>
          </div>

          <div
            data-reveal
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-6 flex-1 border-l-4 border-l-[var(--aura-tertiary)]"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[var(--aura-tertiary)]" role="img" aria-label="precision">⚙️</span>
              <h4 className="font-body text-sm uppercase text-[var(--aura-chrome-mid)] tracking-widest">
                Chrome &amp; Bronze
              </h4>
              <div className="w-2 h-2 rounded-full bg-[var(--aura-tertiary)] animate-pulse shadow-[0_0_8px_#efbd8a]" />
            </div>
            <p className="font-body text-base text-[var(--aura-chrome-variant)]">
              Metallic accents provide a sharp contrast to the matte navy finishes,
              reflecting the precision of modern design.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoungeSection() {
  return (
    <section className="py-20" id="lounge">
      <div
        data-reveal
        className="bg-[rgba(25,45,75,0.8)] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col md:flex-row"
      >
        {/* Image side */}
        <div className="md:w-1/2 h-[500px] relative">
          <img
            className="w-full h-full object-cover"
            data-alt="A moody interior view of a premium nocturnal lounge inside an industrial container space. The lighting is low and sophisticated, with warm bronze desk lamps and subtle blue neon strips under the bar. Patrons are blurred in the background, enjoying artisanal coffee at marble tables. The walls are corrugated dark metal, polished to a soft sheen, reflecting the exclusive and calm atmosphere."
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvEFA1n0gDJ7sY-7Kf08hzbSpUGSfNrJaB4u1K95Kd3SxOsBa8XqPdqOh5YFdoL24nY_UnuSGW0UIal6mxwS1EsohB4InWFDMvbaHx1VSHzFTlgQ5shAyGEXnc5dfQN_E_p-0td8GKICCe5jihht0-pKTrxDg-1jXyLytANRaea1_TQZJwUMuDSvhHgGnMFHW2YLoXz4FTQ0HAUcBDNXLHR3A_4Q1B6UOSESHqI5jPZ7plyVt_-SyBl7BKSNS1nEG7FdQ7Psa3eNM"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[var(--aura-noir-deep)]" />
        </div>

        {/* Content side */}
        <div className="md:w-1/2 p-10 md:p-16 flex flex-col justify-center">
          <span className="font-body text-sm text-[var(--aura-tertiary)] uppercase tracking-[0.2em] mb-3">
            The Experience
          </span>
          <h2 className="font-display text-4xl md:text-5xl text-[var(--aura-chrome-bright)] mb-6">
            Nocturnal Lounge
          </h2>
          <p className="font-body text-lg text-[var(--aura-chrome-variant)] mb-10 leading-relaxed">
            When the sun sets, Aura Cafe transforms. The atmosphere shifts to a sophisticated
            nocturnal lounge where shadows and light play across metallic surfaces. It&rsquo;s
            a space for deep conversation, focused work, or solitary reflection.
          </p>

          <div className="space-y-6">
            {LOUNGE_FEATURES.map((f) => (
              <div key={f.num} className="flex items-start gap-5 pb-6 border-b border-[rgba(198,198,199,0.4)] last:border-0">
                <span className="font-display text-xl text-[var(--aura-tertiary)] italic">{f.num}</span>
                <div>
                  <h5 className="font-body text-sm uppercase text-[var(--aura-chrome-bright)] tracking-widest mb-1">
                    {f.title}
                  </h5>
                  <p className="font-body text-base text-[var(--aura-chrome-variant)]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MenuSection() {
  return (
    <section className="space-y-6" id="menu">
      <div data-reveal className="text-center">
        <h2 className="font-display text-4xl md:text-5xl text-[var(--aura-chrome-bright)]">Evening Selections</h2>
        <p className="font-body text-sm text-[var(--aura-chrome-mid)] tracking-widest uppercase mt-2">
          Signature Pairings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MENU_ITEMS.map((item) => (
          <div
            key={item.name}
            data-reveal
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-6 group cursor-pointer hover:border-[var(--aura-tertiary)]/50 transition-colors"
          >
            <div className="aspect-square bg-[var(--aura-noir-deep)] mb-5 overflow-hidden rounded-2xl">
              <img
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                data-alt={item.alt}
                src={item.img}
              />
            </div>
            <div className="flex justify-between items-end">
              <div>
                <h4 className="font-display text-xl text-[var(--aura-chrome-bright)]">{item.name}</h4>
                <p className="font-body text-sm text-[var(--aura-tertiary)]">{item.desc}</p>
              </div>
              <span className="font-body text-base text-[var(--aura-chrome-bright)]">{item.price}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
<PageFooter
  brand="AURA CAFE"
  socialLinks={["IG", "FB", "TT"].map(s => ({ label: s }))}
  socialSize="sm"
  />
  );
}

/* ── Main exported page ──────────────────────────────────────────── */
export default function LuxuryContainerCafe1() {
  useReveal();

  return (
    <StitchShell>
      <StitchNav ctaLabel="Reservation" />
      <Nav />
      <HeroSection />
      <main className="max-w-[1200px] mx-auto px-5 md:px-16 py-20 space-y-20">
        <AestheticSection />
        <LoungeSection />
        <MenuSection />
      </main>
      <Footer />
    </StitchShell>
  );
}
