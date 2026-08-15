import { MENU_ITEMS } from './luxury-cafe-1-constants';

export function MenuSection() {
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
