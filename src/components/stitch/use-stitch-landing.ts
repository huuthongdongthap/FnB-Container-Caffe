import { useEffect, useRef } from 'react';

/**
 * Manages the glass-panel glow effect that follows the mouse cursor.
 * Applies a radial gradient border-image to all [data-glass-panel] elements
 * within the container, creating an interactive chrome highlight.
 */
export function useGlassPanelEffect() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const glassPanels = containerRef.current?.querySelectorAll('[data-glass-panel]');
      if (!glassPanels) return;
      glassPanels.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        if (
          localX > -100 &&
          localX < rect.width + 100 &&
          localY > -100 &&
          localY < rect.height + 100
        ) {
          (el as HTMLElement).style.borderImage =
            `radial-gradient(circle at ${localX}px ${localY}px, color-mix(in srgb, var(--aura-chrome-bright) 40%, transparent) 0%, transparent 100%) 1`;
        }
      });
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return containerRef;
}
