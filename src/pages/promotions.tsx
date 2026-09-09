import { usePromotions } from '@/hooks/use-promotions';
import { PromotionCard } from '@/components/promotions/promotion-card';
import { Card, Skeleton } from '@/components/ui';
import { Building, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';

export function PromotionsPage() {
 const { t } = useTranslation();
 const { data: promotions, isLoading, isError, refetch } = usePromotions();

 return (
 <>
  <HelmetHead
    title={t('promotions.seoTitle')}
    description={t('promotions.seoDescription')}
    canonical="/promotions"
  />
  <div className="bg-[color:var(--aura-noir-deep)] text-[color:var(--aura-chrome-bright)] mx-auto max-w-5xl px-4 py-24">
 {/* Hero */}
 <section className="mb-12 text-center">
 <div className="mb-4 inline-flex rounded-full bg-[color:var(--aura-chrome-bright)]/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-[color:var(--aura-chrome-bright)]">
 {t('promotions.hero.badge')}
 </div>
 <h1 className="mb-4 font-display text-4xl font-bold md:text-5xl">
 {t('promotions.hero.titlePrefix')} <span className="text-[color:var(--aura-chrome-bright)]">{t('promotions.hero.titleHighlight')}</span> {t('promotions.hero.titleSuffix')}
 </h1>
 <p className="mx-auto mb-8 max-w-lg text-[color:var(--aura-chrome-bright)]/70">
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
 <p className="mb-4 text-sm text-[color:var(--aura-chrome-bright)]/60">{t('promotions.error.description')}</p>
 <button
 type="button"
 onClick={() => refetch()}
 className="rounded-full border border-white/[0.2] px-6 py-2 text-sm text-[color:var(--aura-chrome-bright)] transition-all hover:bg-[color:var(--aura-chrome-bright)]/10"
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
 <p className="text-sm text-[color:var(--aura-chrome-bright)]/60">{t('promotions.empty.description')}</p>
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

  {/* Membership & Cashback Highlight */}
  <section className="mb-12">
    <Card className="p-8 border border-[rgba(var(--aura-chrome-light),0.2)] bg-gradient-to-br from-[var(--aura-noir-deep)] to-[rgba(var(--aura-chrome-light),0.05)] rounded-2xl">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-[color:var(--aura-chrome-bright)]/80 mb-2 inline-block">
          Chương Trình Khách Hàng Thân Thiết
        </span>
        <h3 className="font-display text-2xl md:text-3xl font-bold text-[color:var(--aura-chrome-bright)] mb-3">
          Tích Lũy Điểm & Hoàn Tiền Đến 10%
        </h3>
        <p className="text-sm text-[color:var(--aura-chrome-bright)]/70">
          Chỉ cần nhập số điện thoại khi đặt đồ uống online hoặc tại quầy. Tự động nâng hạng và hoàn tiền vào ví cho mỗi đơn hàng.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
          <div className="text-sm font-bold text-[#cd7f32] mb-1">Đồng (Bronze)</div>
          <div className="text-lg font-bold text-white">1.0x</div>
          <div className="text-xs text-[color:var(--aura-chrome-bright)]/60 mt-1">Hoàn 3% ví</div>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
          <div className="text-sm font-bold text-[#c0c0c0] mb-1">Bạc (Silver)</div>
          <div className="text-lg font-bold text-white">1.1x</div>
          <div className="text-xs text-[color:var(--aura-chrome-bright)]/60 mt-1">Hoàn 5% ví</div>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
          <div className="text-sm font-bold text-[#ffd700] mb-1">Vàng (Gold)</div>
          <div className="text-lg font-bold text-white">1.3x</div>
          <div className="text-xs text-[color:var(--aura-chrome-bright)]/60 mt-1">Hoàn 7% ví</div>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
          <div className="text-sm font-bold text-[#e5e4e2] mb-1">Bạch Kim (Platinum)</div>
          <div className="text-lg font-bold text-white">1.5x</div>
          <div className="text-xs text-[color:var(--aura-chrome-bright)]/60 mt-1">Hoàn 10% ví</div>
        </div>
      </div>

      <div className="text-center">
        <a
          href="/loyalty"
          className="inline-flex items-center justify-center rounded-full bg-[color:var(--aura-chrome-bright)] px-6 py-2.5 text-sm font-medium text-black transition-all hover:bg-[color:var(--aura-chrome-bright)]/90"
        >
          Xem Chi Tiết Hạng Thẻ & Tra Cứu Ví
        </a>
      </div>
    </Card>
  </section>

 {/* How to Use */}
 <section>
 <Card className="p-8 text-center">
 <h2 className="mb-6 font-display text-2xl font-bold">{t('promotions.howToUse.title')}</h2>
 <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-3">
 <div>
 <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--aura-chrome-bright)]/10 text-lg font-bold text-[color:var(--aura-chrome-bright)]">
 1
 </div>
 <h3 className="font-display text-base font-bold">{t('promotions.howToUse.step1.title')}</h3>
 <p className="mt-1 text-xs text-[color:var(--aura-chrome-bright)]/60">{t('promotions.howToUse.step1.description')}</p>
 </div>
 <div>
 <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--aura-chrome-bright)]/10 text-lg font-bold text-[color:var(--aura-chrome-bright)]">
 2
 </div>
 <h3 className="font-display text-base font-bold">{t('promotions.howToUse.step2.title')}</h3>
 <p className="mt-1 text-xs text-[color:var(--aura-chrome-bright)]/60">{t('promotions.howToUse.step2.description')}</p>
 </div>
 <div>
 <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--aura-chrome-bright)]/10 text-lg font-bold text-[color:var(--aura-chrome-bright)]">
 3
 </div>
 <h3 className="font-display text-base font-bold">{t('promotions.howToUse.step3.title')}</h3>
 <p className="mt-1 text-xs text-[color:var(--aura-chrome-bright)]/60">{t('promotions.howToUse.step3.description')}</p>
 </div>
 </div>
 </Card>
 </section>
 </div>
 </>
 );
}
