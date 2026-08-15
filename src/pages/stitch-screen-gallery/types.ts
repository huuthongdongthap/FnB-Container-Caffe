/* ── Stitch Screen Gallery — Types ──────────────────────────────── */

export interface Screen {
  name: string;
  slug: string;
  route: string | null;
  source: string;
  icon: string;
  status: 'routed' | 'skipped' | 'partial';
}

export const STATUS_COLORS: Record<string, string> = {
  routed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  skipped: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};
