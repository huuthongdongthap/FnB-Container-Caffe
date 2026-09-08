import { Children, isValidElement, createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ─── Context ─────────────────────────────────────────────── */
interface NavBarCtx {
  activeValue: string;
  onChange: (v: string) => void;
}

const NavBarContext = createContext<NavBarCtx>({ activeValue: '', onChange: () => {} });

/* ─── NavigationBar ───────────────────────────────────────── */
export interface MD3NavigationBarProps {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function MD3NavigationBar({
  value,
  onChange,
  children,
  className,
}: MD3NavigationBarProps) {
  const items = useMemo(() => {
    const result: ReactNode[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child)) result.push(child);
    });
    return result;
  }, [children]);

  // M3 spec: navigation bars allow 2-5 destinations
  if (import.meta.env.DEV && items.length > 5) {
    console.warn('[MD3NavigationBar] M3 spec allows max 5 items, got', items.length);
  }

  return (
    <NavBarContext.Provider value={{ activeValue: value, onChange }}>
      <nav
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          'fixed bottom-0 inset-x-0 z-50 flex items-center justify-around',
          'h-20 bg-md-surface-container',
          'shadow-[0_-2px_6px_rgba(0,0,0,0.08)]',
          className,
        )}
      >
        {items}
      </nav>
    </NavBarContext.Provider>
  );
}

/* ─── NavigationBarItem ────────────────────────────────────── */
export interface MD3NavigationBarItemProps {
  icon: ReactNode;
  label: string;
  value: string;
  badge?: number | 'dot';
}

export function MD3NavigationBarItem({
  icon,
  label,
  value,
  badge,
}: MD3NavigationBarItemProps) {
  const { activeValue, onChange } = useContext(NavBarContext);
  const isActive = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={label}
      onClick={() => onChange(value)}
      className={cn(
        'relative flex flex-col items-center justify-center gap-1',
        'w-16 min-h-12 cursor-pointer select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary',
        'transition-colors duration-200',
      )}
    >
      {/* Icon with optional pill indicator */}
      <span
        className={cn(
          'relative flex items-center justify-center',
          'w-8 h-8 text-2xl [&_svg]:w-6 [&_svg]:h-6',
          isActive
            ? 'bg-md-secondary-container rounded-md-full px-5 py-1.5 text-md-on-secondary-container'
            : 'text-md-on-surface-variant',
        )}
      >
        {icon}

        {/* Badge */}
        {badge === 'dot' && (
          <span
            aria-label="notification"
            className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-md-error rounded-md-full"
          />
        )}
        {typeof badge === 'number' && badge > 0 && (
          <span
            aria-label={`${badge} notifications`}
            className={cn(
              'absolute -top-1 -right-1 flex items-center justify-center',
              'min-w-4 h-4 px-1 text-[10px] font-medium leading-none',
              'bg-md-error text-md-on-error rounded-md-full',
            )}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>

      {/* Label */}
      <span
        className={cn(
          'text-xs leading-4 transition-colors duration-200',
          isActive
            ? 'font-medium text-md-on-surface'
            : 'text-md-on-surface-variant',
        )}
      >
        {label}
      </span>
    </button>
  );
}
