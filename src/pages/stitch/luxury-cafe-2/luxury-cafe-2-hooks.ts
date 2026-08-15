import { useState, useCallback, useRef, useEffect } from 'react';

export function useScrollReveal() {
  const [revealed, setRevealed] = useState<Set<number>>(new Set([0]));
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const setRef = useCallback((idx: number, el: HTMLElement | null) => {
    sectionRefs.current[idx] = el;
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(entry.target as HTMLElement);
            if (idx >= 0) {
              setRevealed((prev) => {
                const next = new Set(prev);
                next.add(idx);
                return next;
              });
            }
          }
        });
      },
      { threshold: 0.1 },
    );

    sectionRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return { revealed, setRef };
}
