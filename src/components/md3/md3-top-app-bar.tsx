import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

/* ─── Types ───────────────────────────────────────────────── */
export interface MD3TopAppBarProps {
  title: string;
  variant?: 'small' | 'center-aligned' | 'medium' | 'large';
  leadingIcon?: ReactNode;
  onLeadingClick?: () => void;
  actions?: ReactNode[];
  scrollY?: number;
  className?: string;
}

/* ─── Height map (M3 spec) ────────────────────────────────── */
const HEIGHT_MAP: Record<string, string> = {
  small: 'h-16',
  'center-aligned': 'h-16',
  medium: 'h-32',
  large: 'h-[156px]',
};

/* ─── Component ───────────────────────────────────────────── */
export function MD3TopAppBar({
  title,
  variant = 'small',
  leadingIcon,
  onLeadingClick,
  actions,
  scrollY = 0,
  className,
}: MD3TopAppBarProps) {
  const isExpanded = variant === 'medium' || variant === 'large';
  const scrolled = scrollY > 0;

  return (
    <header
      role="banner"
      className={cn(
        'sticky top-0 z-40 flex flex-col',
        'transition-colors duration-200',
        scrolled ? 'bg-md-surface-container' : 'bg-md-surface',
        HEIGHT_MAP[variant] ?? 'h-16',
        className,
      )}
    >
      {/* Row: leading + (title or spacer) + actions */}
      <div className="flex items-center h-16 px-1 gap-1">
        {/* Leading icon */}
        {leadingIcon && (
          <button
            type="button"
            onClick={onLeadingClick}
            aria-label="Navigation menu"
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-md-full',
              'text-md-on-surface-variant cursor-pointer',
              'hover:bg-md-on-surface/[0.08] active:bg-md-on-surface/[0.12]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary',
              '[&_svg]:w-6 [&_svg]:h-6',
            )}
          >
            {leadingIcon}
          </button>
        )}

        {/* Title — inline for small / center-aligned */}
        {!isExpanded && (
          <h1
            className={cn(
              'text-[22px] font-normal leading-7 text-md-on-surface',
              variant === 'center-aligned' ? 'flex-1 text-center' : 'flex-1 truncate',
            )}
          >
            {title}
          </h1>
        )}

        {/* Spacer for expanded variants when no leading icon */}
        {isExpanded && !leadingIcon && <span className="w-4" />}

        {/* Expanded title has no inline title; but leading + actions still on row */}
        {isExpanded && <span className="flex-1" />}

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-0.5">
            {actions.map((action, i) => (
              <span key={i} className="[&_button]:w-12 [&_button]:h-12 [&_button]:rounded-md-full">
                {action}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded title area for medium / large */}
      {isExpanded && (
        <div
          className={cn(
            'flex-1 flex items-end px-4 pb-4',
            variant === 'large' ? 'pb-5' : 'pb-4',
          )}
        >
          <h1 className="text-[28px] font-normal leading-9 text-md-on-surface">
            {title}
          </h1>
        </div>
      )}
    </header>
  );
}
