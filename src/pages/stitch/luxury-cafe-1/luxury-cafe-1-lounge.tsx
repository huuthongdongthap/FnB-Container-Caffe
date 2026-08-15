import { LOUNGE_FEATURES } from './luxury-cafe-1-constants';

export function LoungeSection() {
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
