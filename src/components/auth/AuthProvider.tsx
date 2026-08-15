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
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (user) {
      fetchMe();
    }
  }, []); // run once on mount

  return <>{children}</>;
}
