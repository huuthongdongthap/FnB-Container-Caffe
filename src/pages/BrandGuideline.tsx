import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { ColorPalette } from '@/components/brand/ColorPalette';
import { TypographyShowcase } from '@/components/brand/TypographyShowcase';
import { LogoUsage } from '@/components/brand/LogoUsage';
import { BaziExplanation } from '@/components/brand/BaziExplanation';
import { ZoneColors } from '@/components/brand/ZoneColors';
import { NOIR_COLORS, CHROME_COLORS, FOREST_COLORS } from './brand-guideline-colors';
import { TypeScaleTable } from './type-scale-table';
import { MaterialsSection } from './materials-section';
import { BrandVoiceSection } from './brand-voice-section';

export function BrandGuideline() {
 const { t } = useTranslation();

 const BREADCRUMBS = [
  { label: t('brand.breadcrumbs.home'), to: '/' },
  { label: t('brand.breadcrumbs.brandGuideline'), to: '/brand-guideline' },
 ];

 const FONTS_DATA = [
  { name: 'EB Garamond', category: 'Display', usage: t('brand.fonts.display') },
  { name: 'Space Grotesk', category: 'Body', usage: t('brand.fonts.body') },
  { name: 'Space Grotesk', category: 'Utility', usage: t('brand.fonts.utility') },
 ];

 return (
  <>
   <HelmetHead
    title="Brand Guideline — AURA CAFE"
    description="AURA CAFE brand guidelines and design system. Huong dan thuong hieu va he thong thiet ke AURA CAFE."
   />

   <main id="main-content" className="bg-[color:var(--aura-surface-container)] text-[color:var(--aura-chrome-bright)] mx-auto max-w-6xl px-4 py-8">
    <Breadcrumbs items={BREADCRUMBS} className="mb-8" />

    <section className="mb-16 text-center">
     <div className="mb-2 font-utility text-xs font-semibold uppercase tracking-[4px] text-[color:var(--aura-chrome-bright)]">
      Brand Guideline &middot; v1.0
     </div>
     <h1 className="font-display text-5xl font-bold text-[color:var(--aura-chrome-bright)] md:text-7xl">
      Aura Space
     </h1>
     <p className="mx-auto mt-4 max-w-3xl text-[color:var(--aura-chrome-bright)]">
      {t('brand.hero.descriptionPrefix')}<code className="rounded bg-[color:var(--aura-surface-container)]/10 px-2 py-0.5 font-mono text-xs text-[color:var(--aura-chrome-bright)]">{'水 Thủy — Noir Lounge'}</code>{t('brand.hero.descriptionSuffix')}
     </p>
     <div className="mt-4 flex justify-center gap-4 text-xs text-[color:var(--aura-chrome-bright)]">
      <span>Version 1.0.0</span>
      <span>2026-04-20</span>
      <span>bazi-mcp</span>
     </div>
    </section>

    <section className="mb-16 scroll-mt-20" id="bazi-foundation">
     <BaziExplanation />
    </section>

    <section className="mb-16 scroll-mt-20" id="logo">
     <LogoUsage />
    </section>

    <section className="mb-16 scroll-mt-20" id="colors">
     <div className="mb-8">
      <h2 className="font-display text-2xl font-bold text-[color:var(--aura-chrome-bright)]">
       Color Palette
      </h2>
      <p className="mt-2 text-[color:var(--aura-chrome-bright)]">
       {t('brand.colors.descriptionPrefix')}<code className="ml-1 rounded bg-[color:var(--aura-surface-container)]/10 px-2 py-0.5 font-mono text-xs text-[color:var(--aura-chrome-bright)]">css/brand-tokens.css</code>{t('brand.colors.descriptionSuffix')}
      </p>
     </div>
     <ColorPalette colors={[...NOIR_COLORS, ...CHROME_COLORS, ...FOREST_COLORS]} categories />
    </section>

    <section className="mb-16 scroll-mt-20" id="typography">
     <div className="mb-8">
      <h2 className="font-display text-2xl font-bold text-[color:var(--aura-chrome-bright)]">
       Typography
      </h2>
      <p className="mt-2 text-[color:var(--aura-chrome-bright)]">
       {t('brand.typography.description')}
      </p>
     </div>
     <TypographyShowcase fonts={FONTS_DATA} />
     <TypeScaleTable />
    </section>

    <MaterialsSection />
    <BrandVoiceSection />

    <section className="mb-16 scroll-mt-20" id="zone-colors">
     <ZoneColors />
    </section>
   </main>
  </>
 );
}
