import { cn } from '@/lib/cn';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/* ─── Types ───────────────────────────────────────────────── */
export interface MD3IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ReactNode;
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  size?: 'default' | 'small' | 'large';
  toggle?: {
    selected: boolean;
    selectedIcon?: ReactNode;
    onToggle: () => void;
  };
  'aria-label': string;
}

/* ─── Size map (M3 spec) ──────────────────────────────────── */
const SIZE_MAP = {
  default: 'w-10 h-10 [&_svg]:w-6 [&_svg]:h-6',
  small: 'w-8 h-8 [&_svg]:w-5 [&_svg]:h-5',
  large: 'w-12 h-12 [&_svg]:w-6 [&_svg]:h-6',
} as const;

/* ─── Variant styles ──────────────────────────────────────── */
const VARIANT_MAP = {
  standard: 'bg-transparent text-md-on-surface-variant',
  filled: 'bg-md-primary-container text-md-on-primary-container',
  tonal: 'bg-md-secondary-container text-md-on-secondary-container',
  outlined: 'bg-transparent border-1 border-md-outline text-md-on-surface-variant',
} as const;

const SELECTED_VARIANT_MAP = {
  standard: 'bg-md-surface-container-highest text-md-on-surface',
  filled: 'bg-md-primary text-md-on-primary',
  tonal: 'bg-md-secondary-container text-md-on-secondary-container',
  outlined: 'bg-md-surface-container-highest border-1 border-md-outline text-md-on-surface',
} as const;

/* ─── Component ───────────────────────────────────────────── */
export function MD3IconButton({
  icon,
  variant = 'standard',
  size = 'default',
  toggle,
  className,
  disabled,
  ...rest
}: MD3IconButtonProps) {
  const isSelected = toggle?.selected ?? false;
  const displayIcon = isSelected && toggle?.selectedIcon ? toggle.selectedIcon : icon;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={toggle ? isSelected : undefined}
      aria-label={rest['aria-label']}
      onClick={toggle ? () => toggle.onToggle() : rest.onClick}
      className={cn(
        'inline-flex items-center justify-center',
        'rounded-md-full cursor-pointer select-none',
        'transition-all duration-[var(--md-sys-motion-duration-short4)] ease-[var(--md-sys-motion-easing-standard)]',
        'hover:bg-md-on-surface/[0.08] active:bg-md-on-surface/[0.12]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary',
        SIZE_MAP[size],
        isSelected ? SELECTED_VARIANT_MAP[variant] : VARIANT_MAP[variant],
        disabled && 'opacity-38 pointer-events-none',
        className,
      )}
      {...(toggle ? {} : rest)}
    >
      <span
        className={cn(
          'flex items-center justify-center transition-transform duration-[var(--md-sys-motion-duration-short4)]',
          isSelected && 'scale-110',
        )}
      >
        {displayIcon}
      </span>
    </button>
  );
}
