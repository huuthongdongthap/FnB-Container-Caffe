import type { DinDinCart } from './dindin-cart-types';

interface CartListViewProps {
  carts: DinDinCart[];
  onSelect: (sessionId: string) => void;
  t: (key: string, opts?: Record<string, string>) => string;
}

export function CartListView({ carts, onSelect, t }: CartListViewProps) {
  if (carts.length === 0) return null;
  return (
    <div className="rounded-2xl p-5 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <h3 className="text-sm font-semibold text-[var(--aura-text-secondary)]">{t('dindin.allCarts', { defaultValue: 'Tất cả giỏ hàng' })}</h3>
      {carts.map((c) => (
        <button key={c.sessionId} onClick={() => onSelect(c.sessionId)} className="w-full text-left rounded-xl px-3 py-2 text-xs hover:bg-[rgba(255,255,255,0.05)] flex justify-between">
          <span className="font-mono text-[var(--aura-text-primary)]">#{c.sessionId}</span>
          <span className="text-[var(--aura-text-secondary)]">{c.items.length} món · ₫{c.total.toLocaleString('vi-VN')}</span>
        </button>
      ))}
    </div>
  );
}
