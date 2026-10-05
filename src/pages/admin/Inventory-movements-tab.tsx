import { useState, useMemo } from 'react';
import type { StockMovementItem } from './inventory-types';

interface InventoryMovementsTabProps {
  movements: StockMovementItem[];
  loading?: boolean;
}

export function InventoryMovementsTab({
  movements,
  loading,
}: Readonly<InventoryMovementsTabProps>) {
  const [filterType, setFilterType] = useState('ALL');

  const filtered = useMemo(() => {
    if (filterType === 'ALL') return movements;
    return movements.filter((m) => m.type === filterType);
  }, [movements, filterType]);

  const typeLabels: Record<string, { label: string; badge: string }> = {
    in: { label: 'Nhập kho', badge: 'bg-emerald-500/20 text-emerald-300' },
    out: { label: 'Xuất kho', badge: 'bg-sky-500/20 text-sky-300' },
    adjust: { label: 'Kiểm kê', badge: 'bg-amber-500/20 text-amber-300' },
    waste: { label: 'Hao hụt', badge: 'bg-rose-500/20 text-rose-300' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['ALL', 'in', 'out', 'adjust', 'waste'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
              filterType === t
                ? 'bg-white/20 text-[var(--aura-text-primary)]'
                : 'bg-white/5 text-[var(--aura-text-muted)] hover:bg-white/10'
            }`}
          >
            {t === 'ALL' ? 'Tất cả biến động' : typeLabels[t]?.label || t}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--aura-text-primary)]">
            <thead className="bg-white/5 border-b border-[var(--glass-border)] text-[var(--aura-text-muted)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Nguyên liệu</th>
                <th className="py-3 px-4 text-center">Loại biến động</th>
                <th className="py-3 px-4 text-right">Số lượng</th>
                <th className="py-3 px-4">Ghi chú</th>
                <th className="py-3 px-4">Người thực hiện</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--aura-text-muted)]">
                    Đang tải nhật ký biến động kho...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--aura-text-muted)]">
                    Chưa có nhật ký biến động nào
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((item) => {
                  const meta = typeLabels[item.type] || {
                    label: item.type,
                    badge: 'bg-white/10 text-white',
                  };
                  const dateStr = item.created_at
                    ? new Date(item.created_at).toLocaleString('vi-VN')
                    : 'N/A';

                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono text-[var(--aura-text-muted)]">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {item.ingredient_name || item.ingredient_id}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${
                        item.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {item.quantity > 0 ? `+${item.quantity}` : item.quantity}
                      </td>
                      <td className="py-3 px-4 text-[var(--aura-text-muted)] max-w-xs truncate">
                        {item.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-[var(--aura-text-muted)]">
                        {item.created_by || 'Hệ thống'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
