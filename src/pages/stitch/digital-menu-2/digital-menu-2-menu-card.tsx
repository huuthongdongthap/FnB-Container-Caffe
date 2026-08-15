import type { MenuItem } from './digital-menu-2-types';
import { MENU_ITEMS } from './digital-menu-2-constants';

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

export function MenuCard({ item }: { item: (typeof MENU_ITEMS)[number] }) {
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
      <div className="aspect-fable-5 overflow-hidden">
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
