import { create } from 'zustand';
import { API_BASE } from '@/lib/api-client';

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

      const res = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const responseBody = await res.json();

      if (!res.ok) {
        set({ loading: false, error: responseBody.message || 'Gửi tin nhắn thất bại' });
        return;
      }

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
