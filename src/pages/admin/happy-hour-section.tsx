import type { Category, Product, HappyHourWindowAdmin, HappyHourFormData } from './types';

const DAY_LABELS: Record<number, string> = {
  0: 'Chủ nhật',
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
};

interface HappyHourSectionProps {
  windows: HappyHourWindowAdmin[];
  categories: Category[];
  products: Product[];
  isLoading: boolean;
  isError: boolean;
  modalOpen: boolean;
  editing: HappyHourWindowAdmin | null;
  form: HappyHourFormData;
  errors: Record<string, string>;
  saving: boolean;
  togglePending: boolean;
  onRefetch: () => void;
  onAdd: () => void;
  onEdit: (win: HappyHourWindowAdmin) => void;
  onToggleActive: (win: HappyHourWindowAdmin) => void;
  onDelete: (id: string) => void;
  onFormChange: <K extends keyof HappyHourFormData>(field: K, value: HappyHourFormData[K]) => void;
  onSave: () => void;
  onCloseModal: () => void;
}

export function HappyHourSection({
  windows,
  categories,
  products,
  isLoading,
  isError,
  modalOpen,
  editing,
  form,
  errors,
  saving,
  togglePending,
  onRefetch,
  onAdd,
  onEdit,
  onToggleActive,
  onDelete,
  onFormChange,
  onSave,
  onCloseModal,
}: HappyHourSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Khung giờ vàng (Happy Hour — Giờ Việt Nam UTC+7)</h2>
          <p className="text-xs text-muted">
            Tự động áp dụng giảm giá trên thực đơn và đơn hàng trong khung giờ cài đặt (hỗ trợ cả ca qua đêm).
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          + Thêm khung giờ
        </button>
      </div>

      {isError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center justify-between">
          <span>Không thể tải danh sách khung giờ Happy Hour.</span>
          <button type="button" onClick={onRefetch} className="underline text-xs font-semibold">
            Thử lại
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted">Đang tải cấu hình Happy Hour...</div>
      ) : windows.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted">
          Chưa có khung giờ vàng nào. Nhấn &ldquo;+ Thêm khung giờ&rdquo; để tạo ưu đãi theo giờ.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/20 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Tên ưu đãi</th>
                <th className="px-4 py-3">Thứ</th>
                <th className="px-4 py-3">Khung giờ (ICT)</th>
                <th className="px-4 py-3">Giảm giá</th>
                <th className="px-4 py-3">Phạm vi</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {windows.map((w) => {
                const rawRate = Number(w.discount_rate || 0);
                const pct = rawRate <= 1 ? Math.round(rawRate * 100) : Math.round(rawRate);
                return (
                  <tr key={w.id}>
                    <td className="px-4 py-3 font-medium">{w.name}</td>
                    <td className="px-4 py-3">{DAY_LABELS[w.day_of_week] ?? `Thứ ${w.day_of_week}`}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {w.start_time} – {w.end_time}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-500">-{pct}%</td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {w.apply_to === 'all' ? 'Toàn bộ menu' : `${w.apply_to}: ${w.apply_ids ?? ''}`}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={togglePending}
                        onClick={() => onToggleActive(w)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          w.active === 1
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-zinc-500/20 text-zinc-400'
                        }`}
                      >
                        {w.active === 1 ? 'Đang bật' : 'Tạm tắt'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button
                        type="button"
                        onClick={() => onEdit(w)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(w.id)}
                        className="text-xs font-medium text-rose-400 hover:underline"
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 space-y-4">
            <h3 className="text-lg font-bold">
              {editing ? 'Chỉnh sửa khung giờ vàng' : 'Thêm khung giờ vàng'}
            </h3>

            {errors._form && (
              <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {errors._form}
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium mb-1">Tên chương trình</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => onFormChange('name', e.target.value)}
                  placeholder="VD: Giờ vàng buổi chiều"
                  className="w-full rounded-lg border border-border bg-transparent px-3 py-2"
                />
                {errors.name && <p className="mt-1 text-xs text-rose-400">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Ngày trong tuần</label>
                  <select
                    value={form.day_of_week}
                    onChange={(e) => onFormChange('day_of_week', e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  >
                    {Object.entries(DAY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Bắt đầu (ICT)</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => onFormChange('start_time', e.target.value)}
                    className="w-full rounded-lg border border-border bg-transparent px-3 py-2"
                  />
                  {errors.start_time && <p className="mt-1 text-xs text-rose-400">{errors.start_time}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Kết thúc (ICT)</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => onFormChange('end_time', e.target.value)}
                    className="w-full rounded-lg border border-border bg-transparent px-3 py-2"
                  />
                  {errors.end_time && <p className="mt-1 text-xs text-rose-400">{errors.end_time}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Mức giảm (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.discount_percent}
                    onChange={(e) => onFormChange('discount_percent', e.target.value)}
                    className="w-full rounded-lg border border-border bg-transparent px-3 py-2"
                  />
                  {errors.discount_percent && <p className="mt-1 text-xs text-rose-400">{errors.discount_percent}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Độ ưu tiên</label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(e) => onFormChange('priority', e.target.value)}
                    className="w-full rounded-lg border border-border bg-transparent px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Phạm vi áp dụng</label>
                <select
                  value={form.apply_to}
                  onChange={(e) => onFormChange('apply_to', e.target.value as HappyHourFormData['apply_to'])}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                >
                  <option value="all">Toàn bộ menu</option>
                  <option value="category">Theo danh mục</option>
                  <option value="product">Theo sản phẩm</option>
                </select>
              </div>

              {form.apply_to !== 'all' && (
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {form.apply_to === 'category'
                      ? 'Mã / Slug danh mục (ngăn cách bởi dấu phẩy)'
                      : 'Mã sản phẩm (ngăn cách bởi dấu phẩy)'}
                  </label>
                  <input
                    type="text"
                    value={form.apply_ids}
                    onChange={(e) => onFormChange('apply_ids', e.target.value)}
                    placeholder={
                      form.apply_to === 'category'
                        ? categories.slice(0, 2).map((c) => c.slug || c.id).join(', ') || 'coffee, tea'
                        : products.slice(0, 2).map((p) => p.id).join(', ')
                    }
                    className="w-full rounded-lg border border-border bg-transparent px-3 py-2"
                  />
                  {errors.apply_ids && <p className="mt-1 text-xs text-rose-400">{errors.apply_ids}</p>}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => onFormChange('active', e.target.checked)}
                />
                <span>Kích hoạt ngay</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onCloseModal}
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium"
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={onSave}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
