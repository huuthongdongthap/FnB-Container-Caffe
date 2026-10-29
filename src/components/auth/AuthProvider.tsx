import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useQueryClient } from '@tanstack/react-query';
import { readClientSession, invalidateClientSession, subscribeClientSession, tokenClaims } from '@/lib/client-session';

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
  const sessionVersion = useAuthStore((s) => s.sessionVersion);
  const queryClient = useQueryClient();

  useEffect(() => subscribeClientSession(() => {
    void queryClient.cancelQueries();
    queryClient.clear();
  }), [queryClient]);

  useEffect(() => {
    const { token } = readClientSession();
    const exp = tokenClaims(token).exp;
    if (!token || !Number.isFinite(exp)) return;
    const timer = setTimeout(() => invalidateClientSession(token, 'Phiên đã hết hạn, vui lòng đăng nhập lại'), Math.max(0, exp! * 1000 - Date.now()));
    return () => clearTimeout(timer);
  }, [sessionVersion]);

  useEffect(() => {
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('aura_auth_token');
    if (user || hasToken) {
      void fetchMe();
    }
  }, []); // run once on mount

  return <>{children}</>;
}
