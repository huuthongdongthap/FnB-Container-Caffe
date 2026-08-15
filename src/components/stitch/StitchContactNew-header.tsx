/**
 * StitchContactNew — Top navigation header
 */
'use client';

import { Search, UserCircle } from 'lucide-react';

export function Header({ onNavigate }: { onNavigate?: (path: string) => void }) {
  return (
    <header className="fixed top-0 w-full z-50 bg-[var(--aura-surface-dim)]/80 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-6 h-16">
      <div className="font-['EB_Garamond'] text-[24px] font-bold leading-tight text-[var(--aura-chrome-bright)] tracking-tight">
        AURA CAFE
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => onNavigate?.('/search')}
          className="text-[var(--aura-chrome-bright)] hover:opacity-80 transition-opacity active:scale-95 duration-200"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>
        <button
          onClick={() => onNavigate?.('/account')}
          className="text-[var(--aura-chrome-bright)] hover:opacity-80 transition-opacity active:scale-95 duration-200"
          aria-label="Account"
        >
          <UserCircle className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
