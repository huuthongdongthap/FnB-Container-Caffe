import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import StitchHeader from './StitchHeader';
import StitchFooter from './StitchFooter';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { cn } from '@/lib/cn';

// Pages that have their OWN header/nav built into the Stitch component
// Pages that have their OWN header/nav built into the Stitch component
// or use their own layout shell (AdminLayout, MobileAppShell)
const PAGES_WITH_OWN_HEADER = new Set([
  '/', '/menu', '/container', '/order', '/order-failure', '/checkout',
  '/account', '/events',
  '/admin', '/mobile',
]);

interface StitchAppLayoutProps {
  children: ReactNode;
}

export default function StitchAppLayout({ children }: StitchAppLayoutProps) {
  const location = useLocation();
  const hideHeader = PAGES_WITH_OWN_HEADER.has(location.pathname);

  return (
    <div className="flex min-h-screen flex-col bg-[#0A1A2E]">
      {/* Skip to content link -- visible on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded focus:bg-[#CD7F32] focus:text-white focus:text-sm focus:font-semibold focus:outline-none"
      >
        Skip to content / B&#x1ECF; qua n&#x1ED9;i dung
      </a>
      {!hideHeader && <StitchHeader />}
      <main id="main-content" className={cn('flex-1', hideHeader ? 'pt-0' : 'pt-16')}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      {!hideHeader && <StitchFooter />}
    </div>
  );
}
