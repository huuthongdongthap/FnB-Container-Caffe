'use client';

import { useEffect } from 'react';

export function useScrollReveal() {
  useEffect(() => {
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

    document.querySelectorAll('.glass-card').forEach((card) => {
      card.classList.add('transition-all', 'duration-1000', 'opacity-0', 'translate-y-10');
      observer.observe(card);
    });

    return () => observer.disconnect();
  }, []);
}
