import { TIMELINE } from './our-story-data';

export function TimelineSection() {
  return (
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
  );
}
