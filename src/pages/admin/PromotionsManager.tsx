import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://aura-space-worker.agencyos-openclaw.workers.dev';

// ── Types ────────────────────────────────────────────────────────────

interface Promotion {
  code: string;
  percent: number;
  max_discount: number;
  min_order: number;
  usage_limit: number;
  usage_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: number;
  created_at: string;
}

interface PromotionFormData {
  code: string;
  percent: string;
  max_discount: string;
  min_order: string;
  usage_limit: string;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers as Record<string, string>) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
  return data;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('vi-VN');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

function toDatetimeLocal(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Empty State ──────────────────────────────────────────────────────

const EMPTY_FORM: PromotionFormData = {
  code: '',
  percent: '',
  max_discount: '',
  min_order: '',
  usage_limit: '',
  starts_at: '',
  expires_at: '',
  is_active: true,
};

// ── Component ────────────────────────────────────────────────────────

export default function PromotionsManagerPage() {
  const queryClient = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromotionFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteCode, setDeleteCode] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────

  const promosQuery = useQuery<{ success: boolean; data: Promotion[] }>({
    queryKey: ['admin-promotions'],
    queryFn: () => apiFetch('/api/promotions'),
  });

  // ── Mutations ────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (formData: PromotionFormData) => {
      const body = {
        code: formData.code,
        percent: Number(formData.percent),
        max_discount: formData.max_discount ? Number(formData.max_discount) : 0,
        min_order: formData.min_order ? Number(formData.min_order) : 0,
        usage_limit: formData.usage_limit ? Number(formData.usage_limit) : 0,
        starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
        is_active: formData.is_active ? 1 : 0,
      };

      if (editingPromo) {
        return apiFetch(`/api/promotions/${editingPromo.code}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      return apiFetch('/api/promotions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      closeModal();
    },
    onError: (err: Error) => {
      setErrors({ _form: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) =>
      apiFetch(`/api/promotions/${code}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      setDeleteCode(null);
    },
    onError: (err: Error) => {
      setErrors({ _form: err.message });
    },
  });

  // ── Modal handlers ───────────────────────────────────────────────

  function openAddModal() {
    setEditingPromo(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEditModal(promo: Promotion) {
    setEditingPromo(promo);
    setForm({
      code: promo.code,
      percent: String(promo.percent),
      max_discount: String(promo.max_discount),
      min_order: String(promo.min_order),
      usage_limit: String(promo.usage_limit),
      starts_at: toDatetimeLocal(promo.starts_at),
      expires_at: toDatetimeLocal(promo.expires_at),
      is_active: promo.is_active === 1,
    });
    setErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingPromo(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function handleFormChange(field: keyof PromotionFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      delete next._form;
      return next;
    });
  }

  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!editingPromo && !form.code.trim()) {
      errs.code = 'Vui lòng nhập mã khuyến mãi';
    }
    if (!form.percent || Number(form.percent) <= 0 || Number(form.percent) > 100) {
      errs.percent = 'Phần trăm phải từ 1-100';
    }
    if (form.max_discount && Number(form.max_discount) < 0) {
      errs.max_discount = 'Giảm tối đa không được âm';
    }
    if (form.min_order && Number(form.min_order) < 0) {
      errs.min_order = 'Đơn tối thiểu không được âm';
    }
    if (form.usage_limit && Number(form.usage_limit) < 0) {
      errs.usage_limit = 'Số lần không được âm';
    }
    if (form.starts_at && form.expires_at && new Date(form.starts_at) > new Date(form.expires_at)) {
      errs.expires_at = 'Ngày kết thúc phải sau ngày bắt đầu';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validateForm()) return;
    saveMutation.mutate(form);
  }

  // ── Render helpers ───────────────────────────────────────────────

  function renderSkeletonRows(count = 5) {
    return Array.from({ length: count }).map((_, i) => (
      <tr key={i}>
        {Array.from({ length: 7 }).map((__, j) => (
          <td key={j} className="px-4 py-3">
            <Skeleton className={j === 6 ? 'h-8 w-20' : 'h-4 w-full'} />
          </td>
        ))}
      </tr>
    ));
  }

  const promotions = promosQuery.data?.data ?? [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">Quản lý khuyến mãi</h1>
        </div>

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted">
            {promosQuery.isLoading
              ? 'Đang tải...'
              : `${promotions.length} khuyến mãi`}
          </p>
          <Button onClick={openAddModal}>+ Thêm khuyến mãi</Button>
        </div>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/5">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Mã</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Giảm</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Giới hạn</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Ngày</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Đã dùng</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Trạng thái</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {promosQuery.isLoading && renderSkeletonRows()}

                {promosQuery.isError && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-sm text-destructive">Lỗi tải danh sách khuyến mãi</p>
                        <Button size="sm" variant="secondary" onClick={() => promosQuery.refetch()}>
                          Thử lại
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}

                {!promosQuery.isLoading && !promosQuery.isError && promotions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                      <p className="mb-2">Chưa có khuyến mãi nào</p>
                      <Button size="sm" variant="secondary" onClick={openAddModal}>
                        + Tạo khuyến mãi đầu tiên
                      </Button>
                    </td>
                  </tr>
                )}

                {!promosQuery.isLoading && !promosQuery.isError && promotions.map((promo) => (
                  <tr key={promo.code} className="hover:bg-muted/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold">{promo.code}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {promo.percent}%
                      {promo.max_discount > 0 && (
                        <span className="text-xs text-muted ml-1">
                          (tối đa {formatCurrency(promo.max_discount)}đ)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {promo.min_order > 0 ? `Từ ${formatCurrency(promo.min_order)}đ` : 'Không'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {formatDate(promo.starts_at)} — {formatDate(promo.expires_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {promo.usage_count}/{promo.usage_limit || '∞'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={promo.is_active ? 'success' : 'destructive'}>
                        {promo.is_active ? 'Đang chạy' : 'Tắt'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEditModal(promo)}>
                          Sửa
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeleteCode(promo.code)}>
                          Xoá
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ─────────────── Create / Edit Modal ─────────────── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingPromo ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi'}
      >
        <div className="space-y-4">
          {errors._form && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {errors._form}
            </div>
          )}

          <Input
            label="Mã khuyến mãi"
            placeholder="VDUONGDEP"
            value={form.code}
            onChange={(e) => handleFormChange('code', e.target.value.toUpperCase())}
            error={errors.code}
            disabled={!!editingPromo}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phần trăm giảm (%)"
              type="number"
              placeholder="10"
              min={1}
              max={100}
              value={form.percent}
              onChange={(e) => handleFormChange('percent', e.target.value)}
              error={errors.percent}
            />
            <Input
              label="Giảm tối đa (VND)"
              type="number"
              placeholder="50000"
              min={0}
              value={form.max_discount}
              onChange={(e) => handleFormChange('max_discount', e.target.value)}
              error={errors.max_discount}
              helperText="0 = không giới hạn"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Đơn tối thiểu (VND)"
              type="number"
              placeholder="100000"
              min={0}
              value={form.min_order}
              onChange={(e) => handleFormChange('min_order', e.target.value)}
              error={errors.min_order}
              helperText="0 = không yêu cầu"
            />
            <Input
              label="Số lần tối đa"
              type="number"
              placeholder="100"
              min={0}
              value={form.usage_limit}
              onChange={(e) => handleFormChange('usage_limit', e.target.value)}
              error={errors.usage_limit}
              helperText="0 = không giới hạn"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Ngày bắt đầu</label>
              <input
                type="datetime-local"
                className="rounded-lg border border-border bg-white px-4 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                value={form.starts_at}
                onChange={(e) => handleFormChange('starts_at', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Ngày kết thúc</label>
              <input
                type="datetime-local"
                className="rounded-lg border border-border bg-white px-4 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                value={form.expires_at}
                onChange={(e) => handleFormChange('expires_at', e.target.value)}
              />
              {errors.expires_at && (
                <p className="text-sm text-destructive" role="alert">{errors.expires_at}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Đang hoạt động</label>
            <button
              type="button"
              role="switch"
              aria-checked={form.is_active}
              onClick={() => handleFormChange('is_active', !form.is_active)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                form.is_active ? 'bg-green-500' : 'bg-muted/50'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                  form.is_active ? 'translate-x-[22px]' : 'translate-x-[2px]'
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal}>
              Huỷ
            </Button>
            <Button
              onClick={handleSave}
              loading={saveMutation.isPending}
              disabled={saveMutation.isPending}
            >
              {editingPromo ? 'Lưu thay đổi' : 'Thêm khuyến mãi'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─────────────── Confirm Delete ─────────────── */}
      <Modal
        open={deleteCode !== null}
        onClose={() => setDeleteCode(null)}
        title="Xác nhận xoá"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Bạn có chắc chắn muốn xoá khuyến mãi <strong>{deleteCode}</strong>?
            Hành động này không thể hoàn tác.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteCode(null)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteCode !== null) deleteMutation.mutate(deleteCode);
              }}
              loading={deleteMutation.isPending}
              disabled={deleteMutation.isPending}
            >
              Xoá
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
