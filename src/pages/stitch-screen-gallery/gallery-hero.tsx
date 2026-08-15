/* ── Stitch Screen Gallery — Hero Header ───────────────────────── */

import { SCREENS } from './screen-data';

export function GalleryHero() {
  const routedCount = SCREENS.filter(s => s.status === 'routed').length;
  const skipped = SCREENS.filter(s => s.status === 'skipped').length;
  const partial = SCREENS.filter(s => s.status === 'partial').length;

  return (
    <header className="pt-28 pb-12 px-5 md:px-16 max-w-[1280px] mx-auto">
      <div className="space-y-4">
        <span className="font-body text-xs uppercase tracking-[0.2em] text-[var(--aura-tertiary)]">
          FnB Container Caffe — Visual QA
        </span>
        <h1 className="font-display text-5xl md:text-7xl leading-tight text-[var(--aura-chrome-bright)] italic">
          Stitch Screen<br />Gallery
        </h1>
        <p className="font-body text-lg text-[var(--aura-chrome-mid)] max-w-2xl">
          {SCREENS.length} screens converted from Stitch design exports. Browse, filter, and preview each screen.
        </p>

        {/* Stats */}
        <div className="flex gap-6 pt-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="font-body text-sm text-[var(--aura-chrome-mid)]">{routedCount} Routed</span>
          </div>
          {skipped > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="font-body text-sm text-[var(--aura-chrome-mid)]">{skipped} Skipped</span>
            </div>
          )}
          {partial > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="font-body text-sm text-[var(--aura-chrome-mid)]">{partial} Partial</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
