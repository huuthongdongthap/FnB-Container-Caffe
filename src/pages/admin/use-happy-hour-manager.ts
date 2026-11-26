import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientSessionScope } from '@/lib/client-session';
import { apiFetch } from './menu-api';
import { EMPTY_HAPPY_HOUR_WINDOW } from './types';
import type { HappyHourWindowAdmin, HappyHourFormData } from './types';

function formatApplyIdsInput(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).join(', ');
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function useHappyHourManager() {
  const queryClient = useQueryClient();
  const session = useClientSessionScope();
  const windowsKey = ['admin-happy-hour', session.tenantId, session.userScope] as const;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HappyHourWindowAdmin | null>(null);
  const [form, setForm] = useState<HappyHourFormData>(EMPTY_HAPPY_HOUR_WINDOW);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_HAPPY_HOUR_WINDOW);
    setErrors({});
    setActionError(null);
    setDeleteId(null);
  }, [session.tenantId, session.userScope]);

  const query = useQuery<{ success: boolean; data: HappyHourWindowAdmin[] }>({
    queryKey: windowsKey,
    queryFn: () => apiFetch('/api/menu-modifiers/happy-hour'),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: windowsKey });
    queryClient.invalidateQueries({ queryKey: ['menu'] });
    queryClient.invalidateQueries({ queryKey: ['tv-menu-happy-hour'] });
  }

  const saveMutation = useMutation({
    mutationFn: async (formData: HappyHourFormData) => {
      const pct = Number(formData.discount_percent);
      const discountRate = Math.round(pct) / 100;
      const applyIdsList =
        formData.apply_to === 'all'
          ? null
          : formData.apply_ids
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);

      const startTrim = formData.start_time.trim();
      const endTrim = formData.end_time.trim();
      const body = {
        name: formData.name.trim(),
        day_of_week: Number(formData.day_of_week),
        start_time: startTrim,
        end_time: endTrim,
        ...(startTrim > endTrim ? { allow_overnight: true } : {}),
        discount_rate: discountRate,
        apply_to: formData.apply_to,
        apply_ids: applyIdsList,
        priority: Number(formData.priority || 0),
        active: formData.active,
      };

      if (editing) {
        return apiFetch(`/api/menu-modifiers/happy-hour/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      return apiFetch('/api/menu-modifiers/happy-hour', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
      closeModal();
    },
    onError: (err: Error) => {
      setErrors({ _form: err.message });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (win: HappyHourWindowAdmin) =>
      apiFetch(`/api/menu-modifiers/happy-hour/${win.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: win.active !== 1 }),
      }),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Không thể cập nhật trạng thái khung giờ vàng');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/menu-modifiers/happy-hour/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
      setDeleteId(null);
    },
    onError: (err: Error) => {
      setDeleteId(null);
      setActionError(err.message || 'Không thể xoá khung giờ vàng');
    },
  });

  function openAddModal() {
    setEditing(null);
    setForm(EMPTY_HAPPY_HOUR_WINDOW);
    setErrors({});
    setActionError(null);
    setModalOpen(true);
  }

  function openEditModal(win: HappyHourWindowAdmin) {
    const rawRate = Number(win.discount_rate || 0);
    const pct = rawRate <= 1 ? Math.round(rawRate * 100) : Math.round(rawRate);
    const normalizedApplyTo =
      win.apply_to === 'category' || win.apply_to === 'category_id' || win.apply_to === 'categories'
        ? 'category'
        : win.apply_to === 'product' || win.apply_to === 'product_id' || win.apply_to === 'products'
          ? 'product'
          : 'all';
    setEditing(win);
    setForm({
      name: win.name,
      day_of_week: String(win.day_of_week),
      start_time: win.start_time,
      end_time: win.end_time,
      discount_percent: String(pct),
      apply_to: normalizedApplyTo,
      apply_ids: formatApplyIdsInput(win.apply_ids),
      priority: String(win.priority ?? 0),
      active: win.active === 1,
    });
    setErrors({});
    setActionError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_HAPPY_HOUR_WINDOW);
    setErrors({});
  }

  function handleFormChange<K extends keyof HappyHourFormData>(field: K, value: HappyHourFormData[K]) {
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
    if (!form.name.trim()) errs.name = 'Tên khung giờ không được để trống';
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(form.start_time.trim())) {
      errs.start_time = 'Giờ bắt đầu phải có dạng HH:MM';
    }
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(form.end_time.trim())) {
      errs.end_time = 'Giờ kết thúc phải có dạng HH:MM';
    }
    if (form.start_time.trim() === form.end_time.trim()) {
      errs.end_time = 'Giờ kết thúc không được trùng giờ bắt đầu';
    }
    const pct = Number(form.discount_percent);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      errs.discount_percent = 'Mức giảm phải từ 1% đến 100%';
    }
    if (form.apply_to !== 'all') {
      const ids = form.apply_ids.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        errs.apply_ids = 'Vui lòng nhập ít nhất 1 mã danh mục hoặc sản phẩm';
      }
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
    editing,
    form,
    errors,
    actionError,
    clearActionError: () => setActionError(null),
    deleteId,
    setDeleteId,
    saveMutation,
    toggleActiveMutation,
    deleteMutation,
    openAddModal,
    openEditModal,
    closeModal,
    handleFormChange,
    handleSave,
  };
}
