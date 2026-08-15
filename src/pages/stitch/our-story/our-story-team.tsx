import { TEAM } from './our-story-data';

export function TeamSection() {
  return (
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
  );
}
