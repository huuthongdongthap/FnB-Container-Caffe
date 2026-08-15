'use client';

import { useState } from 'react';
import { StitchShell, StitchNav } from '../StitchBase';
import { useScrollReveal } from './our-story-hooks';
import { HeroSection } from './our-story-hero';
import { StorySection } from './our-story-story';
import { TimelineSection } from './our-story-timeline';
import { ValuesSection } from './our-story-values';
import { TeamSection } from './our-story-team';
import { CtaSection } from './our-story-cta';
import { Footer } from './our-story-footer';

// Re-export types for external consumers
export type { TimelineItem, TeamMember } from './our-story-data';
export { TIMELINE, TEAM, HERO_BG } from './our-story-data';

export default function OurStoryPage() {
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);

  useScrollReveal();

  return (
    <StitchShell>
      <StitchNav ctaLabel="Order Now" />

      <main>
        <HeroSection />
        <StorySection />
        <TimelineSection />
        <ValuesSection />
        <TeamSection />
        <CtaSection />
      </main>

      <Footer />
    </StitchShell>
  );
}
