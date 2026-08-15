import { useTranslation } from 'react-i18next';

export function MaterialsSection() {
 const { t } = useTranslation();

 const MATERIALS = [
  { name: 'Corten Steel', desc: t('brand.materials.cortenSteelDesc'), spec: 'Finish: weathered natural' },
  { name: 'Walnut Oak Wood', desc: t('brand.materials.walnutOakDesc'), spec: 'Oil: Osmo Polyx' },
  { name: 'Smoked Brass', desc: t('brand.materials.smokedBrassDesc'), spec: 'Finish: antique smoked' },
  { name: 'Black Terrazzo', desc: t('brand.materials.blackTerrazzoDesc'), spec: 'Size: 600x600mm' },
 ];

 return (
  <section className="mb-16 scroll-mt-20" id="materials">
   <div className="mb-8">
    <h2 className="font-display text-2xl font-bold text-[color:var(--aura-chrome-bright)]">
     Materials &amp; Texture
    </h2>
    <p className="mt-2 text-[color:var(--aura-chrome-bright)]">
     {t('brand.materials.description')}
    </p>
   </div>

   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {MATERIALS.map((material) => (
     <div key={material.name} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl p-6">
      <h3 className="font-display text-lg font-semibold text-[color:var(--aura-chrome-bright)]">{material.name}</h3>
      <p className="mt-2 text-sm text-[color:var(--aura-chrome-bright)]">{material.desc}</p>
      <p className="mt-3 text-xs text-[color:var(--aura-chrome-bright)]">{material.spec}</p>
     </div>
    ))}
   </div>
  </section>
 );
}
