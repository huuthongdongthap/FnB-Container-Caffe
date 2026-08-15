import { StitchShell, StitchNav } from '../StitchBase';
import { useReveal } from './luxury-cafe-1-hooks';
import { Nav, HeroSection } from './luxury-cafe-1-nav-hero';
import { AestheticSection } from './luxury-cafe-1-aesthetic';
import { LoungeSection } from './luxury-cafe-1-lounge';
import { MenuSection } from './luxury-cafe-1-menu';
import { Footer } from './luxury-cafe-1-footer';

// Re-exports for backward compatibility
export type { MenuItem, LoungeFeature } from './luxury-cafe-1-types';
export { MENU_ITEMS, LOUNGE_FEATURES } from './luxury-cafe-1-constants';
export { useReveal } from './luxury-cafe-1-hooks';
export { Nav, HeroSection } from './luxury-cafe-1-nav-hero';
export { AestheticSection } from './luxury-cafe-1-aesthetic';
export { LoungeSection } from './luxury-cafe-1-lounge';
export { MenuSection } from './luxury-cafe-1-menu';
export { Footer } from './luxury-cafe-1-footer';

/* ── Main exported page ──────────────────────────────────────────── */
export default function LuxuryContainerCafe1() {
  useReveal();

  return (
    <StitchShell>
      <StitchNav ctaLabel="Reservation" />
      <Nav />
      <HeroSection />
      <main className="max-w-[1200px] mx-auto px-5 md:px-16 py-20 space-y-20">
        <AestheticSection />
        <LoungeSection />
        <MenuSection />
      </main>
      <Footer />
    </StitchShell>
  );
}
