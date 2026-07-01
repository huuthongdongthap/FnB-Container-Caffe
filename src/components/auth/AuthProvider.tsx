import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ═══════════════════════════════════════════════════════════════════
   AuthProvider — hydrates Zustand auth store from localStorage on mount.
   Validates stored token via GET /api/auth/me. Renders children regardless.
   ═══════════════════════════════════════════════════════════════════ */

interface Props {
  children: ReactNode;
}

export function AuthProvider({ children }: Props) {
  const token = useAuthStore((s) => s.token);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (token) {
      fetchMe();
    }
  }, []); // run once on mount

  return <>{children}</>;
}
