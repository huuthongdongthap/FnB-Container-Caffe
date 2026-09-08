import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

/* ───────────────────────────────────────────────────────────────
   MD3Snackbar — inverse-surface toast, action button, auto-dismiss
   ─────────────────────────────────────────────────────────────── */

export interface MD3SnackbarProps {
  open: boolean;
  message: string;
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
  duration?: number;
  className?: string;
}

export function MD3Snackbar({
  open,
  message,
  action,
  onClose,
  duration = 4000,
  className,
}: MD3SnackbarProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── auto-dismiss ── */
  useEffect(() => {
    if (!open || duration === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onClose?.();
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, duration, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-4 min-h-[48px] px-4 py-2',
        'bg-md-inverse-surface text-md-inverse-on-surface rounded-md-xs',
        'shadow-lg max-w-[560px]',
        'md3-anim-snackbar',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className="body-medium flex-1">{message}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            'ml-auto flex-shrink-0 font-medium label-large cursor-pointer',
            'text-md-primary hover:underline outline-none',
          )}
        >
          {action.label}
        </button>
      )}
    </div>,
    document.body,
  );
}
