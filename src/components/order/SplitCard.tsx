import { cn } from '@/lib/cn';
import { type SplitResult } from '@/hooks/use-split-bill';
import { useTranslation } from 'react-i18next';

/* SplitCard — Displays a single split's items, subtotal, and service fee. */

export function SplitCard({ split }: { split: SplitResult }) {
  const { t } = useTranslation();
  const isEmpty = split.items.length === 0;

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-3 transition-all',
        isEmpty ? 'border-dashed border-chrome-light/10 opacity-50' : '',
      )}
      style={{ borderColor: split.color }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: split.color }}>
          {split.name}
        </span>
        <span className="text-sm font-bold tabular-nums text-chrome-bright">
          {new Intl.NumberFormat('vi-VN').format(split.total) + '₫'}
        </span>
      </div>

      {isEmpty ? (
        <p className="text-xs text-chrome-light/40">{t('order.splitBillNoItems')}</p>
      ) : (
        <ul className="space-y-0.5">
          {split.items.map((item) => (
            <li key={item.id} className="flex justify-between text-xs text-chrome-light/70">
              <span className="truncate">
                {item.name} <span className="text-chrome-light/40">x{item.quantity}</span>
              </span>
              <span className="tabular-nums text-chrome-light/80">
                {new Intl.NumberFormat('vi-VN').format(item.price * item.quantity) + '₫'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!isEmpty && (
        <div className="mt-2 border-t border-chrome-light/10 pt-1.5 text-xs text-chrome-light/50">
          <div className="flex justify-between">
            <span>{t('order.splitBillSubtotal')}</span>
            <span>{new Intl.NumberFormat('vi-VN').format(split.subtotal) + '₫'}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('order.splitBillServiceFee')}</span>
            <span>{new Intl.NumberFormat('vi-VN').format(split.serviceFee) + '₫'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
