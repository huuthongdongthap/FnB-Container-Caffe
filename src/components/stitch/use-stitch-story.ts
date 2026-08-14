/**
 * useScrollReveal — IntersectionObserver hook for scroll-triggered fade-in.
 *
 * Finds all [data-reveal] elements, sets them to opacity-0 + translate-y-10,
 * then reveals them when they enter the viewport (threshold 0.1).
 */

import { useEffect } from 'react';

export function useScrollReveal() {
  useEffect(() => {
    const observerOptions: IntersectionObserverInit = { threshold: 0.1 };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-10');
        }
      });
    }, observerOptions);

    const els = document.querySelectorAll('[data-reveal]');
    els.forEach((el) => {
      (el as HTMLElement).classList.add('transition-all', 'duration-1000', 'opacity-0', 'translate-y-10');
      observer.observe(el);
    });

    return () => {
      els.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, []);
}
