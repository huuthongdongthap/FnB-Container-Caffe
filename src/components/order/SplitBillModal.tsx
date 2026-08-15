import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useSplitBill, SPLIT_COLORS, SPLIT_NAMES } from '@/hooks/use-split-bill';
import { Check, AlertTriangle, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SplitBillModalProps } from './SplitBillModal-types';
import { SplitCard } from './SplitCard';

/* SplitBillModal — Modal for split bill / group ordering. */

export function SplitBillModal({
  open,
  onClose,
  onConfirm,
  customerName,
  customerPhone,
  paymentMethod,
}: SplitBillModalProps) {
  const {
    cartItems,
    splitCount,
    setSplitCount,
    assignments,
    splits,
    unassignedItems,
    allAssigned,
    toggleItem,
    autoAssign,
    error,
    isSubmitting,
    confirmSplit,
  } = useSplitBill();

  const handleConfirm = async () => {
    const result = await confirmSplit({
      customer_name: customerName,
      customer_phone: customerPhone,
      payment_method: paymentMethod,
    });
    if (result) {
      onConfirm(result.orders);
    }
  };

  const { t } = useTranslation();
  const noItems = cartItems.length === 0;

  return (
    <Modal open={open} onClose={onClose} title={t('order.splitBillTitle')} className="max-w-2xl">
      <div className="space-y-6">
        {noItems && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-center">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-400" />
            <p className="text-sm text-amber-300">{t('order.splitBillEmptyCart')}</p>
          </div>
        )}

        {!noItems && (
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-chrome-light/80">{t('order.splitBillPeopleCount')}</label>
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSplitCount(n)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-all',
                    splitCount === n
                      ? 'bg-primary text-white shadow-sm'
                      : 'border border-chrome-light/20 text-chrome-light/60 hover:border-chrome-light/40 hover:text-chrome-light/80',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {!noItems && cartItems.length > 0 && (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-chrome-light/10 bg-[#0A1A2E]/40 p-2">
            <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-chrome-light/50">
              <span className="flex-1">{t('order.splitBillItem')}</span>
              {Array.from({ length: splitCount }).map((_, i) => (
                <span key={i} className="flex w-14 justify-center" style={{ color: SPLIT_COLORS[i] }}>
                  {SPLIT_NAMES[i]}
                </span>
              ))}
            </div>
            {cartItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                  assignments[item.id] !== undefined ? 'bg-[#1A2A3E]/60' : 'hover:bg-[#1A2A3E]/30',
                )}
              >
                <span className="flex-1 truncate text-sm text-chrome-light/90">
                  {item.name}
                  <span className="ml-1 text-xs text-chrome-light/50">x{item.quantity}</span>
                </span>
                {Array.from({ length: splitCount }).map((_, i) => {
                  const isSelected = assignments[item.id] === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleItem(item.id, i)}
                      className={cn(
                        'flex h-7 w-14 items-center justify-center rounded-md text-xs transition-all',
                        isSelected
                          ? 'text-white shadow-sm'
                          : 'border border-chrome-light/10 text-chrome-light/40 hover:border-chrome-light/30',
                      )}
                      style={{
                        backgroundColor: isSelected ? SPLIT_COLORS[i] : undefined,
                        borderColor: isSelected ? SPLIT_COLORS[i] : undefined,
                      }}
                      aria-label={t('order.splitBillAssignAria', { item: item.name, split: SPLIT_NAMES[i] })}
                    >
                      {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {!noItems && unassignedItems.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-amber-300">
                {t('order.splitBillUnassigned', { count: unassignedItems.length })}
              </span>
            </div>
            <button
              type="button"
              onClick={autoAssign}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              {t('order.splitBillAutoAssign')}
            </button>
          </div>
        )}

        {!noItems && allAssigned && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-emerald-300">{t('order.splitBillAllAssigned')}</span>
          </div>
        )}

        {!noItems && splits.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(splitCount, 2)}, 1fr)` }}>
            {splits.map((split) => (
              <SplitCard key={split.index} split={split} />
            ))}
          </div>
        )}

        {!noItems && splits.length > 0 && allAssigned && splits.every((s) => s.items.length === 0) && (
          <div className="rounded-lg border border-chrome-light/10 bg-[#0A1A2E]/30 p-4 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-chrome-light/30" />
            <p className="text-sm text-chrome-light/40">{t('order.splitBillStartAssign')}</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1"
            disabled={!allAssigned || noItems || isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? t('order.splitBillCreating') : t('order.splitBillConfirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export type { SplitBillModalProps } from './SplitBillModal-types';
