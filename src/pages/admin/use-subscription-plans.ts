import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './subscription-api';
import { EMPTY_PLAN_FORM } from './subscription-types';
import type { PlanRecord, PlanFormData } from './subscription-types';

export function useSubscriptionPlans(t: (key: string, options?: Record<string, unknown>) => string) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);
  const [form, setForm] = useState<PlanFormData>(EMPTY_PLAN_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);

  const query = useQuery<{ success: boolean; data: PlanRecord[] }>({
    queryKey: ['admin-subscription-plans'],
    queryFn: () => apiFetch('/api/subscriptions/plans?all=1'),
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: PlanFormData) => {
      const features = formData.features
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description,
        container_size: formData.container_size,
        monthly_price_vnd: Number(formData.monthly_price_vnd),
        deposit_vnd: Number(formData.deposit_vnd),
        features,
        max_occupants: Number(formData.max_occupants),
        is_popular: formData.is_popular,
        is_active: formData.is_active,
        sort_order: Number(formData.sort_order),
      };

      if (editingPlan) {
        return apiFetch(`/api/subscriptions/plans/${editingPlan.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      }
      return apiFetch('/api/subscriptions/plans', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      closeModal();
    },
    onError: (err: Error) => {
      setErrors({ _form: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/subscriptions/plans/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      setDeletePlanId(null);
    },
  });

  function openAddModal() {
    setEditingPlan(null);
    setForm(EMPTY_PLAN_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEditModal(plan: PlanRecord) {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      container_size: plan.container_size,
      monthly_price_vnd: String(plan.monthly_price_vnd),
      deposit_vnd: String(plan.deposit_vnd),
      features: (plan.features || []).join('\n'),
      max_occupants: String(plan.max_occupants),
      is_popular: plan.is_popular === 1,
      is_active: plan.is_active === 1,
      sort_order: String(plan.sort_order),
    });
    setErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingPlan(null);
    setForm(EMPTY_PLAN_FORM);
    setErrors({});
  }

  function handleFormChange(field: keyof PlanFormData, value: string | boolean) {
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
    if (!editingPlan && !form.name.trim()) {
      errs.name = t('validationNameRequired');
    }
    if (!form.monthly_price_vnd || Number(form.monthly_price_vnd) <= 0) {
      errs.monthly_price_vnd = t('validationPricePositive');
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
    plans: query.data?.data ?? [],
    modalOpen,
    editingPlan,
    form,
    errors,
    deletePlanId,
    setDeletePlanId,
    saveMutation,
    deleteMutation,
    openAddModal,
    openEditModal,
    closeModal,
    handleFormChange,
    handleSave,
  };
}
