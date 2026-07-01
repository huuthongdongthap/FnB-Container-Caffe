import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';

export interface ContactFormData {
  name: string;
  phone: string;
  content: string;
}

export interface UseContactReturn {
  submit: (data: ContactFormData) => Promise<void>;
  isSubmitting: boolean;
  isSuccess: boolean;
  error: string | null;
  reset: () => void;
}

export function useContact(): UseContactReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (data: ContactFormData) => {
    setIsSubmitting(true);
    setError(null);
    setIsSuccess(false);

    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setIsSuccess(true);
    } catch (err) {
      const details = err instanceof Error ? err.message : '';
      setError(`Có lỗi xảy ra${details ? ': ' + details : ', vui lòng thử lại sau.'}`);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setIsSuccess(false);
    setError(null);
  }, []);

  return { submit, isSubmitting, isSuccess, error, reset };
}
