import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './menu-api';
import { EMPTY_PROMOTION } from './types';
import type { Promotion, PromotionFormData } from './types';

// ── Helpers ──────────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return value.toLocaleString('vi-VN');
}

export function formatDate(dateStr: string | null): string {
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

// ── Hook ─────────────────────────────────────────────────────────────

export function usePromotionsManager() {
  const { t } = useTranslation('adminPromotions');
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromotionFormData>(EMPTY_PROMOTION);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteCode, setDeleteCode] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────

  const query = useQuery<{ success: boolean; data: Promotion[] }>({
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
    setForm(EMPTY_PROMOTION);
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
    setForm(EMPTY_PROMOTION);
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
      errs.code = t('validationCodeRequired');
    }
    if (!form.percent || Number(form.percent) <= 0 || Number(form.percent) > 100) {
      errs.percent = t('validationPercentRange');
    }
    if (form.max_discount && Number(form.max_discount) < 0) {
      errs.max_discount = t('validationMaxDiscountNegative');
    }
    if (form.min_order && Number(form.min_order) < 0) {
      errs.min_order = t('validationMinOrderNegative');
    }
    if (form.usage_limit && Number(form.usage_limit) < 0) {
      errs.usage_limit = t('validationUsageLimitNegative');
    }
    if (form.starts_at && form.expires_at && new Date(form.starts_at) > new Date(form.expires_at)) {
      errs.expires_at = t('validationEndDateAfterStart');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validateForm()) return;
    saveMutation.mutate(form);
  }

  return {
    query,
    modalOpen,
    editingPromo,
    form,
    errors,
    deleteCode,
    setDeleteCode,
    saveMutation,
    deleteMutation,
    openAddModal,
    openEditModal,
    closeModal,
    handleFormChange,
    handleSave,
  };
}
