import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ═══════════════════════════════════════════════════════════════════
   ProtectedRoute — guards admin routes.
   Redirects to /admin/login if no valid token.
   ═══════════════════════════════════════════════════════════════════ */

export const ADMIN_SHELL_ROLES = ['owner', 'admin', 'manager', 'staff', 'waiter', 'cashier'] as const;
export const KDS_SHELL_ROLES = ['owner', 'admin', 'manager', 'staff', 'waiter', 'cashier', 'kitchen', 'barista', 'chef', 'bep'] as const;
const KITCHEN_ONLY_ROLES = ['kitchen', 'barista', 'chef', 'bep'] as const;

interface ProtectedRouteProps {
  allowedRoles?: readonly string[];
}

export function ProtectedRoute({ allowedRoles = KDS_SHELL_ROLES }: ProtectedRouteProps = {}) {
  const user = useAuthStore((s) => s.user);

  if (!user || !(KDS_SHELL_ROLES as readonly string[]).includes(user.role)) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    if ((KITCHEN_ONLY_ROLES as readonly string[]).includes(user.role)) {
      return <Navigate to="/kds" replace />;
    }
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
