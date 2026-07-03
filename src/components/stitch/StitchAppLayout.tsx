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
      <StitchHeader />
      <main className={cn('flex-1', isHome ? 'pt-0' : 'pt-16')}>{children}</main>
      <StitchFooter />
    </div>
  );
}
