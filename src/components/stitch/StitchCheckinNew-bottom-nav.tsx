/**
 * StitchCheckinNew — Bottom navigation bar
 */

import { Home, Scan, History } from 'lucide-react';

interface BottomNavProps {
  onNavigate?: (path: string) => void;
}

export function BottomNav({ onNavigate }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-5 py-4 bg-[var(--aura-surface-dim)]/90 backdrop-blur-xl border-t border-[var(--aura-chrome-bright)]/20 z-50">
      <button
        onClick={() => onNavigate?.('/')}
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] p-3 hover:text-[var(--aura-bronze-shimmer)] transition-colors active:scale-90 transition-all duration-200"
      >
        <Home className="w-6 h-6" />
      </button>
      <button
        onClick={() => onNavigate?.('/checkin')}
        className="flex flex-col items-center justify-center bg-[var(--aura-bronze-shimmer)] text-white rounded-full p-3 active:scale-90 transition-all duration-200"
        style={{ boxShadow: '0px 0px 12px rgba(212,165,116,0.4)' }}
      >
        <Scan className="w-6 h-6" />
      </button>
      <button
        onClick={() => onNavigate?.('/history')}
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] p-3 hover:text-[var(--aura-bronze-shimmer)] transition-colors active:scale-90 transition-all duration-200"
      >
        <History className="w-6 h-6" />
      </button>
    </nav>
  );
}
