/* ── Stitch Screen Gallery — Screen Card ───────────────────────── */

import type { Screen } from './types';
import { STATUS_COLORS } from './types';

interface ScreenCardProps {
  screen: Screen;
}

export function ScreenCard({ screen }: ScreenCardProps) {
  return (
    <a
      href={screen.route ?? undefined}
      className={`glass-panel rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 group ${
        !screen.route ? 'opacity-60 pointer-events-none' : 'cursor-pointer'
      }`}
    >
      {/* Icon bar */}
      <div className="h-24 bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center border-b border-white/5">
        <span className="text-4xl group-hover:scale-110 transition-transform">{screen.icon}</span>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl text-[var(--aura-chrome-bright)] group-hover:text-[var(--aura-tertiary)] transition-colors leading-tight">
            {screen.name}
          </h3>
          <span className={`text-[9px] font-body font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[screen.status]}`}>
            {screen.status}
          </span>
        </div>

        <code className="font-body text-[10px] text-[var(--aura-chrome-mid)] bg-white/5 px-2 py-1 rounded">
          src/pages/stitch/{screen.slug}/index.tsx
        </code>

        <div className="flex items-center justify-between mt-auto pt-2">
          <code className="font-body text-[10px] text-[var(--aura-tertiary)] truncate flex-1">
            {screen.route || '⚠ no route'}
          </code>
          {screen.route && (
            <span className="text-[var(--aura-chrome-mid)] text-xs ml-2 group-hover:text-[var(--aura-tertiary)] transition-colors">
              ↗
            </span>
          )}
        </div>

        <div className="text-[9px] font-body text-[var(--aura-chrome-mid)] tracking-wider uppercase">
          Source: {screen.source}
        </div>
      </div>
    </a>
  );
}
