import { Outlet } from 'react-router-dom';
import { StitchAdminTerminalNew } from './StitchAdminTerminalNew';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import type { ReactNode } from 'react';

export default function AdminShell({ children }: { children?: ReactNode }) {
  return (
    <StitchAdminTerminalNew>
      <ErrorBoundary>{children ?? <Outlet />}</ErrorBoundary>
    </StitchAdminTerminalNew>
  );
}