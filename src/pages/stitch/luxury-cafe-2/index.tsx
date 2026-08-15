'use client';

import { useScrollReveal } from './luxury-cafe-2-hooks';
import {
  StitchShell,
  Nav,
  Hero,
  Features,
  Atmosphere,
  MenuTeaser,
  Footer,
} from './luxury-cafe-2-components';

// Re-export extracted modules for backward compatibility
export { useScrollReveal } from './luxury-cafe-2-hooks';
export {
  StitchShell,
  Nav,
  Hero,
  Features,
  Atmosphere,
  MenuTeaser,
  Footer,
} from './luxury-cafe-2-components';
export {
  NAV_LINKS,
  FEATURES,
  MENU_ITEMS,
  FOOTER_LINKS,
} from './luxury-cafe-2-constants';

/* ── Page ───────────────────────────────────────────────────────────── */

export default function LuxuryContainerCafe2() {
  const { revealed, setRef } = useScrollReveal();

  return (
    <StitchShell>
      <Nav />
      <main className="pt-24">
        <Hero />
        <Features revealed={revealed} setRef={setRef} />
        <Atmosphere revealed={revealed} setRef={setRef} />
        <MenuTeaser revealed={revealed} setRef={setRef} />
      </main>
      <Footer />
    </StitchShell>
  );
}
