/**
 * IntersectionObserver-based scroll animation for StitchContainerNew2 sections.
 * Adds fade-in + translate-up on scroll, initializes hero as visible.
 */
'use client';

import { useEffect, useRef } from 'react';

export function useStitchScrollAnimation() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = rootRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-10');
          }
        });
      },
      { threshold: 0.1 },
    );

    const sections = container.querySelectorAll('section');
    sections.forEach((section) => {
      section.classList.add('transition-all', 'duration-1000', 'opacity-0', 'translate-y-10');
      observer.observe(section);
    });

    // Initialize immediately for first section (hero)
    const first = sections[0];
    if (first) {
      first.classList.remove('opacity-0', 'translate-y-10');
      first.classList.add('opacity-100', 'translate-y-0');
    }

    return () => observer.disconnect();
  }, []);

  return { rootRef };
}
