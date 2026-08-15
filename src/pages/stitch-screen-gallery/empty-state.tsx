/* ── Stitch Screen Gallery — Empty State ───────────────────────── */

interface EmptyStateProps {
  onClear: () => void;
}

export function EmptyState({ onClear }: EmptyStateProps) {
  return (
    <div className="text-center py-20">
      <p className="font-display text-2xl text-[var(--aura-chrome-mid)] italic">No screens match</p>
      <button
        onClick={onClear}
        className="mt-4 font-body text-xs uppercase tracking-widest text-[var(--aura-tertiary)] hover:underline"
      >
        Clear filters
      </button>
    </div>
  );
}
