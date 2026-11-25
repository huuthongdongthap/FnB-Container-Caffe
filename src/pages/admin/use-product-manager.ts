import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientSessionScope } from '@/lib/client-session';
import { apiFetch, slugify } from './menu-api';
import { EMPTY_PRODUCT } from './types';
import type { Product, ProductFormData } from './types';

export function useProductManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const session = useClientSessionScope();
  const productsKey = ['admin-products', session.tenantId, session.userScope] as const;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_PRODUCT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_PRODUCT);
    setErrors({});
    setActionError(null);
    setDeleteId(null);
  }, [session.tenantId, session.userScope]);

  const query = useQuery<{ success: boolean; data: Product[] }>({
    queryKey: productsKey,
    queryFn: () => apiFetch('/api/products'),
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: ProductFormData) => {
      const trimmedDescription = (formData.description ?? '').trim();
      const trimmedImageUrl = (formData.image_url ?? '').trim();
      const body: Record<string, unknown> = {
        name: formData.name,
        slug: formData.slug,
        price: Number(formData.price),
        category_id: String(formData.category_id),
        is_available: Boolean(formData.is_available),
        sort_order: Number(formData.sort_order),
        ...(trimmedDescription ? { description: trimmedDescription } : { description: '' }),
        ...(trimmedImageUrl ? { image_url: trimmedImageUrl } : { image_url: '' }),
      };

      if (editing) {
        return apiFetch(`/api/products/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      }
      return apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: productsKey });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      closeModal();
    },
    onError: (err: Error) => {
      setErrors({ _form: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: productsKey });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setDeleteId(null);
    },
    onError: (err: Error) => {
      setDeleteId(null);
      setErrors({ _form: err.message });
      setActionError(err.message || 'Không thể xoá sản phẩm');
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (product: Product) => {
      const body: Record<string, unknown> = {
        name: product.name,
        slug: product.slug,
        price: product.price,
        category_id: product.category_id,
        is_available: !product.is_available,
        sort_order: product.sort_order,
      };
      if (typeof product.description === 'string') {
        body.description = product.description;
      }
      if (typeof product.image_url === 'string' && product.image_url.trim()) {
        body.image_url = product.image_url.trim();
      }
      return apiFetch(`/api/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: productsKey });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    },
    onError: (err: Error) => {
      setErrors({ _form: err.message });
      setActionError(err.message || 'Không thể cập nhật trạng thái món');
    },
  });

  function openAddModal() {
    setEditing(null);
    setForm(EMPTY_PRODUCT);
    setErrors({});
    setActionError(null);
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description ?? '',
      price: String(product.price),
      category_id: String(product.category_id),
      image_url: product.image_url ?? '',
      is_available: Boolean(product.is_available),
      sort_order: String(product.sort_order),
    });
    setErrors({});
    setActionError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_PRODUCT);
    setErrors({});
  }

  function handleFormChange(field: keyof ProductFormData, value: string | boolean) {
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
    if (!form.price || Number(form.price) <= 0) errs.price = t('adminMenu.priceGreaterThan0');
    if (!form.category_id) errs.category_id = t('adminMenu.categoryRequired');
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
    toggleAvailabilityMutation,
    openAddModal,
    openEditModal,
    closeModal,
    handleFormChange,
    handleSave,
  };
}
