import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: 'left' | 'right';
  className?: string;
}

export function Drawer({ open, onClose, title, children, side = 'right', className }: DrawerProps) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed inset-y-0 z-50 w-80 max-w-[90vw] border-[var(--aura-border-subtle)] bg-[var(--aura-bg-elevated)] shadow-[var(--aura-shadow-lg)] transition-transform duration-300',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          side === 'right'
            ? (open ? 'translate-x-0' : 'translate-x-full')
            : (open ? 'translate-x-0' : '-translate-x-full'),
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Drawer'}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          {title && <h2 className="font-display text-lg font-semibold">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto flex h-12 w-12 items-center justify-center rounded-lg text-muted hover:bg-muted/20 hover:text-foreground transition-colors"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </>
  );
}
