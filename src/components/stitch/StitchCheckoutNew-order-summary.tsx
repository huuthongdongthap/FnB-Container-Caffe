import { useTranslation } from 'react-i18next';
import { Minus, Plus, Trash2, Coffee } from 'lucide-react';
import { cn } from '@/lib/cn';
import { glassPanelBg, formatPrice } from './StitchCheckoutNew-utils';
import type { CheckoutNewSummary } from './StitchCheckoutNew-types';

interface OrderSummaryPanelProps {
  summary: CheckoutNewSummary;
  locale: string;
  onUpdateQuantity?: (id: string, quantity: number) => void;
  onRemoveItem?: (id: string) => void;
  onClearCart?: () => void;
}

export function OrderSummaryPanel({
  summary,
  locale,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}: Readonly<OrderSummaryPanelProps>) {
  const { t } = useTranslation();
  const totalItemCount = summary.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="lg:col-span-5">
      <div
        className={cn(
          glassPanelBg,
          'rounded-2xl p-6 sm:p-8 sticky top-28 border border-[rgba(var(--aura-chrome-light),0.2)] shadow-2xl backdrop-blur-[16px]',
        )}
      >
        <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--aura-chrome-dim)_20%,transparent)] pb-4 mb-6">
          <div>
            <h3 className="font-display text-[26px] sm:text-[28px] leading-[1.2] font-semibold text-[var(--aura-chrome-bright)]">
              {t('stitch.orderSummary', 'Tóm Tắt Đơn Hàng')}
            </h3>
            <span className="font-body text-xs text-[var(--aura-chrome-soft)] uppercase tracking-wider">
              {totalItemCount} {t('stitch.items', 'món đã chọn')}
            </span>
          </div>

          {onClearCart && summary.items.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="text-xs text-[var(--aura-chrome-mid)] hover:text-rose-400 font-body flex items-center gap-1.5 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10 cursor-pointer"
              title="Xóa toàn bộ món khỏi giỏ hàng"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xóa tất cả</span>
            </button>
          )}
        </div>

        {/* Item List */}
        <div className="space-y-4 mb-6 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
          {summary.items.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[var(--aura-chrome-mid)]/20 transition-all flex flex-col gap-3 group"
            >
              <div className="flex items-start gap-3.5">
                {/* Image */}
                {item.imageUrl ? (
                  <div
                    className="w-14 h-14 shrink-0 rounded-lg bg-cover bg-center border border-white/10"
                    style={{ backgroundImage: `url(${item.imageUrl})` }}
                    role="img"
                    aria-label={item.name}
                  />
                ) : (
                  <div className="w-14 h-14 shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[var(--aura-chrome-mid)]">
                    <Coffee className="w-6 h-6" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-body text-base font-medium text-white leading-snug truncate">
                    {item.name}
                  </h4>
                  <span className="text-xs text-[var(--aura-chrome-soft)] uppercase tracking-widest font-body block mt-0.5">
                    {item.variant}
                    {' • '}
                    {item.quantity}x
                  </span>
                  <span className="text-xs text-[var(--aura-chrome-mid)] font-mono block mt-1">
                    Đơn giá: {formatPrice(item.price, locale)}
                  </span>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() =>
                    onRemoveItem
                      ? onRemoveItem(item.id)
                      : onUpdateQuantity?.(item.id, 0)
                  }
                  className="p-1.5 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer shrink-0"
                  title="Xóa món này"
                  aria-label={`Xóa ${item.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Quantity Stepper & Line Total */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg p-1">
                  {item.quantity === 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        onRemoveItem
                          ? onRemoveItem(item.id)
                          : onUpdateQuantity?.(item.id, 0)
                      }
                      className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-md bg-white/5 hover:bg-rose-500/20 text-white/50 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                      title="Xóa món"
                      aria-label="Xóa món"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateQuantity?.(item.id, item.quantity - 1)
                      }
                      className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-md bg-white/5 hover:bg-white/15 text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                      title="Giảm 1"
                      aria-label="Giảm 1"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}

                  <span
                    className="font-mono text-sm font-bold text-white min-w-[32px] text-center"
                    aria-live="polite"
                  >
                    {item.quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateQuantity?.(item.id, item.quantity + 1)
                    }
                    className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-md bg-white/5 hover:bg-white/15 text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                    title="Tăng 1"
                    aria-label="Tăng 1"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <span className="font-mono text-base font-bold text-[var(--aura-chrome-bright)] whitespace-nowrap">
                  {formatPrice(item.price * item.quantity, locale)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Add More Items Link */}
        <a
          href="/menu"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[var(--aura-chrome-mid)]/40 hover:border-[var(--aura-chrome-bright)] bg-white/[0.02] hover:bg-white/[0.06] text-[var(--aura-chrome-bright)] font-body text-xs font-semibold uppercase tracking-wider transition-all duration-300 group shadow-sm mb-6"
        >
          <Plus className="w-4 h-4 text-[var(--aura-chrome-mid)] group-hover:text-white transition-colors" />
          <span>Thêm Món Khác Từ Thực Đơn</span>
        </a>

        {/* Financial Breakdown */}
        <div className="space-y-3.5 pt-5 border-t border-[color-mix(in_srgb,var(--aura-chrome-dim)_20%,transparent)]">
          <div className="flex justify-between text-[var(--aura-chrome-soft)] text-sm font-body">
            <span>{t('stitch.subtotal', 'Tạm tính')}</span>
            <span className="font-mono text-white">
              {formatPrice(summary.subtotal, locale)}
            </span>
          </div>
          {summary.tax > 0 && (
            <div className="flex justify-between text-[var(--aura-chrome-soft)] text-sm font-body">
              <span>{summary.taxLabel ?? t('stitch.tax', 'Phí phục vụ')}</span>
              <span className="font-mono text-white">
                {formatPrice(summary.tax, locale)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-[var(--aura-chrome-soft)] text-sm font-body">
            <span>{summary.deliveryLabel ?? t('stitch.deliveryFee', 'Phí giao hàng')}</span>
            <span className="font-mono text-emerald-400 font-semibold">
              {summary.deliveryFee === 0
                ? (locale?.startsWith('vi') ? 'Miễn phí' : '$0.00')
                : formatPrice(summary.deliveryFee, locale)}
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-4 border-t border-white/10 text-white font-body">
            <span className="text-base font-semibold uppercase tracking-wider">
              {t('stitch.totalAmount', 'Tổng thanh toán')}
            </span>
            <span className="font-display text-2xl sm:text-3xl font-bold text-[var(--aura-chrome-bright)]">
              {formatPrice(summary.total, locale)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
