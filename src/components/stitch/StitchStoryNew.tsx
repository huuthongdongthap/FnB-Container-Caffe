/**
 * StitchStoryNew — AURA CAFE Our Story (pixel-perfect Stitch HTML conversion)
 *
 * IDENTICAL match to: stitch-exports/stitch_aura_cafe/aura_cafe_our_story/code.html
 * Dark navy glassmorphism story page with hero, bento story grid,
 * vertical timeline, values cards, team section, CTA banner, and footer.
 *
 * RULES followed:
 * - Mapped to AURA custom design tokens for theming consistency
 * - EXACT Tailwind classes from HTML (converted to arbitrary values for custom theme tokens)
 * - EXACT font stacks from HTML
 * - EXACT layout structure, spacing, and nesting
 * - i18n wrapping via t("key", {defaultValue})
 * - lucide-react icons instead of material-symbols-outlined
 *
 * Modularized: types, hook, data, and sub-components extracted to sibling files.
 */
'use client';

import { Helmet } from 'react-helmet-async';

/* ─── Re-export types for backward compatibility ─────────────────────── */
export type { TeamMember, StitchStoryNewProps } from './StitchStoryNew-types';

/* ─── Sub-components ────────────────────────────────────────────────── */
import { NavBar, HeroSection } from './StitchStoryNew-hero';
import { StorySection } from './StitchStoryNew-story';
import { TimelineSection } from './StitchStoryNew-timeline';
import { ValuesSection } from './StitchStoryNew-values';
import { TeamSection } from './StitchStoryNew-team';
import { CtaSection, FooterSection } from './StitchStoryNew-footer';

/* ─── Hook + Data ───────────────────────────────────────────────────── */
import { useScrollReveal } from './use-stitch-story';
import { defaultHeroBgUrl, defaultTeamMembers } from './stitch-story-default';
import type { StitchStoryNewProps } from './StitchStoryNew-types';

/* ─── Main Component ─────────────────────────────────────────────────── */

export function StitchStoryNew({
  heroBgUrl = defaultHeroBgUrl,
  teamMembers = defaultTeamMembers,
  onCtaClick,
  onNavClick,
}: Readonly<StitchStoryNewProps>) {
  useScrollReveal();

  return (
    <>
      <Helmet>
        <title>Khong Gian Container — AURA CAFE Sa Dec | AURA CAFE</title>
      </Helmet>
      <div
        className="min-h-screen overflow-x-hidden selection:bg-[var(--aura-chrome-bright)] selection:text-black dark"
        style={{
          backgroundColor: 'var(--aura-surface-container)',
          color: 'var(--aura-text-primary)',
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <NavBar onNavClick={onNavClick} />

        <main>
          <HeroSection bgImageUrl={heroBgUrl} />
          <StorySection />
          <TimelineSection />
          <ValuesSection />
          <TeamSection members={teamMembers} />
          <CtaSection onCtaClick={onCtaClick} />
        </main>

        <FooterSection />
      </div>
    </>
  );
}

export default StitchStoryNew;
