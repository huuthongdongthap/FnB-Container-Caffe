import { useEffect, useRef } from 'react';

/**
 * Applies a 3D parallax tilt effect to all elements with `data-glass` attribute.
 * Tracks mouse position and applies perspective transforms on mousemove,
 * resetting on mouseleave. Initialized once per mount.
 */
export function useParallaxGlass() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const cards = document.querySelectorAll('[data-glass]');
    if (cards.length === 0) return;

    const moveHandler = (card: Element) => (e: Event) => {
      const rect = card.getBoundingClientRect();
      const me = e as MouseEvent;
      const x = me.clientX - rect.left;
      const y = me.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 25;
      const rotateY = (centerX - x) / 25;
      (card as HTMLElement).style.transform =
        `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const leaveHandler = (card: Element) => () => {
      (card as HTMLElement).style.transform =
        'perspective(1000px) rotateX(0) rotateY(0)';
    };

    const handlers = new Map<Element, [EventListenerOrEventListenerObject, EventListenerOrEventListenerObject]>();

    cards.forEach((card) => {
      const move = moveHandler(card);
      const leave = leaveHandler(card);
      handlers.set(card, [move, leave]);
      card.addEventListener('mousemove', move);
      card.addEventListener('mouseleave', leave);
    });

    return () => {
      handlers.forEach(([move, leave], card) => {
        card.removeEventListener('mousemove', move);
        card.removeEventListener('mouseleave', leave);
      });
      handlers.clear();
    };
  }, []);
}
