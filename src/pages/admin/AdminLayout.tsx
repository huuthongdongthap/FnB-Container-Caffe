import AdminShell from '@/components/stitch/AdminShell';
import type { ReactNode } from 'react';

/**
 * @deprecated Use AdminShell as the single admin shell owner.
 * Retained as a re-export shim so existing route/page consumers keep working.
 */
export default function AdminLayout({ children }: { children?: ReactNode } = {}) {
  return <AdminShell>{children}</AdminShell>;
}
