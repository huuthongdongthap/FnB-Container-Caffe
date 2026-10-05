import { useState, useMemo } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import { formatVnd } from '@/lib/format';
import type { IngredientItem } from './inventory-types';

interface InventoryIngredientsTabProps {
  ingredients: IngredientItem[];
  loading?: boolean;
  onOpenMovement: (item: IngredientItem) => void;
}

export function InventoryIngredientsTab({
  ingredients,
  loading,
  onOpenMovement,
}: Readonly<InventoryIngredientsTabProps>) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const categories = useMemo(() => {
    const set = new Set<string>();
    ingredients.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [ingredients]);

  const filtered = useMemo(() => {
    return ingredients.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase());
      const matchCategory =
        categoryFilter === 'ALL' || item.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [ingredients, search, categoryFilter]);

  return (
    <div className="space-y-4">
      {/* Search & Category Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--aura-text-muted)]" />
          <input
            type="text"
            placeholder="Tìm theo tên nguyên liệu, mã SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-[var(--glass-border)] text-xs text-[var(--aura-text-primary)] placeholder-[var(--aura-text-muted)] focus:outline-none focus:border-[var(--aura-accent,#c9d6df)]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
              categoryFilter === 'ALL'
                ? 'bg-white/20 text-[var(--aura-text-primary)]'
                : 'bg-white/5 text-[var(--aura-text-muted)] hover:bg-white/10'
            }`}
          >
            Tất cả
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 capitalize ${
                categoryFilter === cat
                  ? 'bg-white/20 text-[var(--aura-text-primary)]'
                  : 'bg-white/5 text-[var(--aura-text-muted)] hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table view */}
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--aura-text-primary)]">
            <thead className="bg-white/5 border-b border-[var(--glass-border)] text-[var(--aura-text-muted)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Mã SKU</th>
                <th className="py-3 px-4">Tên nguyên liệu</th>
                <th className="py-3 px-4">Danh mục</th>
                <th className="py-3 px-4 text-right">Tồn hiện tại</th>
                <th className="py-3 px-4 text-right">Định mức an toàn</th>
                <th className="py-3 px-4 text-right">Đơn giá vốn</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {loading && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[var(--aura-text-muted)]">
                    Đang tải dữ liệu tồn kho...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[var(--aura-text-muted)]">
                    Không tìm thấy nguyên liệu phù hợp
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((item) => {
                  const isOutOfStock = item.current_stock <= 0;
                  const isLowStock =
                    item.current_stock > 0 && item.current_stock <= item.min_stock;

                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono text-[var(--aura-chrome-light)]">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4 font-medium">{item.name}</td>
                      <td className="py-3 px-4 capitalize text-[var(--aura-text-muted)]">
                        {item.category || 'Mặc định'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono">
                        {item.current_stock.toLocaleString()} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--aura-text-muted)] font-mono">
                        {item.min_stock} - {item.max_stock} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatVnd(item.cost_per_unit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOutOfStock ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300">
                            Hết hàng
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300">
                            Sắp hết
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                            Đủ hàng
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onOpenMovement(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/10 hover:bg-white/20 text-[var(--aura-text-primary)] transition-colors"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                          <span>Điều chỉnh</span>
                        </button>
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
