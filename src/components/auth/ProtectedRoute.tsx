import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ═══════════════════════════════════════════════════════════════════
   ProtectedRoute — guards admin routes.
   Redirects to /admin/login if no valid token.
   ═══════════════════════════════════════════════════════════════════ */

export function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
