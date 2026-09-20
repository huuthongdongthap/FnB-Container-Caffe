import { Outlet } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { useState, useEffect, type ReactNode } from 'react';

export interface OpsShellProps {
  children?: ReactNode;
  header?: ReactNode;
}

export default function OpsShell({ children, header }: OpsShellProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div
      data-testid="ops-shell"
      data-shell="ops"
      className="min-h-screen bg-[var(--aura-noir-void)] text-white dark relative"
    >
      {!isOnline && (
        <div
          data-testid="ops-offline-indicator"
          className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white text-xs font-semibold py-1 px-4 text-center tracking-wider uppercase"
        >
          Station Offline — Kiểm tra kết nối mạng
        </div>
      )}
      {header}
      <ErrorBoundary>{children ?? <Outlet />}</ErrorBoundary>
    </div>
  );
}