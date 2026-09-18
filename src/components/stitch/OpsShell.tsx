import { Outlet } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import type { ReactNode } from 'react';

export default function OpsShell({ children }: { children?: ReactNode }) {
  return (
    <div
      data-testid="ops-shell"
      data-shell="ops"
      className="min-h-screen bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-on-surface)]"
    >
      <ErrorBoundary>{children ?? <Outlet />}</ErrorBoundary>
    </div>
  );
}