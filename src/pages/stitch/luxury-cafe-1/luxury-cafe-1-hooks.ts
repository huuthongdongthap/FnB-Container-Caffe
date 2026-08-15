import { useState, useEffect } from 'react';

export function useReveal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      const panels = document.querySelectorAll('[data-reveal]');
      panels.forEach((panel) => {
        const rect = panel.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.8) {
          (panel as HTMLElement).style.opacity = '1';
          (panel as HTMLElement).style.transform = 'translateY(0)';
        }
      });
    };

    // Initial hidden state
    document.querySelectorAll('[data-reveal]').forEach((panel) => {
      (panel as HTMLElement).style.opacity = '0';
      (panel as HTMLElement).style.transform = 'translateY(20px)';
      (panel as HTMLElement).style.transition = 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)';
    });

    window.addEventListener('scroll', handler, { passive: true });
    window.dispatchEvent(new Event('scroll'));

    return () => window.removeEventListener('scroll', handler);
  }, []);

  return visible;
}
