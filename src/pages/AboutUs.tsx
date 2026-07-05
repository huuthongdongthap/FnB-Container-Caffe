'use client';

import React from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StitchStoryNew } from '@/components/stitch';

export type { StitchStoryNewProps, TeamMember } from '@/components/stitch';

export function AboutUs() {
  return (
    <>
      <HelmetHead
        title="About Us — AURA CAFE"
        description="About AURA CAFE - Container industrial-luxury cafe in Sa Dec. Gioi thieu AURA CAFE - quan ca phe container tai Sa Dec, Dong Thap."
      />
      <StitchStoryNew />
    </>
  );
}

export default AboutUs;
