import { useState } from 'react';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';
import { FEATURES, MENU_ITEMS } from './luxury-cafe-2-constants';

type ScrollRevealProps = {
  revealed: Set<number>;
  setRef: (i: number, el: HTMLElement | null) => void;
};

/* ── StitchShell wrapper ────────────────────────────────────────────── */

export function StitchShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--aura-noir-void)] text-[var(--aura-chrome-bright)] font-body overflow-x-hidden">
      {children}
    </div>
  );
}

/* ── Nav ────────────────────────────────────────────────────────────── */

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <PageHeader brand="AURA CAFE" scrollEffect />
  );
}

/* ── Hero ───────────────────────────────────────────────────────────── */

export function Hero() {
  return (
    <section className="relative min-h-[921px] flex items-center px-5 md:px-16 py-32 max-w-[1280px] mx-auto overflow-hidden">
      <div className="grid grid-cols-12 w-full gap-8 z-10">
        <div className="col-span-12 md:col-span-8 flex flex-col justify-center space-y-8">
          <div className="space-y-2">
            <span className="font-body text-xs uppercase tracking-[0.2em] text-[var(--aura-chrome-bright)]">
              Premium Specialty Coffee
            </span>
            <h1 className="font-display text-[64px] md:text-[64px] leading-tight tracking-tighter">
              AURA CAFE — <br />
              <span className="text-[var(--aura-chrome-bright)] italic">Container Caffe &amp; Space</span>
            </h1>
          </div>
          <p className="font-body text-lg leading-relaxed text-[var(--aura-chrome-mid)] max-w-xl">
            An avant-garde architectural sanctuary in Sa Dec, Vietnam. Experience the intersection of industrial precision and nocturnal luxury through our curated brews.
          </p>
          <div className="flex flex-wrap gap-4">
            <button className="bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] px-8 py-4 font-body text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all duration-500 active:scale-95 shadow-xl">
              Book a Table
            </button>
            <button className="border border-[rgba(198,198,199,0.3)] px-8 py-4 font-body text-xs font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)] hover:bg-white/5 transition-all duration-500 active:scale-95">
              View Gallery
            </button>
          </div>
        </div>
      </div>
      <div className="absolute right-0 top-0 w-1/2 h-full -z-10 opacity-60 bg-gradient-to-l from-[var(--aura-noir-deep)] to-transparent" />
    </section>
  );
}

/* ── Features Bento ─────────────────────────────────────────────────── */

export function Features({ revealed, setRef }: ScrollRevealProps) {
  return (
    <section
      ref={(el) => setRef(1, el)}
      className={`py-32 px-5 md:px-16 max-w-[1280px] mx-auto transition-all duration-1000 ${
        revealed.has(1) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="mb-16">
        <h2 className="font-display text-2xl md:text-[32px] text-[var(--aura-chrome-bright)] mb-4">
          The Container Aesthetic
        </h2>
        <div className="h-px w-24 bg-[var(--aura-chrome-bright)]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {FEATURES.map((f) => (
          <div
            key={f.heading}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 flex flex-col space-y-6 transition-all duration-500 hover:-translate-y-2 group"
          >
            <span className="text-4xl">{f.emoji}</span>
            <h3 className="font-display text-xl md:text-[24px] text-[var(--aura-chrome-bright)]">{f.heading}</h3>
            <p className="font-body text-base text-[var(--aura-chrome-mid)] leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Atmosphere ─────────────────────────────────────────────────────── */

export function Atmosphere({ revealed, setRef }: ScrollRevealProps) {
  return (
    <section
      ref={(el) => setRef(2, el)}
      className={`relative py-40 overflow-hidden transition-all duration-1000 ${
        revealed.has(2) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="absolute inset-0 z-0">
        <div
          className="w-full h-full bg-cover bg-fixed bg-center"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAs-j2Bs-ZKR94AwJJOXlEEcYcKrWo4SQbA9uu90c26nJ3JdaxSh5XVA4jIMiwR0YNlzVSaoVA70eEWhyTLCRItlpHBJp_Uss3xbqHhJWadWqwgIh0xBK9Fs0cB1eWFgjrjhkhuLQ7OPiuHleH7Bco-Rlf2dZzS2kF3QGvfr4OEGwTfLwxBa23tIOZ5xqQH2cJye5KS56kKqcSe_HXE-KIdAh3egsZpfIWeRNbhpZY9wP320ScttzefwxkPmkjNCyfiGv3dlONbiHM')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--aura-noir-void)] via-[var(--aura-noir-void)]/60 to-transparent" />
      </div>
      <div className="relative z-10 px-5 md:px-16 max-w-[1280px] mx-auto">
        <div className="max-w-xl space-y-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-12">
          <h2 className="font-display text-3xl md:text-[40px] text-[var(--aura-chrome-bright)]">
            A Symphony of Steel &amp; Shadow
          </h2>
          <p className="font-body text-lg text-[var(--aura-chrome-bright)] leading-relaxed italic">
            &ldquo;The atmosphere at Aura isn&rsquo;t just about the coffee; it&rsquo;s about the deliberate tension between raw industrial materials and refined luxury comforts.&rdquo;
          </p>
          <div className="flex items-center gap-4">
            <div className="h-px w-12 bg-[var(--aura-chrome-mid)]" />
            <span className="font-body text-xs uppercase tracking-widest text-[var(--aura-chrome-mid)]">Architectural Digest</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Menu Teaser ────────────────────────────────────────────────────── */

export function MenuTeaser({ revealed, setRef }: ScrollRevealProps) {
  return (
    <section
      ref={(el) => setRef(3, el)}
      className={`py-32 px-5 md:px-16 max-w-[1280px] mx-auto transition-all duration-1000 ${
        revealed.has(3) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="grid grid-cols-12 gap-8 items-center">
        <div className="col-span-12 md:col-span-6 space-y-12">
          <div>
            <h2 className="font-display text-2xl md:text-[32px] text-[var(--aura-chrome-bright)] mb-6">Signature Selection</h2>
            <p className="font-body text-base text-[var(--aura-chrome-mid)]">
              Our menu is a technical specification of flavor, balancing acidity and body with architectural balance.
            </p>
          </div>
          <ul className="space-y-6">
            {MENU_ITEMS.map((item) => (
              <li key={item.name} className="flex justify-between items-end border-b border-[rgba(198,198,199,0.3)] pb-4 group">
                <div className="space-y-1">
                  <span className="font-body text-xs uppercase tracking-widest text-[var(--aura-chrome-bright)]">{item.name}</span>
                  <p className="text-sm text-[var(--aura-chrome-mid)]">{item.desc}</p>
                </div>
                <span className="font-body text-sm text-[var(--aura-chrome-bright)]">{item.price}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-12 md:col-span-6 h-[500px] relative overflow-hidden rounded-[40px]">
          <img
            className="w-full h-full object-cover rounded-[40px]"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDaoDbpEz_9buFiuoAiGaboZBYS98h_vTkxXdaX2E_Vx9YcJQUlCMJUGvLBMs6m37fG3_jvw48erczGoz-5L7jVr3V5H_pzpM6OJwZEgF5pd_fQxxc1vryfQQbqDMFl9p0C9CdbsDqrGmLnRvvVA9usTkW4CK0KEoqHEGWHkFScgt6dR-bzRlQHHrCAMpSe5cbIgw8F-e3_fPje9rOFSHaS6Sle0jIpTCxONV4KmYwAlEvckxwMYyyoNhmreQ2t7DayDLSlCmqqgvM"
            alt="Signature latte art on a minimalist glass cup"
            loading="lazy"
          />
          <div className="absolute inset-0 border border-[var(--aura-chrome-bright)]/20 m-4 rounded-[32px] pointer-events-none" />
        </div>
      </div>
    </section>
  );
}

/* ── Footer ─────────────────────────────────────────────────────────── */

export function Footer() {
  return (
    <PageFooter
      brand="AURA CAFE"
      socialLinks={["IG", "FB", "TT"].map(s => ({ label: s }))}
      socialSize="sm"
      copyLine="© 2024 AURA CAFE. ALL RIGHTS RESERVED."
    />
  );
}
