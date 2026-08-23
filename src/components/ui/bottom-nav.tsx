/**
 * BottomNav — Shared bottom navigation bar.
 *
 * Replaces 8+ hand-written bottom nav components across Stitch screens
 * (StitchAccountNew-bottom-nav, StitchCheckinNew-bottom-nav,
 *  StitchGalleryNew-bottom-nav, StitchLoyaltyCalcNew-bottom-nav,
 *  StitchPromotionsNew-bottom-nav, StitchTrackOrderNew-bottom-nav,
 *  StitchMobileOrderNew-cart-bar, StitchOrderFailureNew-bottom-sections)
 * with a single configurable primitive.
 *
 * Design: fixed bottom bar, glassmorphism, safe-area-inset-bottom, 48px min tap.
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface BottomNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  activeIcon?: ReactNode;
}

export interface BottomNavProps extends HTMLAttributes<HTMLDivElement> {
  items: BottomNavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  position?: 'fixed' | 'relative';
}

export const BottomNav = forwardRef<HTMLDivElement, BottomNavProps>(
  ({ className, items, activeId, onNavigate, position = 'fixed', ...props }, ref) => {
    return (
      <nav
        ref={ref}
        className={cn(
          'left-0 right-0 z-50 flex items-center justify-around px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]',
          'backdrop-blur-xl bg-[var(--aura-surface-dim)]/80',
          'border-t border-[var(--aura-chrome-soft)]/10',
          position === 'fixed' && 'fixed bottom-0',
          className,
        )}
        aria-label="Main navigation"
        {...props}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          const icon = isActive && item.activeIcon ? item.activeIcon : item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 transition-all',
                'min-w-[48px] min-h-[48px] rounded-full px-3 py-1',
                'active:scale-90 transition-transform duration-150',
                isActive
                  ? 'text-[var(--aura-bronze-shimmer)] bg-[var(--aura-bronze-shimmer)]/10'
                  : 'text-[var(--aura-chrome-soft)] hover:text-[var(--aura-bronze-shimmer)] hover:bg-white/5',
              )}
            >
              {icon}
              <span className="text-[10px] font-bold tracking-wider uppercase">{item.label}</span>
            </button>
          );
        })}
      </nav>
    );
  },
);

BottomNav.displayName = 'BottomNav';