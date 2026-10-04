import { useTranslation } from 'react-i18next';
import { ShoppingBag, ArrowRight } from 'lucide-react';

export function EmptyCartState() {
  const { t } = useTranslation();

  return (
    <section
      className="flex min-h-screen items-center justify-center bg-[#0A1A2E] text-[var(--aura-chrome-bright)] px-4 py-20"
      role="status"
      aria-label={t('stitch.emptyCartTitle', 'Your cart is empty')}
    >
      <div className="flex flex-col items-center gap-6 max-w-md w-full p-8 sm:p-12 rounded-[32px] bg-white/5 backdrop-blur-[12px] border border-white/10 text-center shadow-2xl">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--aura-chrome-mid)]/10 border border-[var(--aura-chrome-mid)]/30 text-[var(--aura-chrome-bright)] shadow-inner">
          <ShoppingBag className="w-9 h-9" aria-hidden="true" />
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--aura-chrome-mid)] block mb-2 font-body">
            {t('stitch.emptyCartBadge', 'GIỎ HÀNG TRỐNG')}
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-medium text-white mb-3">
            {t('stitch.emptyCartTitle', 'Giỏ Hàng Của Bạn Đang Trống')}
          </h2>
          <p className="text-sm text-[var(--aura-chrome-soft)] font-body font-light leading-relaxed">
            {t('stitch.emptyCartDesc', 'Bạn chưa chọn món nào. Hãy khám phá thực đơn cà phê mộc và đồ uống thủ công của AURA CAFE Sa Đéc nhé!')}
          </p>
        </div>
        <a
          href="/menu"
          className="btn-primary inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full bg-[var(--aura-chrome-bright)] hover:bg-white text-[var(--aura-noir-deep)] font-body text-xs font-bold uppercase tracking-widest transition-all shadow-xl active:scale-95"
        >
          <span>{t('stitch.exploreMenu', 'Khám Phá Thực Đơn')}</span>
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </section>
  );
}
