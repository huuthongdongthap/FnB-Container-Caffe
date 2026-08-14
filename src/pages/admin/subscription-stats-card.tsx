interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-[var(--aura-bg-elevated)]/40 p-4 backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-muted/60">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted/40">{sub}</p>}
    </div>
  );
}
