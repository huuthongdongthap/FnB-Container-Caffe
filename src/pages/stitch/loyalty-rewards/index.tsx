import { useState, useRef } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';
import { useParallaxTilt } from './loyalty-rewards-hooks';
import { LeftColumn } from './loyalty-rewards-left-column';
import { RightColumn } from './loyalty-rewards-right-column';

/* ── Re-export types ─────────────────────────────────────────────────── */
export type { NavLink, Activity, Reward } from './loyalty-rewards-types';

/* ── Component ──────────────────────────────────────────────────────── */

export default function LoyaltyRewardsDashboard() {
  const [copied, setCopied] = useState(false);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  useParallaxTilt(cardRefs);

  const handleCopyCode = () => {
    navigator.clipboard.writeText('AURA-PLAT-882');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <StitchShell>
      <div className="min-h-screen bg-[var(--aura-noir-void)] text-[var(--aura-chrome-bright)]">
        <PageHeader brand="AURA CAFE" scrollEffect />

        <main className="pt-32 pb-24 px-5 md:px-16 max-w-[1440px] mx-auto grid grid-cols-12 gap-6">
          <LeftColumn cardRefs={cardRefs} copied={copied} />
          <RightColumn cardRefs={cardRefs} copied={copied} onCopyCode={handleCopyCode} />
        </main>

        <PageFooter
          brand="AURA CAFE"
          socialLinks={["IG", "FB", "TT"].map(s => ({ label: s }))}
          socialSize="sm"
        />
      </div>
    </StitchShell>
  );
}
