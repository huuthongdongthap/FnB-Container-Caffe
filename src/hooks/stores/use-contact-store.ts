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
    // Client-side validation
    const nameErr = validateRequired(name, 'Tên');
    const phoneErr = validateRequired(phone, 'Số điện thoại');
    const msgErr = validateRequired(message, 'Nội dung');

    if (nameErr || phoneErr || msgErr) {
      set({
        submitted: false,
        loading: false,
        error: nameErr || phoneErr || msgErr || 'Vui lòng điền đầy đủ thông tin',
      });
      return;
    }

    set({ loading: true, error: null, submitted: false });
    try {
      const body: Record<string, string> = {
        name: name.trim(),
        phone: phone.trim(),
        content: message.trim(),
      };
      if (email?.trim()) {
        body.email = email.trim();
      }

      await apiFetch<any>('/api/contact', {
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
