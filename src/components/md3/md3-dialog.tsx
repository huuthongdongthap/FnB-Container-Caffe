import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

/* ───────────────────────────────────────────────────────────────
   MD3Dialog — modal dialog with scrim, focus trap, Escape close
   ─────────────────────────────────────────────────────────────── */

export interface MD3DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode[];
  className?: string;
  preventScrimClose?: boolean;
}

export function MD3Dialog({
  open,
  onClose,
  title,
  icon,
  children,
  actions,
  className,
  preventScrimClose = false,
}: MD3DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  /* ── capture previous focus on open ── */
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement;
    }
  }, [open]);

  /* ── focus first focusable element on open ── */
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const timer = requestAnimationFrame(() => {
      const el = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      el?.focus();
    });
    return () => cancelAnimationFrame(timer);
  }, [open]);

  /* ── restore focus on close ── */
  useEffect(() => {
    if (!open && previousFocus.current instanceof HTMLElement) {
      previousFocus.current.focus();
    }
  }, [open]);

  /* ── escape key ── */
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  /* ── focus trap ── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [],
  );

  /* ── scrim click ── */
  const handleScrimClick = useCallback(
    (e: React.MouseEvent) => {
      if (preventScrimClose) return;
      if (e.target === e.currentTarget) onClose();
    },
    [onClose, preventScrimClose],
  );

  /* ── lock body scroll while open ── */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-md-scrim/32"
      onClick={handleScrimClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={dialogRef}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full max-w-[560px] mx-4 p-6',
          'bg-md-surface-container-high rounded-md-xl',
          'shadow-[0_2px_6px_2px_rgba(0,0,0,0.15),0_1px_2px_rgba(0,0,0,0.3)]',
          'md3-anim-dialog',
          className,
        )}
      >
        {/* Icon */}
        {icon && (
          <div className="flex justify-center mb-4">
            <span className="text-md-secondary [&>svg]:w-6 [&>svg]:h-6">{icon}</span>
          </div>
        )}

        {/* Title */}
        {title && (
          <h2 className="headline-small text-md-on-surface mb-4">{title}</h2>
        )}

        {/* Content */}
        <div className="text-md-on-surface-variant body-medium mb-6">
          {children}
        </div>

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex justify-end gap-2">
            {actions.map((action, i) => (
              <span key={i}>{action}</span>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
