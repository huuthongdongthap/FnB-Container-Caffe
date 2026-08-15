'use client';

import { useRef, useEffect, useCallback } from 'react';

import { MOBILE_STYLES } from './mobile-styles';
import { MobileHeader } from './mobile-header';
import { MobileHero } from './mobile-hero';
import { MobileFeatured } from './mobile-featured';
import { MobileMembership } from './mobile-membership';
import { MobileBottomNav } from './mobile-bottom-nav';

// Re-export types for backward compatibility
export type { MenuItem, NavItem } from './mobile-types';

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE ORDERING 2 — AURA CAFE
// ═══════════════════════════════════════════════════════════════════════════
export default function MobileOrdering2() {
  const featuredRef = useRef<HTMLElement>(null);
  const membershipRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── IntersectionObserver for glass-card scroll reveal ─────────────────
  useEffect(() => {
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.15 });

    const observeSection = (el: HTMLElement | null) => {
      if (!el) return;
      el.querySelectorAll<HTMLElement>('.glass-card-reveal').forEach((card) => {
        observer.observe(card);
      });
    };

    observeSection(featuredRef.current);
    observeSection(membershipRef.current);

    return () => observer.disconnect();
  }, []);

  // ─── Carousel scroll helper ────────────────────────────────────────────
  const scrollCarousel = useCallback((dir: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[var(--aura-noir-void)] text-[var(--aura-chrome-bright)] font-body overflow-x-hidden pb-28">
      <style>{MOBILE_STYLES}</style>
      <MobileHeader />
      <div className="h-16" />
      <MobileHero />

      {/* Welcome */}
      <section className="px-6 pt-10 pb-4">
        <p className="font-display text-2xl md:text-3xl italic text-[var(--aura-chrome-bright)]">
          Good morning, <span className="text-[var(--aura-chrome-light)]">Julian</span>
        </p>
        <p className="font-body text-sm text-[var(--aura-text-body)] mt-2">
          Your ritual is waiting. / Nghi thức của bạn đã sẵn sàng.
        </p>
      </section>

      <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <MobileFeatured featuredRef={featuredRef} scrollRef={scrollRef} onScroll={scrollCarousel} />
      <MobileMembership membershipRef={membershipRef} />
      <MobileBottomNav />
    </div>
  );
}
