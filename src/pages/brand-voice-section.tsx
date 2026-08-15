import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';

export function BrandVoiceSection() {
 const { t } = useTranslation();

 const BRAND_RULES_DO = [
  t('brand.rules.do1'),
  t('brand.rules.do2'),
  t('brand.rules.do3'),
  t('brand.rules.do4'),
  t('brand.rules.do5'),
 ];

 const BRAND_RULES_DONT = [
  t('brand.rules.dont1'),
  t('brand.rules.dont2'),
  t('brand.rules.dont3'),
  t('brand.rules.dont4'),
  t('brand.rules.dont5'),
 ];

 return (
  <section className="mb-16 scroll-mt-20" id="brand-voice">
   <div className="mb-8">
    <h2 className="font-display text-2xl font-bold text-[color:var(--aura-chrome-bright)]">
     Brand Voice &amp; Rules
    </h2>
    <p className="mt-2 text-[color:var(--aura-chrome-bright)]">
     {t('brand.voice.description')}
    </p>
   </div>

   <div className="grid gap-6 md:grid-cols-2">
    <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
     <h3 className="font-display text-lg font-semibold text-green-600">{t('brand.voice.doTitle')}</h3>
     <ul className="mt-3 space-y-2">
      {BRAND_RULES_DO.map((rule) => (
       <li key={rule} className="flex items-start gap-2 text-sm text-[color:var(--aura-chrome-bright)]">
        <span className="mt-0.5 shrink-0 text-green-500" aria-hidden="true"><Check size={16} className="inline text-green-500" /></span>
        {rule}
       </li>
      ))}
     </ul>
    </div>
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
     <h3 className="font-display text-lg font-semibold text-red-400">{t('brand.voice.dontTitle')}</h3>
     <ul className="mt-3 space-y-2">
      {BRAND_RULES_DONT.map((rule) => (
       <li key={rule} className="flex items-start gap-2 text-sm text-[color:var(--aura-chrome-bright)]">
        <span className="mt-0.5 shrink-0 text-red-400" aria-hidden="true"><X size={16} className="inline text-red-400" /></span>
        {rule}
       </li>
      ))}
     </ul>
    </div>
   </div>

   <div className="mt-6 rounded-2xl border border-white/[0.1] bg-[color:var(--aura-surface-container)]/5 p-6 text-center">
    <p className="font-display text-xl font-semibold text-[color:var(--aura-chrome-bright)]">
     {t('brand.voice.slogan')}
    </p>
    <p className="mt-1 text-sm text-[color:var(--aura-chrome-bright)]">
     {t('brand.voice.subSlogan')}
    </p>
   </div>
  </section>
 );
}
