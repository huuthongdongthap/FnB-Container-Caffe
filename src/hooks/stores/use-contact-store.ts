import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Contact store — Zustand for contact form submission.
   Pattern: matches use-auth-store.ts — manual fetch, no middleware.
   ═══════════════════════════════════════════════════════════════════ */


export interface ContactFormData {
  name: string;
  phone: string;
  message: string;
}

interface ContactState {
  submitted: boolean;
  loading: boolean;
  error: string | null;

  submitContact: (name: string, phone: string, message: string, email?: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

function validateRequired(value: string, fieldName: string): string | null {
  if (!value.trim()) return `${fieldName} không được để trống`;
  return null;
}

export const useContactStore = create<ContactState>((set) => ({
  submitted: false,
  loading: false,
  error: null,

  submitContact: async (name, phone, message, email) => {
    const trimmedName = name.trim();
    const rawContact = phone.trim();
    const explicitEmail = (email || '').trim();
    const isCombinedEmail = rawContact.includes('@') && !explicitEmail;
    const resolvedPhone = isCombinedEmail ? '' : rawContact;
    const resolvedEmail = isCombinedEmail ? rawContact : explicitEmail;

    const nameErr = validateRequired(trimmedName, 'Tên');
    const contactErr = !resolvedPhone && !resolvedEmail
      ? 'Số điện thoại hoặc email không được để trống'
      : null;
    const msgErr = validateRequired(message, 'Nội dung');

    if (nameErr || contactErr || msgErr) {
      set({
        submitted: false,
        loading: false,
        error: nameErr || contactErr || msgErr || 'Vui lòng điền đầy đủ thông tin',
      });
      return;
    }

    if (resolvedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedEmail)) {
      set({
        submitted: false,
        loading: false,
        error: 'Địa chỉ email không hợp lệ',
      });
      return;
    }

    if (resolvedPhone && (resolvedPhone.replace(/\s+/g, '').length < 8 || resolvedPhone.replace(/\s+/g, '').length > 15)) {
      set({
        submitted: false,
        loading: false,
        error: 'Số điện thoại không hợp lệ (8–15 ký tự)',
      });
      return;
    }

    set({ loading: true, error: null, submitted: false });
    try {
      const body: Record<string, string> = {
        name: trimmedName,
        content: message.trim(),
      };
      if (resolvedPhone) {
        body.phone = resolvedPhone.replace(/\s+/g, '');
      }
      if (resolvedEmail) {
        body.email = resolvedEmail;
      }

      await apiFetch<{ success?: boolean; message?: string; id?: string | number }>('/api/contact', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      set({
        submitted: true,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    submitted: false,
    loading: false,
    error: null,
  }),
}));
