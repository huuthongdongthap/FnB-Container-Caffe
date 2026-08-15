import type { ArchiveItem as ArchiveItemType } from './events-promotions-2-types';

/* ── Archive Item Component ───────────────────────────────────────────── */

export function ArchiveItem({ item }: { item: ArchiveItemType }) {
  return (
    <div className="flex gap-4 items-center p-4 glass-panel rounded-2xl">
      <div
        className="w-16 h-16 rounded-lg bg-[var(--aura-surface-variant)] flex-shrink-0 bg-cover"
        style={{ backgroundImage: `url('${item.image}')` }}
        role="img"
        aria-label={item.title}
      />
      <div>
        <span className="block font-body text-[9px] uppercase tracking-[0.15em] text-[var(--aura-chrome-dark)]">
          {item.month}
        </span>
        <h4 className="font-display text-lg text-white">{item.title}</h4>
      </div>
    </div>
  );
}
