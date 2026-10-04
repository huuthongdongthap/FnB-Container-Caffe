import { Navigate, Outlet } from 'react-router-dom';
import { useMobileAuth } from '@/hooks/use-mobile-auth';

/* ═══════════════════════════════════════════════════════════════════
   MobileProtectedRoute — guards staff mobile/tablet routes.
   Redirects to /mobile/login if no valid mobile token/session.
   ═══════════════════════════════════════════════════════════════════ */

export function MobileProtectedRoute() {
  const { isAuthenticated } = useMobileAuth();

  if (!isAuthenticated) {
    return <Navigate to="/mobile/login" replace />;
  }

  return <Outlet />;
}
