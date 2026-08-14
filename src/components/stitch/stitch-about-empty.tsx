'use client';

import { ScrollText } from 'lucide-react';

/**
 * Empty state for StitchAbout page.
 */
export function AboutEmpty() {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <ScrollText className="h-12 w-12" style={{ color: 'var(--aura-text-disabled, #5a6270)' }} />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        No Content Available
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
        About page content is being prepared.
      </p>
    </div>
  );
}
