'use client';

import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { LandingFooter } from '@/components/stitch/StitchLandingNew-footer';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useScrollReveal } from './our-story-hooks';
import { HeroSection } from './our-story-hero';
import { StorySection } from './our-story-story';
import { TimelineSection } from './our-story-timeline';
import { ValuesSection } from './our-story-values';
import { TeamSection } from './our-story-team';
import { CtaSection } from './our-story-cta';

// Re-export types for external consumers
export type { TimelineItem, TeamMember } from './our-story-data';
export { TIMELINE, TEAM, HERO_BG } from './our-story-data';

export default function OurStoryPage() {
  useScrollReveal();

  return (
    <div className="relative min-h-screen bg-[var(--aura-noir-deep,#0a1a2e)] text-[var(--aura-chrome-bright)] selection:bg-[var(--aura-chrome-mid)] selection:text-[#0A1A2E]">
      <HelmetHead
        title="Câu Chuyện AURA CAFE — Kiến Trúc Container Độc Bản"
        description="Khởi nguồn từ năm 2018 tại làng hoa Sa Đéc, Đồng Tháp. Hành trình kiến tạo không gian Luxury Coffee độc bản từ 3 khối container hàng hải."
        canonical="/about"
        ogImage="/photos/IMG_6699.webp"
      />
      <LandingNav />

      <div role="region" aria-label="Câu Chuyện AURA CAFE" className="story-container pt-16">
        <HeroSection />
        <StorySection />
        <TimelineSection />
        <ValuesSection />
        <TeamSection />
        <CtaSection />
      </div>

      <LandingFooter />
    </div>
  );
}
