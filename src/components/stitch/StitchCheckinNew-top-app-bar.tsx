/**
 * StitchCheckinNew — TopAppBar
 */

import { Menu, UserCircle } from 'lucide-react';

interface TopAppBarProps {
  onMenu?: () => void;
  onAccount?: () => void;
}

export function TopAppBar({ onMenu, onAccount }: TopAppBarProps) {
  return (
    <header
      className="fixed top-0 w-full z-50 bg-[var(--aura-surface-dim)]/80 backdrop-blur-md border-b border-white/10 flex justify-between items-center px-5 h-16"
      style={{ boxShadow: '0px 0px 15px rgba(212,165,116,0.1)' }}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={onMenu}
          className="text-[var(--aura-bronze-shimmer)] hover:opacity-80 transition-opacity active:scale-95 transition-transform"
          aria-label="Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-[24px] font-bold leading-tight font-['EB_Garamond'] text-[var(--aura-bronze-shimmer)] tracking-tighter">
          AURA CAFE
        </h1>
      </div>
      <button
        onClick={onAccount}
        className="text-[var(--aura-bronze-shimmer)] hover:opacity-80 transition-opacity active:scale-95 transition-transform"
        aria-label="Account"
      >
        <UserCircle className="w-6 h-6" />
      </button>
    </header>
  );
}
