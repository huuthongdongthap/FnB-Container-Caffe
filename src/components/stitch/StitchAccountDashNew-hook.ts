/**
 * useDashMicroInteractions — glass card mouse tracking + touch scale effects
 * Extracted from StitchAccountDashNew to keep parent under 200 LOC.
 */
import { useEffect, useRef, useCallback } from 'react';

export function useDashMicroInteractions() {
  const glassCardRefs = useRef<(HTMLElement | null)[]>([]);

  const setGlassCardRef = useCallback((el: HTMLElement | null) => {
    if (el && !glassCardRefs.current.includes(el)) {
      glassCardRefs.current.push(el);
    }
  }, []);

  useEffect(() => {
    const cards = glassCardRefs.current.filter(Boolean) as HTMLElement[];
    const mouseListeners: { el: HTMLElement; handler: (e: MouseEvent) => void }[] = [];

    cards.forEach((card) => {
      const handler = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      };
      mouseListeners.push({ el: card, handler });
      card.addEventListener('mousemove', handler);
    });

    const handleTouchStart = (e: Event) => {
      (e.currentTarget as HTMLElement).classList.add('scale-95');
    };
    const handleTouchEnd = (e: Event) => {
      (e.currentTarget as HTMLElement).classList.remove('scale-95');
    };

    const touchElements = document.querySelectorAll<HTMLElement>('button, a');
    const touchListeners: { el: HTMLElement; startHandler: (e: Event) => void; endHandler: (e: Event) => void }[] = [];
    touchElements.forEach((el) => {
      const startHandler = (e: Event) => handleTouchStart(e);
      const endHandler = (e: Event) => handleTouchEnd(e);
      touchListeners.push({ el, startHandler, endHandler });
      el.addEventListener('touchstart', startHandler);
      el.addEventListener('touchend', endHandler);
    });

    return () => {
      mouseListeners.forEach(({ el, handler }) => el.removeEventListener('mousemove', handler));
      touchListeners.forEach(({ el, startHandler, endHandler }) => {
        el.removeEventListener('touchstart', startHandler);
        el.removeEventListener('touchend', endHandler);
      });
    };
  }, []);

  return { setGlassCardRef };
}
