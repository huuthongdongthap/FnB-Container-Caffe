import React from 'react';
import {
  Building2,
  Cog,
  Moon,
  CheckCircle,
  Settings,
  Leaf,
  ArrowRight,
  Megaphone,
  MapPin,
  Mail,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface TeamMember {
  readonly name: string;
  readonly role: string;
  readonly image: string;
  readonly alt: string;
}

interface TimelinePhase {
  readonly phase: string;
  readonly year: string;
  readonly title: string;
  readonly description: string;
  readonly image: string;
  readonly alt: string;
  readonly isActive?: boolean;
}

interface Value {
  readonly icon: React.ElementType;
  readonly title: string;
  readonly description: string;
}

/* ─── Data ──────────────────────────────────────────────────────────── */

const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    name: 'Elias Thorne',
    role: 'Principal Architect',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD0hTVOW-2T_HSEmq53Pb7AEZBFR8ae8eJMY3PL54yKWKRtc9WanD14EXEJmov3uC1btKTebvh8xQr1BkheLr9GnPYtaEBtln5SEecxLVz75JiU8Vf8wo3BAP4bFUXL1UXQ0_6CQvlvck3-HkAQYzX8mY-oOAV22qfADhgusqex-eb2bG3SQn2AJy-XJd76e8LG4atTMmuXQT6JPgVHZgbR7j4Ubp6es3ijUYIvxBCCuJQAtEFlMdccyJJvlYFvABHqRhDKBmx3OMM',
    alt: 'Portrait of male architectural designer in minimalist black turtleneck',
  },
  {
    name: 'Sarah Chen',
    role: 'Extraction Engineer',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDgfqivZ4J9F9ALO0GTgB_Z0rbCTmUEawwAR3hXr_VRk1h6IR3BcDC7KAMutiNOeRpxmwZlgVDY9V8_iYr-v8hJTfrkRWNkfvJyXcgKUWI8yIFHdLiIvcMo4yHk2tdaNRNoSaAzwEdjqWEjTb-i7e3RHKgN-kPRcwmfCV8kTbD-TrKGj_D2r2ogO-xEtstKWc1OOuYtLFJvj1HHJnyixp68v0NvphBEmertvS1t0AVjjT7VhuWtaE1O4KS0Bq0vOqpCySKxJhslSZQ',
    alt: 'Portrait of female coffee scientist in lab setting',
  },
  {
    name: 'Marcus Vane',
    role: 'Head of Roast',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAYaFzAQnHsBcweMI-ofjrDs7pX4coYiiouhaKBmGvhfibi7v8L2wPAZeTwkZXBTP4cY_eXb8wzqxzepG385zAsb1cEEzk-McHQF4m6D9Yr8YD1MTNJYKUoXxSuIc3hyozLHE0Ck2TDPqBtEWrtdsJUm8rLq2l231MGOHD9F1_xaK2lOX5tjqYa3Jq7m8_IcWvwCUq8CrzObjAiWVByuImnMtQET04w32DqQM8o7HvfEqzJoOo2RI_SOsfCvgxcx_7QpleGgYWcpvE',
    alt: 'Portrait of master roaster with beard in warehouse with coffee sacks',
  },
  {
    name: 'Lena Rossi',
    role: 'Operations Lead',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvoHrNnq13Jbj-7p-DBqbVcqXI9vg6xDFaroJ0sK8Zvc0Li1IF7NgFOyRLz2rnimLmKipejw4MNY5SZgXDYR03xCNQGAqpPH7Ttw8pJSmuKZnrCLOYc0_EBUFmoh8r-I-FUbFQMw92vfpXcDpNQEJslu9GtwTeSmGcdfwLpB2211lwtVhxf70G8lbF2zyApMwot3LtykT5pEsDMSo-eqJ3N7Tuddj-_LhtDWgEfK14MidFI2_NBcTDU3c6YoQSoQtResKGGhdknV8',
    alt: 'Portrait of professional operations manager in navy suit',
  },
];

const TIMELINE_PHASES: readonly TimelinePhase[] = [
  {
    phase: 'PHASE 01',
    year: '2022',
    title: 'The Concept Blueprint',
    description:
      'Initial visioning of a cafe that exists at the intersection of container architecture and technical brewing precision.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDrhST6weshnMyYXw_5Rn-ORCRUIsoDhbpt4ajVNC7rffHA7Ygn2Lpa6AvG4KEuHwCqsSAEeeXovAV2kvEOJVctf2y3oKYBKE3mSnN9kti5v0Y5bjMx7-cUNU8j6uBXF8SQFINn5nnN1uEv0-2r8_VKIWVen676wqEQwPLD3O1XQftQ-ZC6qbCN7BS2ejgf7UYM5aY4r-Qft1c6Y8dcrXqOClP6hxQ2bXEl0kNiy5wulHktiPGAbZzf1SyVlodxcRjyu3dp56PIh6Y',
    alt: 'Technical architectural blueprints of container cafe layout on dark metal desk',
  },
  {
    phase: 'PHASE 02',
    year: '2023',
    title: 'Structural Assembly',
    description:
      'Salvaging three high-cube containers and re-engineering them with reinforced frames and panoramic glass panels.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDzYD6fZHQNR0tpkcoeWVdrTHNO7Y5o9j3mUU_OcfTKuY8u_hRj88Y6WeI0Y9qNb0gIdAw68wpMJm5mrk_c1K-9UC7xUHbRF3vRCjta0kLR-JE5ndeoDbWXyP-4ZiHQepOstt1XmmosLdZpMLCtM9X878CPMNhUhFI6sf241zxJROvJcMbZCYfQAGwjg_J9VVdKNfzURrMsBqsh4kAzEIXf1lx9w96rLKTI9iqa7s-mmymcJcRo4--IXyE1IbVTvr1E_IZUKL2GMso',
    alt: 'Macro photo of welding spark on steel container frame in dark workshop',
  },
  {
    phase: 'PHASE 03',
    year: '2024',
    title: 'Activation',
    description:
      'Aura Cafe opens its doors, establishing a new standard for the nocturnal coffee experience in the city center.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYYcihYurow2nJrdoCiHePwHUYCxmNt1zlg0kMou4a5zFHuyLbwQbY5OqQJvPLeWaXqn_hUV5V6sJGl9OzUToekQCxgn1IDMC0Nsxy0Q9Gu-YJEM1SR8S5J4eWTQicX2ZwTPYqukPe2j6qMM2zMjs7HRbj5jRVAbKJeSiAe-bdslvZUWzABh6QeSjANkXYIi-OoMoLF6-PYx2GmL2oFp4rc89l3xVNJlUmH1ZsIYlcea3ho3bcBNH6oIX6hCInznM0NKWjqiSLwHc',
    alt: 'Finished Aura Cafe at night, glowing glass and steel structure',
    isActive: true,
  },
];

const VALUES: readonly Value[] = [
  {
    icon: CheckCircle,
    title: 'Purity',
    description:
      'Zero compromise on origin. We source only single-estate beans that meet our rigorous chemical profile standards.',
  },
  {
    icon: Settings,
    title: 'Integrity',
    description:
      'Transparency in every gear. Our brewing process is fully visible, inviting curiosity and conversation.',
  },
  {
    icon: Leaf,
    title: 'Sustainability',
    description:
      'Engineered for longevity. From container re-use to zero-waste filtration, we respect the machine that is our planet.',
  },
];

/* ─── Styles ────────────────────────────────────────────────────────── */

const styles = {
  glassCard:
    'bg-[rgba(255,255,255,0.05)] backdrop-blur-[20px] border border-[rgba(168,169,173,0.2)]',
  chromeBorderTop:
    'border-t border-[rgba(168,169,173,0.4)]',
};

/* ─── Sections ──────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="relative flex h-screen items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 z-10 bg-[#0A1A2E]/80" />
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              'url(https://lh3.googleusercontent.com/aida-public/AB6AXuACV1Udt-Hrc1M1LgOPzS7v8AzKj9LY37FvF84qcsl1xnhN5UpzbjAL7YECy1F2462ZGEk_OP-7A8hik2pOP99Nojnf51y7Mb9IXjGQlTQSBeym9fR_cxzw_ny6yQEcG98L50URyngya9UOMRkc7u4sVMPyLbRdY_AX2IBE_yf7BLinia4L9wIYd3OwmyUkxasutf0d7CdGedJ3TmOVNoAzkuqjCqp37ucfYgkbSivwlE_Pm9uErwenNM_ZOMrcNHe0Ix1egPArFyo)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </div>
      {/* Content */}
      <div className="relative z-20 px-6 text-center">
        <span className="mb-6 block animate-pulse font-['Space_Grotesk',sans-serif] text-[12px] uppercase tracking-[0.4em] text-[#A8A9AD]">
          Established 2024
        </span>
        <h1 className="mx-auto max-w-5xl font-['Cormorant_Garamond',serif] text-6xl font-medium leading-tight text-white md:text-8xl lg:text-9xl">
          The Art of the{' '}
          <span className="italic text-[var(--aura-tertiary)]">Nocturnal Pour</span>
        </h1>
        <div className="mx-auto mt-8 h-px w-24 bg-[#A8A9AD] opacity-50" />
      </div>
      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-4">
        <span className="font-['Space_Grotesk',sans-serif] text-[12px] uppercase tracking-widest text-[#A8A9AD] opacity-60">
          Scroll to Explore
        </span>
        <div className="h-16 w-px bg-gradient-to-b from-[#A8A9AD] to-transparent" />
      </div>
    </section>
  );
}

function StoryGrid() {
  return (
    <section className="mx-auto max-w-[1280px] px-[64px] py-32">
      <div className="grid grid-cols-1 gap-[24px] md:grid-cols-12">
        {/* Title */}
        <div className="mb-16 md:col-span-12">
          <h2 className="font-['Libre_Caslon_Text',serif] text-[72px] text-[var(--aura-primary)]">
            The Blueprint
          </h2>
          <p className="mt-4 max-w-2xl font-['Space_Grotesk',sans-serif] text-base font-light leading-relaxed text-[var(--aura-text-secondary)]">
            Aura Cafe is more than a destination; it's a structural dialogue between raw
            industrial resilience and the ephemeral beauty of the perfect roast.
          </p>
        </div>
        {/* Architectural Salvage */}
        <div
          className={`${styles.glassCard} ${styles.chromeBorderTop} group flex flex-col justify-between md:col-span-7`}
        >
          <div className="p-12">
            <div className="mb-8 flex items-center gap-4">
              <Building2 className="text-4xl text-[var(--aura-tertiary)]" size={40} />
              <span className="font-bold tracking-tighter text-[#A8A9AD]">REF: 001</span>
            </div>
            <h3 className="mb-6 font-['Libre_Caslon_Text',serif] text-[32px] text-white">
              Architectural Salvage
            </h3>
            <p className="leading-relaxed text-[var(--aura-text-secondary)]">
              Our foundation is built from decommissioned cargo containers, re-engineered as
              minimalist glass-walled sanctuaries. We embrace the industrial scars of the steel,
              celebrating its history while housing the future of hospitality.
            </p>
          </div>
          <div className="mx-12 mb-12 mt-0 h-64 overflow-hidden rounded-lg border border-white/5">
            <img
              className="h-full w-full object-cover opacity-70 grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCPfD_Jmk4XFRuVxW23V1fnlA6_1Qu-BNqDWJ2dpYOrn8KE3OveBmrH_EZjrTYFUye1O7Z7Gj2F4NBEqEUsDLx1urd5bqF8rfNfm__g3buZH-uLov62E2-ARnhpxV7zv_x_p4WMOBdCM_TGrZxa3MiOWyeKRL_W2uZj1KDk010YbY7YToBkm21ofLeEpe8RYO1cr4GNwf5WRzOjmdu22tBl8Js-tyfMD_Dri79MVsa3HrV0_T72l6Fzl0P1IKoO4OU5b6MB5KPfGas"
              alt="Close up architectural detail of weathered container corner meeting chrome glass frame"
            />
          </div>
        </div>
        {/* Right column */}
        <div className="flex flex-col gap-[24px] md:col-span-5">
          <div className={`${styles.glassCard} ${styles.chromeBorderTop} group h-full`}>
            <div className="p-10">
              <Cog className="mb-6 text-3xl text-[var(--aura-tertiary)]" size={30} />
              <h3 className="mb-4 font-['Libre_Caslon_Text',serif] text-[20px] text-white">
                Precision Brewing
              </h3>
              <p className="text-sm leading-relaxed text-[var(--aura-text-secondary)]">
                We view extraction as an engineering challenge. Utilizing custom-modded pressure
                profiles and laboratory-grade filtration, every pour is a repeatable masterpiece of
                flavor chemistry.
              </p>
            </div>
          </div>
          <div className={`${styles.glassCard} ${styles.chromeBorderTop} group h-full`}>
            <div className="p-10">
              <Moon className="mb-6 text-3xl text-[var(--aura-tertiary)]" size={30} />
              <h3 className="mb-4 font-['Libre_Caslon_Text',serif] text-[20px] text-white">
                Nocturnal Sanctuary
              </h3>
              <p className="text-sm leading-relaxed text-[var(--aura-text-secondary)]">
                Designed for the night owls, the thinkers, and the quiet creators. Our lighting is
                calibrated to the golden hour, creating a focus-enhancing void in the heart of the
                city.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TimelineSection() {
  return (
    <section className="relative bg-[#0c0e10] py-32">
      <div className="mx-auto max-w-[1280px] px-[64px]">
        <div className="mb-24 text-center">
          <h2 className="mb-4 font-['Libre_Caslon_Text',serif] text-[72px] text-[var(--aura-primary)]">
            Evolutionary Cycle
          </h2>
          <p className="font-['Space_Grotesk',sans-serif] text-[12px] uppercase tracking-[0.3em] text-[#A8A9AD]">
            From Prototype to Perfection
          </p>
        </div>
        <div className="relative mx-auto max-w-4xl">
          {/* Vertical Line */}
          <div className="timeline-line absolute left-1/2 top-0 -translate-x-1/2" />

          {TIMELINE_PHASES.map((phase, index) => {
            const isOdd = index % 2 === 0;
            return (
              <div
                key={phase.phase}
                className="relative mb-32 grid grid-cols-1 items-center gap-16 md:grid-cols-2 last:mb-0"
              >
                {/* Text - alternates left/right */}
                <div className={isOdd ? 'md:text-right' : 'order-1 md:order-2'}>
                  <span className="mb-2 block font-['Space_Grotesk',sans-serif] text-[12px] font-bold tracking-widest text-[var(--aura-tertiary)]">
                    {phase.phase}: {phase.year}
                  </span>
                  <h4 className="mb-4 text-2xl font-semibold text-white">{phase.title}</h4>
                  <p className="text-sm text-[var(--aura-text-secondary)]">
                    {phase.description}
                  </p>
                </div>
                {/* Dot + Image */}
                <div
                  className={
                    isOdd
                      ? 'relative flex items-center justify-start md:justify-center'
                      : 'order-2 relative flex items-center justify-start md:order-1 md:justify-center'
                  }
                >
                  <div
                    className={
                      phase.isActive
                        ? 'absolute left-[-8.5px] z-10 h-4 w-4 rounded-full border-4 border-[#0A1A2E] bg-[var(--aura-tertiary)] shadow-[0_0_15px_rgba(231,192,144,0.5)] md:left-auto md:right-auto'
                        : 'absolute left-[-8.5px] z-10 h-4 w-4 rounded-full border-4 border-[#0A1A2E] bg-[#96754B] md:left-auto md:right-auto'
                    }
                  />
                  <div
                    className={
                      phase.isActive
                        ? `ml-8 w-full border border-[rgba(231,192,144,0.3)] ${styles.glassCard} p-6 md:ml-0`
                        : `ml-8 w-full ${styles.glassCard} p-6 md:ml-0`
                    }
                  >
                    <img
                      className={`h-32 w-full object-cover ${!phase.isActive ? 'opacity-50 grayscale' : ''}`}
                      src={phase.image}
                      alt={phase.alt}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        .timeline-line {
          background: linear-gradient(to bottom, transparent, #A8A9AD 15%, #A8A9AD 85%, transparent);
        }
      `}</style>
    </section>
  );
}

function ValuesSection() {
  return (
    <section className="mx-auto max-w-[1280px] overflow-hidden px-[64px] py-32">
      <div className="grid grid-cols-1 gap-[24px] md:grid-cols-3">
        {VALUES.map((value) => {
          const Icon = value.icon;
          return (
            <div
              key={value.title}
              className={`${styles.glassCard} group flex flex-col items-center p-12 text-center`}
            >
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(168,169,173,0.3)] transition-colors duration-500 group-hover:border-[var(--aura-tertiary)]">
                <Icon
                  className="text-3xl text-[#A8A9AD] transition-colors duration-500 group-hover:text-[var(--aura-tertiary)]"
                  size={30}
                />
              </div>
              <h3 className="mb-4 text-[20px] font-bold uppercase tracking-widest text-white">
                {value.title}
              </h3>
              <p className="text-sm font-light text-[var(--aura-text-secondary)]">
                {value.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TeamSection() {
  return (
    <section className="bg-[#0c0e10] px-[64px] py-32">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-24 flex flex-col items-end justify-between gap-8 md:flex-row">
          <div>
            <h2 className="mb-4 font-['Libre_Caslon_Text',serif] text-[72px] text-[var(--aura-primary)]">
              The Minds Behind<br />the Machine
            </h2>
            <p className="max-w-md text-[var(--aura-text-secondary)]">
              Our team consists of industrial designers, chemical engineers, and master roasters
              united by a singular focus.
            </p>
          </div>
          <div className="hidden h-px w-64 bg-[rgba(168,169,173,0.2)] md:block" />
        </div>
        <div className="grid grid-cols-1 gap-[24px] md:grid-cols-4">
          {TEAM_MEMBERS.map((member) => (
            <div key={member.name} className="group">
              <div
                className={`${styles.glassCard} relative mb-6 aspect-[4/5] overflow-hidden`}
              >
                <img
                  className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                  src={member.image}
                  alt={member.alt}
                />
              </div>
              <h4 className="mb-1 text-lg font-bold tracking-tight text-white">
                {member.name}
              </h4>
              <p className="font-['Space_Grotesk',sans-serif] text-[12px] font-bold uppercase tracking-widest text-[var(--aura-tertiary)]">
                {member.role}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="bg-[#0A1A2E] px-[64px] py-40 text-center">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-lg bg-[rgba(255,255,255,0.05)] p-24 backdrop-blur-[20px]">
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[rgba(231,192,144,0.1)] blur-[100px]" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[rgba(184,199,226,0.1)] blur-[100px]" />
        <h2 className="mb-8 font-['Cormorant_Garamond',serif] text-5xl text-white md:text-7xl">
          Join the Pulse.
        </h2>
        <p className="mx-auto mb-12 max-w-xl font-light leading-relaxed text-[var(--aura-text-secondary)]">
          Experience the convergence of architectural design and the world's most precise caffeine
          delivery system.
        </p>
        <button
          type="button"
          className="mx-auto flex items-center gap-3 bg-[#96754B] px-12 py-4 text-[12px] font-bold uppercase tracking-[0.2em] text-[#050D17] shadow-xl shadow-[rgba(150,117,75,0.1)] transition-all duration-300 hover:bg-[var(--aura-tertiary)]"
        >
          Experience the Precision
          <ArrowRight size={20} />
        </button>
      </div>
    </section>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export function AboutUs() {
  return (
    <main className="min-h-screen bg-[#0A1A2E] font-['Space_Grotesk',sans-serif] text-[#e2e2e5] selection:bg-[var(--aura-tertiary)] selection:text-black">
      <HeroSection />
      <StoryGrid />
      <TimelineSection />
      <ValuesSection />
      <TeamSection />
      <CTASection />
    </main>
  );
}
