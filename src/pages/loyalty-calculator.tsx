import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { LoyaltyCalculator } from '@/components/loyalty/loyalty-calculator';
import { Link } from 'react-router-dom';

export function LoyaltyCalculatorPage() {
  const { t } = useTranslation();
 return (
 <>
  <HelmetHead
    title={t('loyaltyCalcPage.seoTitle')}
    description={t('loyaltyCalcPage.seoDescription')}
    canonical="/loyalty-calculator"
  />
  <div className="bg-[color:var(--st-primary-container)] text-[color:var(--st-on-surface)] mx-auto max-w-5xl px-4 py-24">
 {/* Header */}
 <div className="mb-10 text-center">
 <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.15] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--st-primary)]">
 AURA CAFE &bull; Sa Dec
 </div>
 <h1 className="mb-4 font-display text-3xl font-bold md:text-4xl">
  {t('loyaltyCalcPage.title')}
 </h1>
 <p className="mx-auto mb-6 max-w-2xl text-sm text-[color:var(--st-primary)]/60">
  {t('loyaltyCalcPage.description')}
 </p>

 <div className="flex flex-wrap justify-center gap-3 text-xs">
 <Link
 to="/loyalty"
 className="text-[color:var(--st-primary)] underline-offset-2 hover:underline"
 >
 {t('loyaltyCalcPage.customerLoyalty')}
 </Link>
 </div>
 </div>

 {/* Calculator Component */}
 <LoyaltyCalculator />

 {/* Footer note */}
 <footer className="mt-16 text-center text-xs text-[color:var(--st-primary)]/40">
 <p>AURA CAFE Sa Dec &bull; He Thong Quan Ly Tai Chinh &amp; Van Hanh Tu Dong</p>
 </footer>
 </div>
 </>
 );
}
