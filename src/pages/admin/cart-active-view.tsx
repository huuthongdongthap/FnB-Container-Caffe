import type { DinDinCart } from './dindin-cart-types';

interface CartActiveViewProps {
  cart: DinDinCart;
  itemId: string;
  itemQty: number;
  onItemIdChange: (id: string) => void;
  onItemQtyChange: (qty: number) => void;
  onPatch: (op: 'add' | 'remove' | 'update', overrideItemId?: string) => void;
  saving: boolean;
  t: (key: string, opts?: Record<string, string>) => string;
}

export function CartActiveView({ cart, itemId, itemQty, onItemIdChange, onItemQtyChange, onPatch, saving, t }: CartActiveViewProps) {
  const rawTimestamp = (cart as DinDinCart & { updatedAt?: string }).updatedAt ?? cart.createdAt;
  const formattedTimestamp = rawTimestamp
    ? new Date(rawTimestamp).toLocaleString('vi-VN')
    : '';
  const computedTotal =
    typeof cart.total === 'number' && !Number.isNaN(cart.total)
      ? cart.total
      : (cart.items ?? []).reduce((sum, it) => {
          const itemAny = it as typeof it & { qty?: number };
          const qty = itemAny.quantity ?? itemAny.qty ?? 1;
          return sum + (it.price ?? 0) * qty;
        }, 0);

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--aura-text-primary)]">
          {t('dindin.activeCart', { defaultValue: 'Giỏ hiện tại' })} — #{cart.sessionId}
        </h2>
        <span className="text-xs text-[var(--aura-text-secondary)]">
          {formattedTimestamp}
        </span>
      </div>
      <div className="space-y-2">
        {(cart.items ?? []).map((item) => {
          const itemAny = item as typeof item & { qty?: number };
          const resolvedQty = itemAny.quantity ?? itemAny.qty ?? 1;
          const resolvedPrice = item.price ?? 0;
          return (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <span className="flex-1 text-[var(--aura-text-primary)]">{item.name ?? item.id}</span>
              <span className="text-[var(--aura-text-secondary)]">₫{resolvedPrice.toLocaleString('vi-VN')}</span>
              <input
                type="number"
                min={1}
                value={resolvedQty}
                onChange={(e) => onItemQtyChange(Number(e.target.value))}
                className="w-12 rounded-lg px-2 py-1 text-xs bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-center"
              />
              <button type="button" onClick={() => { onItemIdChange(item.id); onPatch('update', item.id); }} disabled={saving} className="text-xs text-blue-400 disabled:opacity-50">Cập nhật</button>
              <button type="button" onClick={() => { onItemIdChange(item.id); onPatch('remove', item.id); }} disabled={saving} className="text-xs text-red-400 disabled:opacity-50">{t('delete', { defaultValue: 'Xoá' })}</button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={itemId}
          onChange={(e) => onItemIdChange(e.target.value)}
          placeholder={t('dindin.itemId', { defaultValue: 'ID món' })}
          className="flex-1 rounded-xl px-3 py-2 text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]"
        />
        <button type="button" onClick={() => onPatch('add')} disabled={!itemId.trim() || itemQty <= 0} className="rounded-full px-4 py-2 text-xs bg-[var(--aura-chrome-mid)] text-white disabled:opacity-50">
          {t('dindin.addItem', { defaultValue: 'Thêm' })}
        </button>
      </div>
      <p className="text-right text-base font-semibold text-[var(--aura-text-primary)]">
        Tổng: ₫{computedTotal.toLocaleString('vi-VN')}
      </p>
    </div>
  );
}
