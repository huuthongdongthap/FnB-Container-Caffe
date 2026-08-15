import { useEffect, useRef } from 'react';
import { StitchShell } from '../StitchBase';
import { GrainCanvas } from './about-grain-canvas';
import { AboutHeader } from './about-header';
import { AboutHero } from './about-hero';
import { AboutPhilosophy } from './about-philosophy';
import { AboutStats } from './about-stats';
import { AboutTimeline } from './about-timeline';
import { AboutFooter } from './about-footer';

export type { TimelineStep, StatItem, SocialLink } from './about-types';

export default function OurStory() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const cards = document.querySelectorAll('.story-reveal');
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-10');
          }
        });
      },
      { threshold: 0.15 },
    );

    cards.forEach((card) => observerRef.current?.observe(card));

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <StitchShell>
      <GrainCanvas />
      <AboutHeader />
      <AboutHero />
      <AboutPhilosophy />
      <AboutStats />
      <AboutTimeline />
      <AboutFooter />

      <style>{`
        .story-reveal {
          transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </StitchShell>
  );
}
