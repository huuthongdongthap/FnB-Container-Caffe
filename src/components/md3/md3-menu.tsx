import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

/* ───────────────────────────────────────────────────────────────
   MD3Menu — positioned dropdown with scrim, keyboard nav
   ─────────────────────────────────────────────────────────────── */

export interface MD3MenuProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}

export interface MD3MenuItemProps {
  icon?: React.ReactNode;
  label: string;
  trailingText?: string;
  disabled?: boolean;
  onClick?: () => void;
  divider?: boolean;
}

export function MD3MenuItem({
  icon,
  label,
  trailingText,
  disabled = false,
  onClick,
  divider = false,
}: MD3MenuItemProps) {
  return (
    <>
      <button
        role="menuitem"
        disabled={disabled}
        onClick={disabled ? undefined : onClick}
        className={cn(
          'flex w-full items-center gap-3 px-3 min-h-[48px] text-left',
          'text-md-on-surface body-medium cursor-pointer',
          'hover:bg-md-on-surface/8 focus-visible:bg-md-on-surface/8',
          'outline-none transition-colors',
          disabled && 'opacity-38 pointer-events-none',
        )}
      >
        {icon && (
          <span className="flex-shrink-0 text-md-on-surface-variant">
            {icon}
          </span>
        )}
        <span className="flex-1 truncate">{label}</span>
        {trailingText && (
          <span className="ml-auto flex-shrink-0 text-md-on-surface-variant text-sm">
            {trailingText}
          </span>
        )}
      </button>
      {divider && (
        <div className="my-1 border-t border-md-outline-variant" role="separator" />
      )}
    </>
  );
}

export function MD3Menu({ open, anchorRef, onClose, children }: MD3MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [focusIdx, setFocusIdx] = useState(-1);

  /* ── compute position below anchor ── */
  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewportW = window.innerWidth;

    let left = rect.left;
    if (rect.left + 280 > viewportW) {
      left = rect.right - 280;
    }

    setPosition({
      top: rect.bottom + 4,
      left: Math.max(8, left),
    });
  }, [anchorRef]);

  useEffect(() => {
    if (open) {
      updatePosition();
      setFocusIdx(-1);
    }
  }, [open, updatePosition]);

  /* ── click outside ── */
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose, anchorRef]);

  /* ── escape key ── */
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        anchorRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose, anchorRef]);

  /* ── keyboard navigation ── */
  const getEnabledItems = useCallback(() => {
    if (!menuRef.current) return [];
    return Array.from(
      menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
    );
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const items = getEnabledItems();
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = focusIdx < items.length - 1 ? focusIdx + 1 : 0;
        setFocusIdx(next);
        items[next]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = focusIdx > 0 ? focusIdx - 1 : items.length - 1;
        setFocusIdx(prev);
        items[prev]?.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        items[focusIdx]?.click();
      }
    },
    [focusIdx, getEnabledItems],
  );

  if (!open) return null;

  return createPortal(
    <>
      {/* scrim */}
      <div className="fixed inset-0 z-50 bg-md-scrim/32" aria-hidden="true" />
      {/* menu surface */}
      <div
        ref={menuRef}
        role="menu"
        onKeyDown={handleKeyDown}
        className={cn(
          'fixed z-50 min-w-[112px] max-w-[280px] py-1',
          'bg-md-surface-container rounded-md-md',
          'shadow-[0_2px_6px_2px_rgba(0,0,0,0.15),0_1px_2px_rgba(0,0,0,0.3)]',
          'md3-anim-menu',
          'outline-none',
        )}
        style={{ top: position.top, left: position.left }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
