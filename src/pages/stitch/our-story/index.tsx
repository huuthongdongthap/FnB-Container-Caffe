/* ── Stitch: aura_cafe_our_story ───────────────────────────────────── */
/* Source: stitch_aura_cafe/aura_cafe_our_story/code.html (first 400 lines) */
/* The source file is larger than what was read; the component captures */
/* the structure from the first portion (360 lines total, all sections). */

'use client';

import { useEffect, useState } from 'react';
import { StitchShell, StitchNav } from '../StitchBase';

/* ─── Data ─────────────────────────────────────────────────────────── */

const TIMELINE = [
  {
    phase: 'PHASE 01: 2022',
    title: 'The Concept Blueprint',
    desc: 'Initial visioning of a cafe that exists at the intersection of container architecture and technical brewing precision.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDrhST6weshnMyYXw_5Rn-ORCRUIsoDhbpt4ajVNC7rffHA7Ygn2Lpa6AvG4KEuHwCqsSAEeeXovAV2kvEOJVctf2y3oKYBKE3mSnN9kti5v0Y5bjMx7-cUNU8j6uBXF8SQFINn5nnN1uEv0-2r8_VKIWVen676wqEQwPLD3O1XQftQ-ZC6qbCN7BS2ejgf7UYM5aY4r-Qft1c6Y8dcrXqOClP6hxQ2bXEl0kNiy5wulHktiPGAbZzf1SyVlodxcRjyu3dp56PIh6Y',
    alt: 'Technical architectural drawings of a shipping container cafe layout on a dark metal desk with chrome pens and a matte black coffee cup.',
  },
  {
    phase: 'PHASE 02: 2023',
    title: 'Structural Assembly',
    desc: 'Salvaging three high-cube containers and re-engineering them with reinforced frames and panoramic glass panels.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDzYD6fZHQNR0tpkcoeWVdrTHNO7Y5o9j3mUU_OcfTKuY8u_hRj88Y6WeI0Y9qNb0gIdAw68wpMJm5mrk_c1K-9UC7xUHbRF3vRCjta0kLR-JE5ndeoDbWXyP-4ZiHQepOstt1XmmosLdZpMLCtM9X878CPMNhUhFI6sf241zxJROvJcMbZCYfQAGwjg_J9VVdKNfzURrMsBqsh4kAzEIXf1lx9w96rLKTI9iqa7s-mmymcJcRo4--IXyE1IbVTvr1E_IZUKL2GMso',
    alt: 'Macro photo of a welding spark flying from a steel container frame in a dark industrial workshop.',
  },
  {
    phase: 'PHASE 03: 2024',
    title: 'Activation',
    desc: 'Aura Cafe opens its doors, establishing a new standard for the nocturnal coffee experience in the city center.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYYcihYurow2nJrdoCiHePwHUYCxmNt1zlg0kMou4a5zFHuyLbwQbY5OqQJvPLeWaXqn_hUV5V6sJGl9OzUToekQCxgn1IDMC0Nsxy0Q9Gu-YJEM1SR8S5J4eWTQicX2ZwTPYqukPe2j6qMM2zMjs7HRbj5jRVAbKJeSiAe-bdslvZUWzABh6QeSjANkXYIi-OoMoLF6-PYx2GmL2oFp4rc89l3xVNJlUmH1ZsIYlcea3ho3bcBNH6oIX6hCInznM0NKWjqiSLwHc',
    alt: 'The finished Aura Cafe at night, a glowing glass and steel structure against a dark urban background.',
  },
] as const;

const TEAM = [
  {
    name: 'Elias Thorne',
    role: 'Principal Architect',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD0hTVOW-2T_HSEmq53Pb7AEZBFR8ae8eJMY3PL54yKWKRtc9WanD14EXEJmov3uC1btKTebvh8xQr1BkheLr9GnPYtaEBtln5SEecxLVz75JiU8Vf8wo3BAP4bFUXL1UXQ0_6CQvlvck3-HkAQYzX8mY-oOAV22qfADhgusqex-eb2bG3SQn2AJy-XJd76e8LG4atTMmuXQT6JPgVHZgbR7j4Ubp6es3ijUYIvxBCCuJQAtEFlMdccyJJvlYFvABHqRhDKBmx3OMM',
    alt: 'Portrait of Elias Thorne, male architectural designer in a minimalist black turtleneck.',
  },
  {
    name: 'Sarah Chen',
    role: 'Extraction Engineer',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDgfqivZ4J9F9ALO0GTgB_Z0rbCTmUEawwAR3hXr_VRk1h6IR3BcDC7KAMutiNOeRpxmwZlgVDY9V8_iYr-v8hJTfrkRWNkfvJyXcgKUWI8yIFHdLiIvcMo4yHk2tdaNRNoSaAzwEdjqWEjTb-i7e3RHKgN-kPRcwmfCV8kTbD-TrKGj_D2r2ogO-xEtstKWc1OOuYtLFJvj1HHJnyixp68v0NvphBEmertvS1t0AVjjT7VhuWtaE1O4KS0Bq0vOqpCySKxJhslSZQ',
    alt: 'Portrait of Sarah Chen, female coffee scientist in a lab setting.',
  },
  {
    name: 'Marcus Vane',
    role: 'Head of Roast',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAYaFzAQnHsBcweMI-ofjrDs7pX4coYiiouhaKBmGvhfibi7v8L2wPAZeTwkZXBTP4cY_eXb8wzqxzepG385zAsb1cEEzk-McHQF4m6D9Yr8YD1MTNJYKUoXxSuIc3hyozLHE0Ck2TDPqBtEWrtdsJUm8rLq2l231MGOHD9F1_xaK2lOX5tjqYa3Jq7m8_IcWvwCUq8CrzObjAiWVByuImnMtQET04w32DqQM8o7HvfEqzJoOo2RI_SOsfCvgxcx_7QpleGgYWcpvE',
    alt: 'Portrait of Marcus Vane, master roaster with a well-groomed beard in a warehouse.',
  },
  {
    name: 'Lena Rossi',
    role: 'Operations Lead',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvoHrNnq13Jbj-7p-DBqbVcqXI9vg6xDFaroJ0sK8Zvc0Li1IF7NgFOyRLz2rnimLmKipejw4MNY5SZgXDYR03xCNQGAqpPH7Ttw8pJSmuKZnrCLOYc0_EBUFmoh8r-I-FUbFQMw92vfpXcDpNQEJslu9GtwTeSmGcdfwLpB2211lwtVhxf70G8lbF2zyApMwot3LtykT5pEsDMSo-eqJ3N7Tuddj-_LhtDWgEfK14MidFI2_NBcTDU3c6YoQSoQtResKGGhdknV8',
    alt: 'Portrait of Lena Rossi, professional operations manager in a modern cafe.',
  },
] as const;

const HERO_BG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuACV1Udt-Hrc1M1LgOPzS7v8AzKj9LY37FvF84qcsl1xnhN5UpzbjAL7YECy1F2462ZGEk_OP-7A8hik2pOP99Nojnf51y7Mb9IXjGQlTQSBeym9fR_cxzw_ny6yQEcG98L50URyngya9UOMRkc7u4sVMPyLbRdY_AX2IBE_yf7BLinia4L9wIYd3OwmyUkxasutf0d7CdGedJ3TmOVNoAzkuqjCqp37ucfYgkbSivwlE_Pm9uErwenNM_ZOMrcNHe0Ix1egPArFyo';

/* ─── Scroll Reveal Hook ───────────────────────────────────────────── */

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-10');
          }
        });
      },
      { threshold: 0.1 },
    );

    document.querySelectorAll('.glass-card').forEach((card) => {
      card.classList.add('transition-all', 'duration-1000', 'opacity-0', 'translate-y-10');
      observer.observe(card);
    });

    return () => observer.disconnect();
  }, []);
}

/* ─── Component ────────────────────────────────────────────────────── */

export default function OurStoryPage() {
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);

  useScrollReveal();

  return (
    <StitchShell>
      {/* ── Nav ── */}
      <StitchNav ctaLabel="Order Now" />

      <main>
        {/* ── Hero Section ── */}
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

        {/* ── Story Section: Bento Glass Grid ── */}
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

        {/* ── Timeline: Vertical Machine Flow ── */}
        <section className="py-32 bg-[var(--aura-noir-deep)] relative">
          <div className="max-w-[1280px] mx-auto px-5 md:px-16">
            <div className="text-center mb-24">
              <h2 className="font-display text-3xl md:text-4xl text-[var(--aura-chrome-bright)] mb-4">
                Evolutionary Cycle
              </h2>
              <p className="text-[var(--aura-chrome-mid)] font-body text-xs font-semibold tracking-[0.3em] uppercase">
                From Prototype to Perfection
              </p>
            </div>

            <div className="relative max-w-4xl mx-auto">
              {/* Vertical Line */}
              <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[var(--aura-chrome-mid)] to-transparent" />

              {TIMELINE.map((item, i) => (
                <div
                  key={i}
                  className={`relative grid grid-cols-1 md:grid-cols-2 gap-16 mb-32 items-center ${
                    i === 1 ? 'md:flex-row-reverse' : ''
                  }`}
                >
                  {/* Text */}
                  <div className={i % 2 === 1 ? 'md:text-left md:order-2' : 'md:text-right'}>
                    <span className="text-[var(--aura-chrome-mid)] font-bold font-body text-xs tracking-widest block mb-2">
                      {item.phase}
                    </span>
                    <h4 className="text-white text-xl md:text-2xl font-semibold mb-4 font-display">
                      {item.title}
                    </h4>
                    <p className="text-[var(--aura-chrome-mid)] text-sm font-body">
                      {item.desc}
                    </p>
                  </div>

                  {/* Image Card */}
                  <div
                    className={`flex items-center justify-start md:justify-center relative ${
                      i % 2 === 1 ? 'md:justify-start' : ''
                    }`}
                  >
                    {/* Dot */}
                    <div
                      className={`w-4 h-4 bg-[var(--aura-chrome-mid)] absolute -left-[8.5px] md:left-auto md:right-auto z-10 rounded-full border-4 border-[var(--aura-noir-void)] ${
                        i === 2
                          ? 'bg-[var(--aura-chrome-bright)] shadow-[0_0_15px_rgba(231,192,144,0.5)]'
                          : ''
                      }`}
                    />
                    <div className="glass-card p-6 w-full ml-8 md:ml-0">
                      <img
                        className="w-full h-32 object-cover opacity-50 grayscale"
                        alt={item.alt}
                        src={item.img}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Values Section ── */}
        <section className="py-32 px-5 md:px-16 max-w-[1280px] mx-auto overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Value 1: Purity */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 md:p-12 flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-full border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center mb-8 group-hover:border-[var(--aura-chrome-bright)] transition-colors duration-500">
                <span className="text-[var(--aura-chrome-mid)] group-hover:text-[var(--aura-chrome-bright)] text-3xl transition-colors duration-500">
                  ✅
                </span>
              </div>
              <h3 className="font-display text-lg md:text-xl text-white mb-4 uppercase tracking-widest">
                Purity
              </h3>
              <p className="text-[var(--aura-chrome-mid)] text-sm font-body font-light">
                Zero compromise on origin. We source only single-estate beans that meet our rigorous
                chemical profile standards.
              </p>
            </div>

            {/* Value 2: Integrity */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 md:p-12 flex flex-col items-center text-center group relative overflow-hidden">
              <div className="absolute inset-0 bg-[var(--aura-chrome-bright)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-16 h-16 rounded-full border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center mb-8 group-hover:border-[var(--aura-chrome-bright)] transition-colors duration-500">
                <span className="text-[var(--aura-chrome-mid)] group-hover:text-[var(--aura-chrome-bright)] text-3xl transition-colors duration-500">
                  🔧
                </span>
              </div>
              <h3 className="font-display text-lg md:text-xl text-white mb-4 uppercase tracking-widest">
                Integrity
              </h3>
              <p className="text-[var(--aura-chrome-mid)] text-sm font-body font-light">
                Transparency in every gear. Our brewing process is fully visible, inviting curiosity
                and conversation.
              </p>
            </div>

            {/* Value 3: Sustainability */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 md:p-12 flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-full border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center mb-8 group-hover:border-[var(--aura-chrome-bright)] transition-colors duration-500">
                <span className="text-[var(--aura-chrome-mid)] group-hover:text-[var(--aura-chrome-bright)] text-3xl transition-colors duration-500">
                  🌿
                </span>
              </div>
              <h3 className="font-display text-lg md:text-xl text-white mb-4 uppercase tracking-widest">
                Sustainability
              </h3>
              <p className="text-[var(--aura-chrome-mid)] text-sm font-body font-light">
                Engineered for longevity. From container re-use to zero-waste filtration, we respect
                the machine that is our planet.
              </p>
            </div>
          </div>
        </section>

        {/* ── Team Section ── */}
        <section className="py-32 px-5 md:px-16 bg-[var(--aura-noir-deep)]">
          <div className="max-w-[1280px] mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
              <div>
                <h2 className="font-display text-3xl md:text-4xl text-[var(--aura-chrome-bright)] mb-4">
                  The Minds Behind{'\n'}the Machine
                </h2>
                <p className="text-[var(--aura-chrome-mid)] max-w-md font-body">
                  Our team consists of industrial designers, chemical engineers, and master roasters
                  united by a singular focus.
                </p>
              </div>
              <div className="h-px w-full md:w-64 bg-[var(--aura-chrome-mid)]/20 hidden md:block" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {TEAM.map((member) => (
                <div key={member.name} className="group">
                  <div className="relative mb-6 aspect-[4/5] overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px]">
                    <img
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                      alt={member.alt}
                      src={member.img}
                    />
                  </div>
                  <h4 className="text-white text-lg font-bold tracking-tight mb-1 font-display">
                    {member.name}
                  </h4>
                  <p className="text-[var(--aura-chrome-mid)] font-body text-xs uppercase tracking-widest font-bold">
                    {member.role}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="py-32 md:py-40 px-5 md:px-16 text-center bg-[var(--aura-noir-void)]">
          <div className="max-w-4xl mx-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-12 md:p-24 relative overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-[var(--aura-chrome-bright)]/10 blur-[100px] rounded-full" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[var(--aura-chrome-mid)]/10 blur-[100px] rounded-full" />

            <h2 className="font-display text-4xl md:text-6xl lg:text-7xl text-white mb-8">
              Join the Pulse.
            </h2>
            <p className="text-[var(--aura-chrome-mid)] mb-12 max-w-xl mx-auto font-body font-light leading-relaxed">
              Experience the convergence of architectural design and the world{'\''}s most precise
              caffeine delivery system.
            </p>
            <button
              className="bg-[var(--aura-chrome-mid)] hover:bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] px-10 md:px-12 py-4 font-body text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 shadow-xl flex items-center gap-3 mx-auto rounded-lg"
            >
              Experience the Precision →
            </button>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-[var(--aura-noir-deep)] border-t border-white/5 py-20 px-5 md:px-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-[1280px] mx-auto">
          <div className="md:col-span-2">
            <div className="font-display text-xl text-[var(--aura-chrome-bright)] uppercase mb-6 tracking-widest">
              AURA CAFE
            </div>
            <p className="text-[var(--aura-chrome-mid)] max-w-sm font-body text-xs leading-relaxed mb-8">
              ENGINEERED ELEGANCE. NOCTURNAL SANCTUARY. RE-DEFINING THE ARCHITECTURE OF HOSPITALITY
              THROUGH PRECISION AND SALVAGE.
            </p>
            <div className="flex gap-6">
              <a
                className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
                href="#"
              >
                📢
              </a>
              <a
                className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
                href="#"
              >
                📍
              </a>
              <a
                className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
                href="#"
              >
                ✉️
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h5 className="text-white font-bold uppercase tracking-widest text-xs mb-2 font-body">
              Legal &amp; Ethics
            </h5>
            <a
              className="font-body text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              href="#"
            >
              Privacy Policy
            </a>
            <a
              className="font-body text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              href="#"
            >
              Terms of Service
            </a>
            <a
              className="font-body text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              href="#"
            >
              Sustainability
            </a>
          </div>

          <div className="flex flex-col gap-4">
            <h5 className="text-white font-bold uppercase tracking-widest text-xs mb-2 font-body">
              Company
            </h5>
            <a
              className="font-body text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              href="#"
            >
              Careers
            </a>
            <a
              className="font-body text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              href="#"
            >
              Press Kit
            </a>
            <a
              className="font-body text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              href="#"
            >
              Contact
            </a>
          </div>
        </div>

        <div className="max-w-[1280px] mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-body text-xs text-[var(--aura-chrome-mid)]">
            &copy; 2024 AURA CAFE. ENGINEERED ELEGANCE.
          </p>
          <p className="font-body text-[10px] text-[var(--aura-chrome-mid)] tracking-widest">
            VERSION 2.0.4 // SYSTEM: ACTIVE
          </p>
        </div>
      </footer>
    </StitchShell>
  );
}
