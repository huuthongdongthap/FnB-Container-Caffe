import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ═══════════════════════════════════════════════════════════════════
   ProtectedRoute — guards admin routes.
   Redirects to /admin/login if no valid token.
   ═══════════════════════════════════════════════════════════════════ */

export const ADMIN_SHELL_ROLES = ['owner', 'admin', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'shipper', 'rider'] as const;
export const KDS_SHELL_ROLES = ['owner', 'admin', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'shipper', 'rider', 'kitchen', 'barista', 'chef', 'bep'] as const;
export const SAAS_ONBOARD_ROLES = [...KDS_SHELL_ROLES, 'customer', 'user'] as const;
const KITCHEN_ONLY_ROLES = ['kitchen', 'barista', 'chef', 'bep'] as const;

interface ProtectedRouteProps {
  allowedRoles?: readonly string[];
  loginPath?: string;
}

export function ProtectedRoute({
  allowedRoles = KDS_SHELL_ROLES,
  loginPath = '/admin/login',
}: ProtectedRouteProps = {}) {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Navigate to={loginPath} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    if ((KITCHEN_ONLY_ROLES as readonly string[]).includes(user.role)) {
      return <Navigate to="/kds" replace />;
    }
    return <Navigate to={loginPath} replace />;
  }

  return <Outlet />;
}
