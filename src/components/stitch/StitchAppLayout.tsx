import type { ReactNode } from 'react';
import StitchHeader from './StitchHeader';
import StitchFooter from './StitchFooter';

interface StitchAppLayoutProps {
  children: ReactNode;
}

export default function StitchAppLayout({ children }: StitchAppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0A1A2E]">
      <StitchHeader />
      <main className="flex-1 pt-16">{children}</main>
      <StitchFooter />
    </div>
  );
}
