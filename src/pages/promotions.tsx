import { usePromotions } from '@/hooks/use-promotions';
import { PromotionCard } from '@/components/promotions/promotion-card';
import { CountdownTimer } from '@/components/promotions/countdown-timer';
import { Card, Skeleton } from '@/components/ui';
import { Building, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PromotionsPage() {
 const { t } = useTranslation();
 const { data: promotions, isLoading, isError, refetch } = usePromotions();

 return (
 <main className="bg-[#0A1A2E] text-[#e4e2e4] mx-auto max-w-5xl px-4 py-24">
 {/* Hero */}
 <section className="mb-12 text-center">
 <div className="mb-4 inline-flex rounded-full bg-[#b8c7e2]/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-[#b8c7e2]">
 {t('promotions.hero.badge')}
 </div>
 <h1 className="mb-4 font-display text-4xl font-bold md:text-5xl">
 {t('promotions.hero.titlePrefix')} <span className="text-[#b8c7e2]">{t('promotions.hero.titleHighlight')}</span> {t('promotions.hero.titleSuffix')}
 </h1>
 <p className="mx-auto mb-8 max-w-lg text-[#b8c7e2]/70">
 {t('promotions.hero.description')}
 </p>
 </section>

 {/* Loading State */}
 {isLoading && (
 <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
 {[1, 2, 3].map((i) => (
 <Skeleton key={i} className="h-64 w-full rounded-xl" />
 ))}
 </div>
 )}

 {/* Error State */}
 {isError && (
 <Card className="p-10 text-center">
 <span className="mb-3 block text-4xl"><TriangleAlert size={20} className="inline" /></span>
 <h3 className="font-display text-lg font-bold">{t('promotions.error.title')}</h3>
 <p className="mb-4 text-sm text-[#b8c7e2]/60">{t('promotions.error.description')}</p>
 <button
 type="button"
 onClick={() => refetch()}
 className="rounded-full border border-white/[0.2] px-6 py-2 text-sm text-[#b8c7e2] transition-all hover:bg-[#b8c7e2]/10"
 >
 {t('promotions.error.retry')}
 </button>
 </Card>
 )}

 {/* Empty State */}
 {!isLoading && !isError && (!promotions || promotions.length === 0) && (
 <Card className="p-10 text-center">
 <span className="mb-3 block text-4xl"><Building size={28} className="block mx-auto" /></span>
 <h3 className="font-display text-lg font-bold">{t('promotions.empty.title')}</h3>
 <p className="text-sm text-[#b8c7e2]/60">{t('promotions.empty.description')}</p>
 </Card>
 )}

 {/* Promotions Grid */}
 {!isLoading && !isError && promotions && promotions.length > 0 && (
 <section className="mb-12">
 <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
 {promotions.map((promo) => (
 <PromotionCard
 key={promo.id}
 id={promo.id}
 code={promo.code}
 percent={promo.percent}
 maxDiscount={promo.maxDiscount}
 minOrder={promo.minOrder}
 expiresAt={promo.expiresAt}
 usageCount={promo.usageCount}
 usageLimit={promo.usageLimit}
 icon={promo.icon}
 isFeatured={promo.isFeatured}
 />
 ))}
 </div>
 </section>
 )}

 {/* Featured: Countdown + Flash Deals */}
 {!isLoading && !isError && promotions && promotions.length > 0 && (
 <section className="mb-12">
 <Card className="p-6 text-center">
 <h3 className="mb-2 font-display text-xl font-bold">{t('promotions.featured.title')}</h3>
 <div className="flex justify-center">
 <CountdownTimer
 targetDate={
 promotions[0]?.expiresAt ?? '2026-12-31T23:59:59.000Z'
 }
 />
 </div>
 </Card>
 </section>
 )}

 {/* How to Use */}
 <section>
 <Card className="p-8 text-center">
 <h2 className="mb-6 font-display text-2xl font-bold">{t('promotions.howToUse.title')}</h2>
 <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-3">
 <div>
 <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#b8c7e2]/10 text-lg font-bold text-[#b8c7e2]">
 1
 </div>
 <h3 className="font-display text-base font-bold">{t('promotions.howToUse.step1.title')}</h3>
 <p className="mt-1 text-xs text-[#b8c7e2]/60">{t('promotions.howToUse.step1.description')}</p>
 </div>
 <div>
 <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#b8c7e2]/10 text-lg font-bold text-[#b8c7e2]">
 2
 </div>
 <h3 className="font-display text-base font-bold">{t('promotions.howToUse.step2.title')}</h3>
 <p className="mt-1 text-xs text-[#b8c7e2]/60">{t('promotions.howToUse.step2.description')}</p>
 </div>
 <div>
 <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#b8c7e2]/10 text-lg font-bold text-[#b8c7e2]">
 3
 </div>
 <h3 className="font-display text-base font-bold">{t('promotions.howToUse.step3.title')}</h3>
 <p className="mt-1 text-xs text-[#b8c7e2]/60">{t('promotions.howToUse.step3.description')}</p>
 </div>
 </div>
 </Card>
 </section>
 </main>
 );
}
