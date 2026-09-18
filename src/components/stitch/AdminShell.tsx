import AdminLayout from '@/pages/admin/AdminLayout';
import type { ReactNode } from 'react';

export default function AdminShell({ children }: { children?: ReactNode }) {
  return (
    <AdminLayout>
      {children}
    </AdminLayout>
  );
}