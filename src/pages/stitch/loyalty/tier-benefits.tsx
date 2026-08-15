import { TIER_BENEFITS } from './loyalty-constants';

export default function TierBenefits() {
  return (
    <section className="glass-panel rounded-xl p-5">
      <h3 className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-[0.2em] mb-4">Tier Benefits / Quyền lợi</h3>
      <ul className="space-y-3">
        {TIER_BENEFITS.map(b => (
          <li key={b} className="flex items-center gap-3 group">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--aura-tertiary)] group-hover:scale-150 transition-transform shrink-0" />
            <span className="font-body-sm text-sm text-[var(--aura-chrome-bright)]">{b}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
