/**
 * Custom hooks for StitchGalleryNew
 */

import { useEffect } from 'react';
import type { FilterId } from './StitchGalleryNew-types';

/**
 * Manages scroll-reveal animation for gallery cards.
 * Re-triggers on filter change with staggered delays.
 */
export function useScrollReveal(
  gridRef: React.RefObject<HTMLDivElement | null>,
  activeFilter: FilterId,
) {
  useEffect(() => {
    const handleScroll = () => {
      const cards = gridRef.current?.querySelectorAll('[data-gallery-card]');
      if (!cards) return;
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        if (rect.top < window.innerHeight - 100) {
          (card as HTMLElement).style.opacity = '1';
          (card as HTMLElement).style.transform = 'translateY(0)';
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [gridRef]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const cards = gridRef.current?.querySelectorAll('[data-gallery-card]');
      if (!cards) return;
      cards.forEach((card, index) => {
        const el = card as HTMLElement;
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = `all 0.6s cubic-bezier(0.23, 1, 0.32, 1) ${index * 0.1}s`;
        setTimeout(() => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, 50);
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [activeFilter, gridRef]);
}
