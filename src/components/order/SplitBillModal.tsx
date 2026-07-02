import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useSplitBill, type SplitResult, SPLIT_COLORS, SPLIT_NAMES } from '@/hooks/use-split-bill';
import { Check, AlertTriangle, Users } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
   SplitBillModal — Modal for dine-in split bill / group ordering.
   Displays cart items with per-split assignment, split cards
   with colored borders, subtotals, and confirm action.
   ═══════════════════════════════════════════════════════════════════ */

interface SplitBillModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (orders: Array<Record<string, unknown>>) => void;
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
}

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

  const noItems = cartItems.length === 0;

  return (
    <Modal open={open} onClose={onClose} title="Chia bill" className="max-w-2xl">
      <div className="space-y-6">
        {/* Empty cart guard */}
        {noItems && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-center">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-400" />
            <p className="text-sm text-amber-300">Giỏ hàng trống. Thêm món trước khi chia bill.</p>
          </div>
        )}

        {/* Split count selector */}
        {!noItems && (
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-chrome-light/80">Số người</label>
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

        {/* Item assignment grid */}
        {!noItems && cartItems.length > 0 && (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-chrome-light/10 bg-[#0A1A2E]/40 p-2">
            {/* Header row */}
            <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-chrome-light/50">
              <span className="flex-1">Món</span>
              {Array.from({ length: splitCount }).map((_, i) => (
                <span
                  key={i}
                  className="flex w-14 justify-center"
                  style={{ color: SPLIT_COLORS[i] }}
                >
                  {SPLIT_NAMES[i]}
                </span>
              ))}
            </div>

            {/* Item rows */}
            {cartItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                  assignments[item.id] !== undefined
                    ? 'bg-[#1A2A3E]/60'
                    : 'hover:bg-[#1A2A3E]/30',
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
                      aria-label={`Gán ${item.name} cho ${SPLIT_NAMES[i]}`}
                    >
                      {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Unassigned items warning */}
        {!noItems && unassignedItems.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-amber-300">
                {unassignedItems.length} món chưa được phân công
              </span>
            </div>
            <button
              type="button"
              onClick={autoAssign}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              Tự động chia
            </button>
          </div>
        )}

        {/* All assigned checkmark */}
        {!noItems && allAssigned && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-emerald-300">Tất cả món đã được phân công</span>
          </div>
        )}

        {/* Split cards */}
        {!noItems && splits.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(splitCount, 2)}, 1fr)` }}>
            {splits.map((split: SplitResult) => (
              <SplitCard key={split.index} split={split} />
            ))}
          </div>
        )}

        {/* Empty split — no items assigned yet */}
        {!noItems && splits.length > 0 && allAssigned && splits.every((s) => s.items.length === 0) && (
          <div className="rounded-lg border border-chrome-light/10 bg-[#0A1A2E]/30 p-4 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-chrome-light/30" />
            <p className="text-sm text-chrome-light/40">Chọn món cho mỗi người để bắt đầu chia bill</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1"
            disabled={!allAssigned || noItems || isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? 'Đang tạo...' : 'Xác nhận chia bill'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Split card sub-component ── */

function SplitCard({ split }: { split: SplitResult }) {
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
        <p className="text-xs text-chrome-light/40">Chưa chọn món</p>
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
            <span>Tạm tính</span>
            <span>{new Intl.NumberFormat('vi-VN').format(split.subtotal) + '₫'}</span>
          </div>
          <div className="flex justify-between">
            <span>Phí dịch vụ (5%)</span>
            <span>{new Intl.NumberFormat('vi-VN').format(split.serviceFee) + '₫'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
