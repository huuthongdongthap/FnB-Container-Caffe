import { useEffect, type RefObject } from 'react';

/**
 * Focusable elements selector used for Tab cycle trapping.
 */
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * useFocusTrap — traps keyboard focus within a container when open,
 * and closes the container on Escape keypress.
 *
 * @param isOpen  Whether the drawer/sidebar is visible.
 * @param onClose Callback invoked when Escape is pressed.
 * @param ref     Ref to the container element that should trap focus.
 */
export function useFocusTrap(
  isOpen: boolean,
  onClose: () => void,
  ref: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!isOpen) return;

    const container = ref.current;
    if (!container) return;

    /* Focus the first focusable element when opened */
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) {
      focusables[0]?.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      /* Escape key closes the drawer */
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      /* Tab: cycle between first and last focusable */
      if (e.key === 'Tab') {
        const els = container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (els.length === 0) return;

        const first = els[0]!;
        const last = els[els.length - 1]!;

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
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, ref]);
}
