import { type ReactNode } from 'react';
import { MD3Dialog } from '@/components/md3/md3-dialog';

/**
 * ModalAdapter — backward-compatible wrapper around MD3Dialog.
 * Preserves legacy Modal API: open, onClose, title, children, className.
 */
export interface ModalAdapterProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalAdapterProps) {
  return (
    <MD3Dialog
      open={open}
      onClose={onClose}
      title={title}
      className={className}
    >
      {children}
    </MD3Dialog>
  );
}