import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import StitchHeader from './StitchHeader';
import StitchFooter from './StitchFooter';
import { cn } from '@/lib/cn';

interface StitchAppLayoutProps {
  children: ReactNode;
}

export default function StitchAppLayout({ children }: StitchAppLayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="flex min-h-screen flex-col bg-[#0A1A2E]">
      {/* Skip to content link -- visible on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded focus:bg-[#CD7F32] focus:text-white focus:text-sm focus:font-semibold focus:outline-none"
      >
        Skip to content / B&#x1ECF; qua n&#x1ED9;i dung
      </a>
      <StitchHeader />
      <main id="main-content" className={cn('flex-1', isHome ? 'pt-0' : 'pt-16')}>{children}</main>
      <StitchFooter />
    </div>
  );
}
