import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, slugify } from './menu-api';
import { EMPTY_PRODUCT } from './types';
import type { Product, ProductFormData } from './types';

export function useProductManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_PRODUCT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const query = useQuery<{ success: boolean; data: Product[] }>({
    queryKey: ['admin-products'],
    queryFn: () => apiFetch('/api/products'),
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: ProductFormData) => {
      const body = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        price: Number(formData.price),
        category_id: Number(formData.category_id),
        image_url: formData.image_url,
        is_available: formData.is_available ? 1 : 0,
        sort_order: Number(formData.sort_order),
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
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      closeModal();
    },
    onError: (err: Error) => {
      setErrors({ _form: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setDeleteId(null);
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (product: Product) => {
      const body = {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        category_id: product.category_id,
        image_url: product.image_url,
        is_available: product.is_available ? 0 : 1,
        sort_order: product.sort_order,
      };
      return apiFetch(`/api/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });

  function openAddModal() {
    setEditing(null);
    setForm(EMPTY_PRODUCT);
    setErrors({});
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: String(product.price),
      category_id: String(product.category_id),
      image_url: product.image_url,
      is_available: product.is_available === 1,
      sort_order: String(product.sort_order),
    });
    setErrors({});
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
