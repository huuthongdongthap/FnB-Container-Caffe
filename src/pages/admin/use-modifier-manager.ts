import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './menu-api';
import { EMPTY_MODIFIER_CHOICE, EMPTY_MODIFIER_GROUP } from './types';
import type {
  ModifierChoice,
  ModifierGroup,
  ModifierChoiceFormData,
  ModifierGroupFormData,
} from './types';

/**
 * Modifier management for the menu admin page.
 *
 * Consumes the existing `/api/menu-modifiers` CRUD API rather than touching D1
 * directly, so staff authorization stays in one place and the admin surface
 * matches the contract the order pipeline already validates against.
 */

const GROUPS_KEY = ['admin-modifier-groups'];

export function useModifierManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [groupForm, setGroupForm] = useState<ModifierGroupFormData>(EMPTY_MODIFIER_GROUP);

  const [choiceGroupId, setChoiceGroupId] = useState<string | null>(null);
  const [choiceForm, setChoiceForm] = useState<ModifierChoiceFormData>(EMPTY_MODIFIER_CHOICE);

  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<ModifierGroup | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const groupsQuery = useQuery<{ success: boolean; data: ModifierGroup[] }>({
    queryKey: GROUPS_KEY,
    queryFn: () => apiFetch('/api/menu-modifiers/groups'),
  });

  /** Choices are per-group, so they key off the group id being inspected. */
  const choicesQuery = useQuery<{ success: boolean; data: ModifierChoice[] }>({
    queryKey: ['admin-modifier-choices', choiceGroupId],
    queryFn: () => apiFetch(`/api/menu-modifiers/groups/${choiceGroupId}/choices`),
    enabled: choiceGroupId !== null,
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
    queryClient.invalidateQueries({ queryKey: ['admin-modifier-choices'] });
    queryClient.invalidateQueries({ queryKey: ['admin-product-groups'] });
  }

  const createGroupMutation = useMutation({
    mutationFn: (formData: ModifierGroupFormData) =>
      apiFetch('/api/menu-modifiers/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          required: formData.required,
          sort_order: Number(formData.sort_order),
        }),
      }),
    onSuccess: () => {
      invalidateAll();
      closeGroupModal();
    },
    onError: (err: Error) => setErrors({ _form: err.message }),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/menu-modifiers/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateAll();
      setConfirmDeleteGroup(null);
    },
    onError: (err: Error) => setErrors({ _form: err.message }),
  });

  const createChoiceMutation = useMutation({
    mutationFn: (vars: { groupId: string; formData: ModifierChoiceFormData }) =>
      apiFetch(`/api/menu-modifiers/groups/${vars.groupId}/choices`, {
        method: 'POST',
        body: JSON.stringify({
          name: vars.formData.name,
          price_delta: Number(vars.formData.price_delta),
          sort_order: 0,
        }),
      }),
    onSuccess: () => {
      invalidateAll();
      closeChoiceModal();
    },
    onError: (err: Error) => setErrors({ _form: err.message }),
  });

  // The router exposes create-only for choices (no PATCH/DELETE on
  // /groups/:groupId/choices/:id), so the UI offers creation only. Retiring a
  // mis-priced choice is a direct-DB operation until that endpoint exists.

  // Product↔group linking (POST/DELETE /api/menu-modifiers/products/:id/groups)
  // is intentionally not wired yet — no surface renders it. Add it alongside a
  // product-link editor rather than shipping unreachable mutations.

  function openAddGroupModal() {
    setEditingGroup(null);
    setGroupForm(EMPTY_MODIFIER_GROUP);
    setErrors({});
    setGroupModalOpen(true);
  }

  function closeGroupModal() {
    setGroupModalOpen(false);
    setEditingGroup(null);
    setGroupForm(EMPTY_MODIFIER_GROUP);
    setErrors({});
  }

  function openChoiceModal(group: ModifierGroup) {
    setChoiceGroupId(group.id);
    setChoiceForm(EMPTY_MODIFIER_CHOICE);
    setErrors({});
  }

  function closeChoiceModal() {
    setChoiceGroupId(null);
    setChoiceForm(EMPTY_MODIFIER_CHOICE);
    setErrors({});
  }

  function handleGroupFormChange(field: keyof ModifierGroupFormData, value: string | boolean) {
    setGroupForm((prev) => ({ ...prev, [field]: value }) as ModifierGroupFormData);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      delete next._form;
      return next;
    });
  }

  function handleChoiceFormChange(field: keyof ModifierChoiceFormData, value: string) {
    setChoiceForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      delete next._form;
      return next;
    });
  }

  /** Deltas must be integer VND — the server rejects anything else outright. */
  function validateGroupForm(): boolean {
    const errs: Record<string, string> = {};
    if (!groupForm.name.trim()) errs.name = t('adminMenu.nameRequired');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateChoiceForm(): boolean {
    const errs: Record<string, string> = {};
    if (!choiceForm.name.trim()) errs.name = t('adminMenu.nameRequired');
    if (!Number.isInteger(Number(choiceForm.price_delta))) {
      errs.price_delta = t('adminMenu.integerVnd');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  return {
    t,
    groupsQuery,
    choicesQuery,
    groupModalOpen,
    editingGroup,
    groupForm,
    choiceGroupId,
    choiceForm,
    confirmDeleteGroup,
    setConfirmDeleteGroup,
    errors,
    createGroupMutation,
    deleteGroupMutation,
    createChoiceMutation,
    openAddGroupModal,
    closeGroupModal,
    openChoiceModal,
    closeChoiceModal,
    handleGroupFormChange,
    handleChoiceFormChange,
    validateGroupForm,
    validateChoiceForm,
  };
}
