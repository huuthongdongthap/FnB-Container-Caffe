import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

/**
 * Moves focus into `dialogRef` when `isOpen` becomes true, traps Tab/Shift+Tab
 * in DOM document order, closes on Escape, and restores focus to the trigger on close.
 */
export function useDialogFocusTrap(
  dialogRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const triggerEl =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstFocusable = dialogRef.current
      ? getFocusableElements(dialogRef.current)[0]
      : undefined;
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      dialogRef.current?.focus();
    }
    return () => {
      if (triggerEl && triggerEl.isConnected) {
        triggerEl.focus();
      }
    };
  }, [dialogRef, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      const insideDialog = active ? dialogRef.current.contains(active) : false;

      if (e.shiftKey) {
        if (!insideDialog || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!insideDialog || active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [dialogRef, isOpen]);
}
