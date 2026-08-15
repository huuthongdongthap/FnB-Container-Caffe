import { useEffect, useRef, useState } from 'react';
import { StitchHeroNewNavbar } from './StitchHeroNew-navbar';
import { StitchHeroNewHero } from './StitchHeroNew-hero';
import { StitchHeroNewFeatures } from './StitchHeroNew-features';
import { StitchHeroNewVisualTeaser } from './StitchHeroNew-visual-teaser';
import { StitchHeroNewFooter } from './StitchHeroNew-footer';
import { DEFAULT_BG_IMAGE, type StitchHeroNewProps } from './StitchHeroNew-types';

export type { StitchHeroNewProps } from './StitchHeroNew-types';

export function StitchHeroNew({
  bgImageUrl = DEFAULT_BG_IMAGE,
  brandName = 'AURA CAFE',
}: Readonly<StitchHeroNewProps>) {
  const [navVisible, setNavVisible] = useState(true);
  const glassRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll-based nav hide/show
  useEffect(() => {
    let lastScrollTop = 0;
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      if (scrollTop > lastScrollTop && scrollTop > 100) {
        setNavVisible(false);
      } else {
        setNavVisible(true);
      }
      lastScrollTop = scrollTop;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Glass panel mousemove effect
  useEffect(() => {
    const panels = glassRefs.current.filter(Boolean) as HTMLElement[];
    const handler = (e: MouseEvent) => {
      const panel = e.currentTarget as HTMLElement;
      const rect = panel.getBoundingClientRect();
      panel.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      panel.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    };
    panels.forEach((p) => p.addEventListener('mousemove', handler));
    return () => panels.forEach((p) => p.removeEventListener('mousemove', handler));
  }, []);

  const setGlassRef =
    (i: number): ((el: HTMLDivElement | null) => void) =>
    (el) => {
      glassRefs.current[i] = el;
    };

  return (
    <>
      <StitchHeroNewNavbar brandName={brandName} navVisible={navVisible} />
      <StitchHeroNewHero />
      <StitchHeroNewFeatures setGlassRef={setGlassRef} />
      <StitchHeroNewVisualTeaser bgImageUrl={bgImageUrl} />
      <StitchHeroNewFooter brandName={brandName} />
    </>
  );
}
