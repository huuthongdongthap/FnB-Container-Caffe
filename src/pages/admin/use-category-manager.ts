import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientSessionScope } from '@/lib/client-session';
import { apiFetch, slugify } from './menu-api';
import { EMPTY_CATEGORY } from './types';
import type { Category, CategoryFormData } from './types';

export function useCategoryManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const session = useClientSessionScope();
  const categoriesKey = ['admin-categories', session.tenantId, session.userScope] as const;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormData>(EMPTY_CATEGORY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_CATEGORY);
    setErrors({});
    setActionError(null);
    setDeleteId(null);
  }, [session.tenantId, session.userScope]);

  const query = useQuery<{ success: boolean; data: Category[] }>({
    queryKey: categoriesKey,
    queryFn: () => apiFetch('/api/categories'),
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: CategoryFormData) => {
      const body = {
        name: formData.name,
        slug: formData.slug,
        sort_order: Number(formData.sort_order),
      };

      if (editing) {
        return apiFetch(`/api/categories/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      }
      return apiFetch('/api/categories', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesKey });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      closeModal();
    },
    onError: (err: Error) => {
      setErrors({ _form: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: categoriesKey });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setDeleteId(null);
    },
    onError: (err: Error) => {
      setDeleteId(null);
      setErrors({ _form: err.message });
      setActionError(err.message || 'Không thể xoá danh mục');
    },
  });

  function openAddModal() {
    setEditing(null);
    setForm(EMPTY_CATEGORY);
    setErrors({});
    setModalOpen(true);
  }

  function openEditModal(category: Category) {
    setEditing(category);
    setForm({
      name: category.name,
      slug: category.slug,
      sort_order: String(category.sort_order),
    });
    setErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_CATEGORY);
    setErrors({});
  }

  function handleFormChange(field: keyof CategoryFormData, value: string) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'name' && !editing) {
        updated.slug = slugify(updated.name);
      }
      return updated;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      delete next._form;
      return next;
    });
  }

  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('adminMenu.nameRequired');
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
    deleteMutation,
    openAddModal,
    openEditModal,
    closeModal,
    handleFormChange,
    handleSave,
  };
}
