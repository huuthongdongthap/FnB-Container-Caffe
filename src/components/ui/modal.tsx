import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        'fixed inset-0 z-50 m-auto max-h-[90vh] w-full max-w-lg rounded-xl border border-border bg-white p-0 shadow-xl',
        'backdrop:bg-black/50 backdrop:backdrop-blur-sm',
        className,
      )}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        {title && (
          <h2 id="modal-title" className="font-display text-xl font-semibold">
            {title}
          </h2>
        )}
        <button
          onClick={onClose}
          className="ml-auto rounded-lg p-1 text-muted hover:bg-muted/20 hover:text-foreground transition-colors"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="px-6 py-4">{children}</div>
    </dialog>
  );
}
