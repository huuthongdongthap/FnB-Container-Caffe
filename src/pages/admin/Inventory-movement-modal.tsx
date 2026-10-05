import { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, RefreshCw, Trash2 } from 'lucide-react';
import type { IngredientItem } from './inventory-types';

interface InventoryMovementModalProps {
  ingredient: IngredientItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    ingredientId: string;
    type: 'in' | 'out' | 'adjust' | 'waste';
    quantity: number;
    notes?: string;
  }) => Promise<void>;
}

export function InventoryMovementModal({
  ingredient,
  isOpen,
  onClose,
  onSubmit,
}: Readonly<InventoryMovementModalProps>) {
  const [type, setType] = useState<'in' | 'out' | 'adjust' | 'waste'>('in');
  const [qty, setQty] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !ingredient) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = parseFloat(qty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError('Số lượng phải là số dương lớn hơn 0');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // If type is out or waste, make quantity negative for reduction if API requires,
      // or pass positive quantity with type and let handler compute change
      const signedQuantity = type === 'out' || type === 'waste' ? -parsedQty : parsedQty;
      await onSubmit({
        ingredientId: ingredient.id,
        type,
        quantity: signedQuantity,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi ghi nhận biến động kho');
    } finally {
      setSubmitting(false);
    }
  };

  const types = [
    { id: 'in' as const, label: 'Nhập kho (+)', icon: ArrowDownRight, color: 'text-emerald-400 border-emerald-500/30' },
    { id: 'out' as const, label: 'Xuất kho (-)', icon: ArrowUpRight, color: 'text-sky-400 border-sky-500/30' },
    { id: 'adjust' as const, label: 'Kiểm kê (+/-)', icon: RefreshCw, color: 'text-amber-400 border-amber-500/30' },
    { id: 'waste' as const, label: 'Hao hụt (-)', icon: Trash2, color: 'text-rose-400 border-rose-500/30' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="movement-modal-title">
      <div className="w-full max-w-md rounded-2xl border border-[var(--glass-border)] bg-[var(--aura-bg-surface,var(--aura-noir-void))] p-6 shadow-2xl text-[var(--aura-text-primary)]">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--glass-border)]">
          <div>
            <h2 id="movement-modal-title" className="text-base font-bold font-display">Biến động kho: {ingredient.name}</h2>
            <p className="text-xs text-[var(--aura-text-muted)] mt-0.5">Mã SKU: {ingredient.sku} • Hiện tồn: {ingredient.current_stock} {ingredient.unit}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-[var(--aura-text-muted)]" aria-label="Đóng cửa sổ">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--aura-text-muted)] mb-2">Loại hình biến động</label>
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => {
                const Icon = t.icon;
                const active = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      active ? `bg-white/10 ${t.color}` : 'border-transparent bg-white/5 text-[var(--aura-text-muted)] hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="movement-qty" className="block text-xs font-medium text-[var(--aura-text-muted)] mb-1">
              Số lượng ({ingredient.unit})
            </label>
            <input
              id="movement-qty"
              type="number"
              step="any"
              min="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-[var(--glass-border)] text-sm focus:outline-none focus:border-[var(--aura-accent,#c9d6df)]"
            />
          </div>

          <div>
            <label htmlFor="movement-notes" className="block text-xs font-medium text-[var(--aura-text-muted)] mb-1">
              Ghi chú / Lý do
            </label>
            <input
              id="movement-notes"
              type="text"
              placeholder="VD: Nhập thêm từ kho tổng, kiểm kê cuối ca..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-[var(--glass-border)] text-sm focus:outline-none focus:border-[var(--aura-accent,#c9d6df)]"
            />
          </div>

          {error && <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--aura-accent,#c9d6df)] text-black hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Đang lưu...' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
